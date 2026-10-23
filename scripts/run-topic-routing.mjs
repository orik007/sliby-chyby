import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { sha256 } from "./lib/collector-core.mjs";
import { loadTrackedPromises } from "./lib/published-promises.mjs";
import { pairedModelRuntimeConfig } from "./lib/model-output.mjs";
import {
  buildRelevanceBrief,
  buildScreeningBrief,
  isKeptByRelevance,
  isSubstantive,
  loadRelevancePrompt,
  loadScreeningPrompt,
  relevanceInputBlocks,
  requestRelevance,
  requestScreening,
  screeningInputBlocks,
  validateRelevanceOutput,
  validateScreeningOutput
} from "./lib/law-change-screening.mjs";
import { directLegalIdentifierIndex, taxonomyHash } from "./lib/topic-taxonomy.mjs";
import { buildInvertedIndex, routeLawChange } from "./lib/topic-routing.mjs";
import { withContext } from "./lib/law-context.mjs";
import { attributableConductOnChange, buildLawChangeEvidencePackage, conductOfRun, lawChangesOfRun } from "./lib/topic-evidence-package.mjs";
import { loadAssessmentPrompts, maxRequestInputTokens } from "./lib/assessment-config.mjs";
import { validateReviewManifest } from "./lib/assessment-review.mjs";
import { exclusionOf, loadRelevanceVerdicts } from "./lib/irrelevance-verdicts.mjs";
import { cachePersister, loadModelCache, loadShardedModelCache, pairedModelCall, shardedCachePersister, usageTotalsByModel, writeJsonAtomically } from "./lib/paired-model-calls.mjs";
import { log, progress } from "./lib/run-log.mjs";

/**
 * Screens every law change, routes the substantive ones to promises by
 * their reviewed tags, checks the relevance of each promise and law change, and builds
 * one evidence package per promise (docs/evidence-pipeline.md, steps 4-7).
 * Every paid result is cached at once; a stage that fails stops the run
 * after the report and the caches are written.
 */
