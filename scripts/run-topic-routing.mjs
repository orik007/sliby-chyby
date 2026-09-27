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
  relevanceInput,
  requestRelevance,
  requestScreening,
  validateRelevanceOutput,
  validateScreeningOutput
} from "./lib/law-change-screening.mjs";
import { directLegalIdentifierIndex, taxonomyHash } from "./lib/topic-taxonomy.mjs";
import { isPotentiallyAttributable } from "./lib/attribution.mjs";
import { buildInvertedIndex, routeLawChange } from "./lib/topic-routing.mjs";
import { attributableConductOnChange, buildLawChangeEvidencePackage, lawChangesAtCutoff } from "./lib/topic-evidence-package.mjs";
import { loadAssessmentPrompts, maxRequestInputTokens } from "./lib/assessment-config.mjs";
import { cachePersister, loadModelCache, mapWithConcurrency, pairedModelCall, usageTotalsByModel, writeJsonAtomically } from "./lib/paired-model-calls.mjs";
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
    tagCache: "automation/topic-routing/tag-cache",
    asOf: null,
    output: "automation/runs/pipeline/topic-routing",
    samplePromises: null,
    sampleChanges: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--print-parts") options.printParts = args[++index];
    else if (arg === "--tag-cache") options.tagCache = args[++index];
    else if (arg === "--as-of") options.asOf = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--sample-promises") options.samplePromises = Number(args[++index]);
    else if (arg === "--sample-changes") options.sampleChanges = Number(args[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun && options.printParts, "--collector-run and --print-parts are required");
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

function recordPrintIds(record) {
  const payload = record.payload ?? {};
  return [...new Set([
    ...(payload.externalPrintId ? [String(payload.externalPrintId)] : []),
    ...(payload.linkedPrints ?? []).map(({ externalPrintId }) => String(externalPrintId))
  ])];
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
const cutoff = `${args.asOf}T23:59:59.999Z`;
const trackedPartyIds = [...new Set(promises.map(({ partyId }) => partyId))].sort();
const primaryRecordsInWindow = collectorRun.records.filter((record) => record.primary === true && (!record.occurredAt || record.occurredAt <= cutoff));
// Only records that can be attributable conduct of a tracked party continue;
// they link law changes to the party's votes and submissions.
const conductRecords = primaryRecordsInWindow.filter((record) => isPotentiallyAttributable(record, trackedPartyIds));
const recordsByPrintId = new Map();
for (const record of conductRecords) {
  for (const printId of recordPrintIds(record)) recordsByPrintId.set(printId, [...(recordsByPrintId.get(printId) ?? []), record]);
}
// A law change is dated by the earliest official record of its print.
const printFirstSeenOn = new Map();
for (const record of primaryRecordsInWindow) {
  const date = String(record.occurredAt ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
  for (const printId of recordPrintIds(record)) {
    if (!printFirstSeenOn.has(printId) || date < printFirstSeenOn.get(printId)) printFirstSeenOn.set(printId, date);
  }
}
let changes = lawChangesAtCutoff(Object.entries(printParts.prints)
  .filter(([printId]) => recordsByPrintId.has(printId))
  .flatMap(([, print]) => print.changes), recordsByPrintId);
if (args.sampleChanges !== null) changes = changes.slice(0, args.sampleChanges);

const cachePaths = {
  screening: resolve(args.tagCache, "law-change-screening.jsonl"),
  relevance: resolve(args.tagCache, "relevance-checks.jsonl")
};
const caches = {
  screening: await loadModelCache(cachePaths.screening),
  relevance: await loadModelCache(cachePaths.relevance)
};
const persist = Object.fromEntries(Object.entries(caches).map(([key, cache]) => [key, cachePersister(cache)]));
const models = { provider: runtime.provider, modelA: runtime.modelA, modelB: runtime.modelB };
const usage = { screening: [], relevance: [] };
const invalid = { screening: 0, relevance: 0 };
let runFailure = null;

async function stage(name, items, worker, onDone) {
  if (runFailure) return [];
  try {
    return await mapWithConcurrency(items, runtime.concurrency, worker, onDone);
  } catch (error) {
    runFailure = { stage: name, message: error.message };
    return error.partialResults ?? [];
  }
}

// 1. Screening and routing of every law change (steps 4 and 5).
log(`law-change screening: ${changes.length} law changes from ${new Set(changes.map(({ printId }) => printId)).size} prints with attributable conduct`);
const tickChanges = progress("law-change screening", changes.length, { every: 20 });
const screenedChanges = await stage("law-change-screening", changes, async (change) => {
  const brief = buildScreeningBrief(change, taxonomy);
  const fingerprint = { inputHash: sha256(brief.text), taxonomyContentHash, promptContentHash: prompts.screening.contentHash, ...models };
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
}, ({ change, route }) => tickChanges(`${change.changeId} (${change.titleCz.slice(0, 60)}): ${route.disposition}${route.routedTo.length > 0 ? ` to ${route.routedTo.length} promise(s)` : ""}`));

// A promise and a routed law change continue only when the promise's party
// has attributable conduct on the change's print.
const pairs = [];
let routedWithoutConductCount = 0;
for (const { change, route } of screenedChanges) {
  for (const target of route.routedTo) {
    const promise = promiseById.get(target.promiseId);
    if (!promise) continue;
    if (attributableConductOnChange(recordsByPrintId.get(change.printId) ?? [], promise, change).length === 0) {
      routedWithoutConductCount += 1;
      continue;
    }
    pairs.push({ promise, change, route: target });
  }
}

// 2. Relevance of each promise and law change (step 6).
log(`relevance checks: ${pairs.length} promise and law-change pairs`);
const tickPairs = progress("relevance checks", pairs.length, { every: 50 });
const checkedPairs = await stage("relevance-check", pairs, async (pair) => {
  const brief = buildRelevanceBrief(pair.promise, pair.change);
  const fingerprint = { inputHash: sha256(relevanceInput(brief)), promptContentHash: prompts.relevance.contentHash, ...models };
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
  return { ...pair, kept: isKeptByRelevance(checked.a, checked.b), checkA: checked.a, checkB: checked.b, checkAError: checked.errorA, checkBError: checked.errorB };
}, ({ promise, change, kept }) => tickPairs(`${promise.id} × ${change.changeId}: ${kept ? "kept" : "dropped"}`));

// 3. One package per promise (step 7), only from a complete run.
const outputDirectory = resolve(args.output);
const packageDirectory = resolve(outputDirectory, "evidence-packages");
await mkdir(packageDirectory, { recursive: true });
const builtPackages = [];
if (!runFailure) {
  const keptByPromise = new Map();
  for (const pair of checkedPairs.filter(({ kept }) => kept)) {
    keptByPromise.set(pair.promise.id, [...(keptByPromise.get(pair.promise.id) ?? []), { change: pair.change, route: pair.route }]);
  }
  log(`building evidence packages for ${keptByPromise.size} promises`);
  const collectorRunHash = sha256(collectorRun);
  const assessorInstructions = (await loadAssessmentPrompts()).assessor.instructions;
  for (const [promiseId, keptChanges] of [...keptByPromise].sort(([left], [right]) => left.localeCompare(right))) {
    const evidencePackage = buildLawChangeEvidencePackage({ promise: promiseById.get(promiseId), keptChanges, recordsByPrintId, printFirstSeenOn, collectorRun, collectorRunHash, asOf: args.asOf, assessorInstructions });
    if (!evidencePackage) continue;
    await writeFile(resolve(packageDirectory, `${promiseId}.json`), `${JSON.stringify(evidencePackage, null, 2)}\n`, { flag: "wx" });
    builtPackages.push({ promiseId, lawChangeCount: evidencePackage.generation.lawChangeCount, conductCount: evidencePackage.generation.conductCount, estimatedTokens: evidencePackage.generation.estimatedTokens, oversized: evidencePackage.generation.oversized });
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
  relevancePairCount: pairs.length,
  relevanceKeptCount: checkedPairs.filter(({ kept }) => kept).length,
  relevanceDroppedCount: checkedPairs.filter(({ kept }) => !kept).length,
  packageCount: builtPackages.length,
  oversizedPackageCount: builtPackages.filter(({ oversized }) => oversized).length,
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