const envPath = resolve(".env");
if (existsSync(envPath)) loadEnvFile(envPath);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(args) {
  const options = {
    collectorRun: null,
    printParts: null,
    lawContext: null,
    tagCache: "automation/topic-routing/tag-cache",
    reviewProposals: "automation/review-proposals",
    asOf: null,
    output: "automation/runs/pipeline/topic-routing",
    samplePromises: null,
    sampleChanges: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--print-parts") options.printParts = args[++index];
    else if (arg === "--law-context") options.lawContext = args[++index];
    else if (arg === "--tag-cache") options.tagCache = args[++index];
    else if (arg === "--review-proposals") options.reviewProposals = args[++index];
    else if (arg === "--as-of") options.asOf = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--sample-promises") options.samplePromises = Number(args[++index]);
    else if (arg === "--sample-changes") options.sampleChanges = Number(args[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun && options.printParts && options.lawContext, "--collector-run, --print-parts, and --law-context are required");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(options.asOf ?? ""), "--as-of must use YYYY-MM-DD");
  for (const key of ["samplePromises", "sampleChanges"]) {
    invariant(options[key] === null || (Number.isInteger(options[key]) && options[key] > 0), `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} must be a positive integer`);
  }
  return options;
}

function apiKeyFor(provider) {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  throw new Error(`No API-key mapping is configured for provider: ${provider}`);
}

const args = parseArgs(process.argv.slice(2));
const runtime = pairedModelRuntimeConfig();
invariant(Number.isInteger(runtime.concurrency) && runtime.concurrency > 0 && runtime.concurrency <= 64, "SLIBY_TAGGING_CONCURRENCY must be an integer from 1 to 64");
const apiKey = apiKeyFor(runtime.provider);
const prompts = { screening: await loadScreeningPrompt(), relevance: await loadRelevancePrompt() };
// The routing taxonomy is the one the promise tags were reviewed against.
let { taxonomy, promises } = await loadTrackedPromises();
const taxonomyContentHash = taxonomyHash(taxonomy);
const directIdIndex = directLegalIdentifierIndex(taxonomy);
const printParts = JSON.parse(await readFile(resolve(args.printParts), "utf8"));
invariant(printParts?.schemaVersion === "1.0.0" && printParts.prints && typeof printParts.prints === "object", "Invalid --print-parts file");

// A sample run keeps the first N promises or law changes (deterministic) so
// its spend and output stay bounded; a full run uses everything.
if (args.samplePromises !== null) promises = promises.slice(0, args.samplePromises);
const promiseById = new Map(promises.map((promise) => [promise.id, promise]));
const invertedIndex = buildInvertedIndex(taxonomy, promises);

const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
const trackedPartyIds = [...new Set(promises.map(({ partyId }) => partyId))].sort();
// Only records that can be attributable conduct of a tracked party continue;
// they link law changes to the party's votes, submissions, amendments, and
// the government's opinions.
const { primaryRecordsInWindow, conductRecords, recordsByPrintId, printFirstSeenOn, amendmentRecords } = conductOfRun(collectorRun, args.asOf, trackedPartyIds);
// Every model that reads a law change also reads its context
// (docs/evidence-pipeline.md, Law-change context).
const lawContext = JSON.parse(await readFile(resolve(args.lawContext), "utf8"));
invariant(lawContext?.schemaVersion === "1.0.0" && lawContext.asOf === args.asOf && lawContext.changes && typeof lawContext.changes === "object", "Invalid --law-context file, or one for another cutoff");
// Each law change carries the amendments that concern it, which the
// screeners and relevance checks read with it (docs/evidence-pipeline.md).
let changes = lawChangesOfRun(printParts, recordsByPrintId, amendmentRecords).map((change) => {
  const context = lawContext.changes[change.changeId];
  invariant(context, `No law-change context for ${change.changeId}`);
  return withContext(change, context);
});
if (args.sampleChanges !== null) changes = changes.slice(0, args.sampleChanges);

// Relevance checks are kept in one journal per promise, in a directory per
// party period, so no file nears GitHub's file-size limit.
const relevanceFileOf = (subjectId) => {
  const promiseId = subjectId.split("--")[0];
  const partyPeriodId = promiseById.get(promiseId)?.partyPeriodId;
  invariant(partyPeriodId, `Unknown promise of relevance check ${subjectId}`);
  return `${partyPeriodId}/${promiseId}.jsonl`;
};
const caches = {
  screening: await loadModelCache(resolve(args.tagCache, "law-change-screening.jsonl")),
  relevance: await loadShardedModelCache(resolve(args.tagCache, "relevance-checks"), relevanceFileOf)
};
const persist = { screening: cachePersister(caches.screening), relevance: shardedCachePersister(caches.relevance) };
const models = { provider: runtime.provider, modelA: runtime.modelA, modelB: runtime.modelB };
const usage = { screening: [], relevance: [] };
const invalid = { screening: 0, relevance: 0 };
let runFailure = null;

function fail(stageName, error) {
  if (runFailure) return;
  runFailure = { stage: stageName, message: error instanceof Error ? error.message : String(error) };
  log(`stopping: ${runFailure.message}`);
}

async function screenChange(change) {
  const brief = buildScreeningBrief(change, taxonomy);
  const fingerprint = { inputHash: sha256(screeningInputBlocks(brief)), taxonomyContentHash, promptContentHash: prompts.screening.contentHash, ...models };
  const screened = await pairedModelCall({
    subjectId: change.changeId,
    fingerprint,
    cache: caches.screening,
    persist: persist.screening,
    callA: () => requestScreening({ provider: runtime.provider, apiKey, model: runtime.modelA, brief, taxonomy, prompt: prompts.screening }),
    callB: () => requestScreening({ provider: runtime.provider, apiKey, model: runtime.modelB, brief, taxonomy, prompt: prompts.screening }),
    revalidate: (output) => validateScreeningOutput(output, taxonomy)
  });
  usage.screening.push(...screened.usageByModel);
  invalid.screening += screened.invalidCount;
  const substantive = isSubstantive(screened.a, screened.b);
  const route = substantive
    ? routeLawChange({ taxonomy, change, screenerA: screened.a, screenerB: screened.b, invertedIndex, directIdIndex })
    : { changeId: change.changeId, disposition: "technical", reason: "both-screeners-technical", routedTo: [] };
  return { change, substantive, route, screenerA: screened.a, screenerB: screened.b, screenerAError: screened.errorA, screenerBError: screened.errorB };
}

// A promise and a routed law change continue only when the promise's party
// has attributable conduct on the change's print.
let routedWithoutConductCount = 0;
function pairsOf({ change, route }) {
  const pairs = [];
  for (const target of route.routedTo) {
    const promise = promiseById.get(target.promiseId);
    if (!promise) continue;
    if (attributableConductOnChange(recordsByPrintId.get(change.printId) ?? [], promise, change).length === 0) {
      routedWithoutConductCount += 1;
      continue;
    }
    pairs.push({ promise, change, route: target });
  }
  return pairs;
}

// The number of pairs is known only once every law change is screened, so
// the progress line says how many are known so far until then.
let pairCount = 0;
let screeningComplete = false;
let screeningFailed = false;
let checkedPairCount = 0;
let pairsLoggedAt = Date.now();
function tickPairs(detail) {
  checkedPairCount += 1;
  if (checkedPairCount % 50 === 0 || Date.now() - pairsLoggedAt >= 30_000 || (screeningComplete && checkedPairCount === pairCount)) {
    log(`relevance checks: ${checkedPairCount}/${pairCount}${screeningComplete ? "" : " known so far"} (last: ${detail})`);
    pairsLoggedAt = Date.now();
  }
}
async function checkPair(pair) {
  const brief = buildRelevanceBrief(pair.promise, pair.change);
  const fingerprint = { inputHash: sha256(relevanceInputBlocks(brief)), promptContentHash: prompts.relevance.contentHash, ...models };
  const checked = await pairedModelCall({
    subjectId: brief.pairId,
    fingerprint,
    cache: caches.relevance,
    persist: persist.relevance,
    callA: () => requestRelevance({ provider: runtime.provider, apiKey, model: runtime.modelA, brief, prompt: prompts.relevance }),
    callB: () => requestRelevance({ provider: runtime.provider, apiKey, model: runtime.modelB, brief, prompt: prompts.relevance }),
    revalidate: validateRelevanceOutput
  });
  usage.relevance.push(...checked.usageByModel);
  invalid.relevance += checked.invalidCount;
  const result = { ...pair, kept: isKeptByRelevance(checked.a, checked.b), checkA: checked.a, checkB: checked.b, checkAError: checked.errorA, checkBError: checked.errorB };
  tickPairs(`${pair.promise.id} × ${pair.change.changeId}: ${result.kept ? "kept" : "dropped"}`);
  return result;
}

// 1. Screening and routing of every law change (steps 4 and 5) and 2. the
// relevance of each promise and law change (step 6), in one pool of workers
// (docs/evidence-pipeline.md, Audit and cost control): a worker screens while
// a law change is left to screen, then checks the pairs of one law change
// after another, the group with the most pairs first.
log(`law-change screening: ${changes.length} law changes from ${new Set(changes.map(({ printId }) => printId)).size} prints with attributable conduct`);
const tickChanges = progress("law-change screening", changes.length, { every: 20 });
const screenedByIndex = new Array(changes.length);
const readyGroups = [];
const finishedPairs = [];
let nextChange = 0;
let screeningInFlight = 0;
let screeningDone = null;
function waitForScreening() {
  screeningDone ??= Promise.withResolvers();
  return screeningDone.promise;
}
async function runWorker() {
  while (!runFailure) {
    if (nextChange < changes.length) {
      const changeIndex = nextChange;
      nextChange += 1;
      screeningInFlight += 1;
      try {
        const screened = await screenChange(changes[changeIndex]);
        screenedByIndex[changeIndex] = screened;
        const { change, route } = screened;
        tickChanges(`${change.changeId} (${change.titleCz.slice(0, 60)}): ${route.disposition}${route.routedTo.length > 0 ? ` to ${route.routedTo.length} promise(s)` : ""}`);
        const group = pairsOf(screened).map((pair, position) => ({ changeIndex, position, pair }));
        pairCount += group.length;
        if (group.length > 0) readyGroups.push(group);
      } catch (error) {
        screeningFailed = true;
        fail("law-change-screening", error);
      } finally {
        screeningInFlight -= 1;
        if (nextChange >= changes.length && screeningInFlight === 0 && !screeningFailed) {
          screeningComplete = true;
          log(`relevance checks: ${pairCount} promise and law-change pairs, ${checkedPairCount} already checked`);
        }
        screeningDone?.resolve();
        screeningDone = null;
      }
      continue;
    }
    if (readyGroups.length > 0) {
      readyGroups.sort((left, right) => right.length - left.length || left[0].changeIndex - right[0].changeIndex);
      for (const entry of readyGroups.shift()) {
        if (runFailure) return;
        try {
          finishedPairs.push({ ...entry, result: await checkPair(entry.pair) });
        } catch (error) {
          fail("relevance-check", error);
          return;
        }
      }
      continue;
    }
    if (screeningInFlight === 0) return;
    await waitForScreening();
  }
}
await Promise.all(Array.from({ length: Math.min(runtime.concurrency, Math.max(changes.length, 1)) }, runWorker));
const screenedChanges = screenedByIndex.filter(Boolean);
const checkedPairs = finishedPairs
  .sort((left, right) => left.changeIndex - right.changeIndex || left.position - right.position)
  .map(({ result }) => result);

// 3. One package per promise (step 7), only from a complete run.
const outputDirectory = resolve(args.output);
const packageDirectory = resolve(outputDirectory, "evidence-packages");
await mkdir(packageDirectory, { recursive: true });
const builtPackages = [];
const excludedLawChanges = [];
if (!runFailure) {
  const keptByPromise = new Map();
  for (const pair of checkedPairs.filter(({ kept }) => kept)) {
    keptByPromise.set(pair.promise.id, [...(keptByPromise.get(pair.promise.id) ?? []), { change: pair.change, route: pair.route }]);
  }
  log(`building evidence packages for ${keptByPromise.size} promises`);
  const collectorRunHash = sha256(collectorRun);
  const { assessor } = await loadAssessmentPrompts();
  const assessorInstructions = assessor.instructions;
  // The relevance verdicts of earlier assessments (docs/evidence-pipeline.md,
  // Package).
  const manifestPath = resolve(args.reviewProposals, "manifest.json");
  const verdicts = existsSync(manifestPath) ? await loadRelevanceVerdicts(validateReviewManifest(JSON.parse(await readFile(manifestPath, "utf8")))) : new Map();
  const assessorPrompt = { version: assessor.version, contentHash: assessor.contentHash };
  for (const [promiseId, keptChanges] of [...keptByPromise].sort(([left], [right]) => left.localeCompare(right))) {
    const promise = promiseById.get(promiseId);
    const excluded = [];
    const evidencePackage = buildLawChangeEvidencePackage({
      promise, keptChanges, recordsByPrintId, printFirstSeenOn, collectorRun, collectorRunHash, asOf: args.asOf, assessorInstructions,
      contextOf: (changeId) => lawContext.changes[changeId],
      exclusionOf: (lawChange) => {
        const entry = exclusionOf({ verdicts, promise: { id: promise.id, titleCz: promise.titleCz, originalTextCz: promise.originalTextCz }, lawChange, assessorPrompt });
        if (entry) excluded.push(entry);
        return entry;
      }
    });
    excludedLawChanges.push(...excluded.map((entry) => ({ promiseId, ...entry })));
    if (!evidencePackage) {
      if (excluded.length > 0) log(`${promiseId}: no package; every law change with the party's conduct was found not relevant by both assessors of an earlier assessment`);
      continue;
    }
    await writeFile(resolve(packageDirectory, `${promiseId}.json`), `${JSON.stringify(evidencePackage, null, 2)}\n`, { flag: "wx" });
    builtPackages.push({ promiseId, lawChangeCount: evidencePackage.generation.lawChangeCount, conductCount: evidencePackage.generation.conductCount, estimatedTokens: evidencePackage.generation.estimatedTokens, oversized: evidencePackage.generation.oversized, contextOmissionCount: (evidencePackage.generation.contextOmissions ?? []).reduce((sum, { omitted }) => sum + omitted.reduce((count, { paths }) => count + paths.length, 0), 0) });
    const trimmed = evidencePackage.generation.contextOmissions;
    if (trimmed && !evidencePackage.generation.oversized) log(`${promiseId}: package fits the models only without the wording of ${builtPackages.at(-1).contextOmissionCount} provisions in the context of ${trimmed.length} law-change version(s); they are named in the package`);
    if (evidencePackage.generation.oversized) log(`${promiseId}: package of about ${evidencePackage.generation.estimatedTokens} tokens exceeds ${maxRequestInputTokens}, the most the models can read, together with the assessor instructions; it is reported for human review and not assessed`);
  }
}

const counts = {
  sourceRecordCount: collectorRun.records.length,
  primaryRecordsInWindowCount: primaryRecordsInWindow.length,
  notAttributableSkippedCount: primaryRecordsInWindow.length - conductRecords.length,
  conductRecordCount: conductRecords.length,
  promiseCount: promises.length,
  lawChangeCount: changes.length,
  screenedLawChangeCount: screenedChanges.length,
  technicalLawChangeCount: screenedChanges.filter(({ substantive }) => !substantive).length,
  substantiveLawChangeCount: screenedChanges.filter(({ substantive }) => substantive).length,
  routedLawChangeCount: screenedChanges.filter(({ route }) => route.disposition === "routed").length,
  directLinkLawChangeCount: screenedChanges.filter(({ route }) => route.routedTo.some(({ routeBasis }) => routeBasis.includes("direct-structural-link"))).length,
  unroutedLawChangeCount: screenedChanges.filter(({ route }) => route.disposition === "unrouted").length,
  routedWithoutConductCount,
  relevancePairCount: pairCount,
  relevanceKeptCount: checkedPairs.filter(({ kept }) => kept).length,
  relevanceDroppedCount: checkedPairs.filter(({ kept }) => !kept).length,
  packageCount: builtPackages.length,
  oversizedPackageCount: builtPackages.filter(({ oversized }) => oversized).length,
  contextTrimmedPackageCount: builtPackages.filter(({ oversized, contextOmissionCount }) => !oversized && contextOmissionCount > 0).length,
  excludedIrrelevantPairCount: excludedLawChanges.length,
  invalidScreenerCount: invalid.screening,
  invalidRelevanceCheckCount: invalid.relevance
};

const report = {
  schemaVersion: "1.0.0",
  routerVersion: "law-change-routing-v1",
  taxonomyVersion: taxonomy.taxonomyVersion,
  taxonomyContentHash,
  prompts: Object.fromEntries(Object.entries(prompts).map(([key, prompt]) => [key, { version: prompt.version, contentHash: prompt.contentHash }])),
  runtime: { ...models, concurrency: runtime.concurrency },
  asOf: args.asOf,
  publicationApproved: false,
  sentToAssessors: false,
  // false when a stage failed: every count and list below then covers only
  // the subjects finished before the failure, and no package was built.
  completed: runFailure === null,
  failure: runFailure,
  sample: args.samplePromises !== null || args.sampleChanges !== null ? { samplePromises: args.samplePromises, sampleChanges: args.sampleChanges } : null,
  counts,
  tokenUsageByStage: Object.fromEntries(Object.entries(usage).map(([key, entries]) => [key, usageTotalsByModel(entries)])),
  lawChanges: screenedChanges.map(({ change, substantive, route, screenerA, screenerB, screenerAError, screenerBError }) => ({
    changeId: change.changeId,
    printNumber: change.printNumber,
    heading: change.heading,
    titleCz: change.titleCz,
    acts: change.acts,
    addedIn: change.addedIn,
    versions: Object.fromEntries(Object.entries(change.versions).map(([version, entry]) => [version, entry.removed ? "removed" : entry.sameAs ? `same as ${entry.sameAs}` : entry.textCz === null ? "title only" : `${entry.textCz.length} characters`])),
    substantive,
    screenerA,
    screenerB,
    screenerAError,
    screenerBError,
    route
  })),
  relevanceChecks: checkedPairs.map(({ promise, change, kept, checkA, checkB, checkAError, checkBError, route }) => ({
    promiseId: promise.id,
    changeId: change.changeId,
    routeBasis: route.routeBasis,
    matchedTagIds: route.matchedTagIds,
    kept,
    checkA,
    checkB,
    checkAError,
    checkBError
  })),
  // Law changes left out because both assessors of an earlier assessment
  // found them not relevant, with both reasons.
  excludedLawChanges,
  builtPackages
};

await writeJsonAtomically(resolve(outputDirectory, "topic-routing-report.json"), report);
const markdown = [
  "# Law-change routing report (unpublished)",
  "",
  `As of ${args.asOf}. Taxonomy ${taxonomy.taxonomyVersion}; prompts ${Object.values(prompts).map(({ version }) => version).join(", ")}.`,
  "",
  ...(runFailure ? [`**RUN FAILED at stage "${runFailure.stage}"**: ${runFailure.message}`, "", "The counts cover only the subjects finished before the failure; no package was built.", ""] : []),
  ...(report.sample ? [`**Sample run**: promises limited to ${report.sample.samplePromises ?? "all"}, law changes to ${report.sample.sampleChanges ?? "all"}.`, ""] : []),
  "| Metric | Count |",
  "| --- | --- |",
  ...Object.entries(counts).map(([key, value]) => `| ${key} | ${value} |`),
  "",
  "Packages in evidence-packages/ are queued for assessment. This report was not sent to any assessor and changes no public data."
].join("\n");
await writeFile(resolve(outputDirectory, "topic-routing-report.md"), `${markdown}\n`);
console.log(JSON.stringify({ outputDirectory, ...counts, completed: report.completed }, null, 2));

if (runFailure) throw new Error(`Law-change routing failed at stage "${runFailure.stage}": ${runFailure.message}`);
