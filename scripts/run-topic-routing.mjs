import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { sha256 } from "./lib/collector-core.mjs";
import { loadPublishedPromiseIds, publishedPromiseRegistry } from "./lib/published-promises.mjs";
import { buildPromiseTaggingBrief, buildSourceTaggingBrief, loadTaggingPrompt, requestTagAssignment, TagValidationError, taggingRuntimeConfig, validateTagAssignmentOutput } from "./lib/topic-tagger.mjs";
import { directLegalIdentifierIndex, taxonomyHash, validateTaxonomy } from "./lib/topic-taxonomy.mjs";
import { isPotentiallyAttributable, validatePromiseRegistry } from "./lib/attribution.mjs";
import { buildInvertedIndex, deriveDirectLink, derivePromiseTopicTags, recordPrintIds, routeSourceRecord } from "./lib/topic-routing.mjs";
import { buildTopicEvidencePackage } from "./lib/topic-evidence-package.mjs";

const envPath = resolve(".env");
if (existsSync(envPath)) loadEnvFile(envPath);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(args) {
  const options = {
    collectorRun: null,
    taxonomy: "automation/topic-routing/taxonomy-v1.json",
    promiseRegistry: "automation/promise-registry/promises.json",
    publishedPromises: "data/promises",
    tagCache: "automation/topic-routing/tag-cache",
    enrichedExcerpts: null,
    printActs: null,
    asOf: null,
    output: "automation/runs/pipeline/topic-routing",
    samplePromises: null,
    sampleRecords: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--taxonomy") options.taxonomy = args[++index];
    else if (arg === "--promises") options.promiseRegistry = args[++index];
    else if (arg === "--published-promises") options.publishedPromises = args[++index];
    else if (arg === "--tag-cache") options.tagCache = args[++index];
    else if (arg === "--enriched-excerpts") options.enrichedExcerpts = args[++index];
    else if (arg === "--print-acts") options.printActs = args[++index];
    else if (arg === "--as-of") options.asOf = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--sample-promises") options.samplePromises = Number(args[++index]);
    else if (arg === "--sample-records") options.sampleRecords = Number(args[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun, "--collector-run is required");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(options.asOf ?? ""), "--as-of must use YYYY-MM-DD");
  invariant(options.samplePromises === null || (Number.isInteger(options.samplePromises) && options.samplePromises > 0), "--sample-promises must be a positive integer");
  invariant(options.sampleRecords === null || (Number.isInteger(options.sampleRecords) && options.sampleRecords > 0), "--sample-records must be a positive integer");
  return options;
}

function apiKeyFor(provider) {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  throw new Error(`No API-key mapping is configured for provider: ${provider}`);
}

async function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJsonAtomically(filePath, value) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = resolve(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function emptyTagCache(taxonomyVersion, taxonomyContentHash, promptContentHash) {
  return { schemaVersion: "1.0.0", taxonomyVersion, taxonomyContentHash, promptContentHash, assignments: {} };
}

// Mirrors scripts/run-assessment-batch.mjs's worker pool: process a bounded
// number of subjects at once instead of one at a time, so the configured
// SLIBY_TAGGING_CONCURRENCY actually bounds network fan-out.
//
// A transport/quota failure (not a TagValidationError -- see
// safeRequestTagAssignment) stops the whole pool rather than just that one
// subject, since it usually means every subsequent call would fail
// identically (an exhausted account has no credits for the next call
// either). But the subjects that already completed before that point are
// real, paid-for results -- discarding them, as a plain Promise.all would,
// is exactly what left a run with nothing to show after it failed partway
// through. The thrown error's `partialResults` carries them so the caller
// can still build an accurate report from whatever finished.
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let firstError = null;
  async function runWorker() {
    while (nextIndex < items.length && !firstError) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        firstError = error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  if (firstError) {
    const completedCount = results.filter((result) => result !== undefined).length;
    const aborted = new Error(`Aborted after ${completedCount}/${items.length} item(s): ${firstError.message}`);
    aborted.cause = firstError;
    aborted.partialResults = results.filter((result) => result !== undefined);
    throw aborted;
  }
  return results;
}

/**
 * The cache hit predicate must cover everything that could change a
 * response: the exact brief content, the full taxonomy content (not just
 * its version string -- a tag's aliases, examples, or eligibility flag can
 * change without a version bump), the prompt content (not just its version
 * filename), the provider, and both configured models. Any change
 * invalidates the cache entry rather than silently reusing a stale
 * assignment.
 */
function cacheFingerprintMatches(cached, { inputHash, taxonomyContentHash, prompt, runtime }) {
  return Boolean(cached)
    && cached.inputHash === inputHash
    && cached.taxonomyContentHash === taxonomyContentHash
    && cached.promptContentHash === prompt.contentHash
    && cached.provider === runtime.provider
    && cached.modelA === runtime.modelA
    && cached.modelB === runtime.modelB;
}

// A tagger call whose response fails validation (an invented tag id, or a
// supporting excerpt not present verbatim in the brief -- most likely a
// fabrication) must not crash the whole run: mirrors
// validateAssessmentAttempt in scripts/lib/assessment-pipeline.mjs, which
// the real daily assessment pipeline already relies on so one invalid
// output fails only that one item, per docs/evidence-pipeline.md step 8.
// Only a TagValidationError is caught here -- a network failure, an
// authentication or quota error, or any other transport/provider failure
// from requestTagAssignment must still fail the whole run loudly. Treating
// those the same as an invalid model output would let a missing API key or
// a full outage masquerade as a legitimate run that simply found nothing.
async function safeRequestTagAssignment(args) {
  try {
    return { response: await requestTagAssignment(args), error: null };
  } catch (error) {
    if (error instanceof TagValidationError) {
      // The paid call already happened -- requestTagAssignment attaches its
      // provider/model/usage to the error precisely so this isolated
      // failure still shows up in the run's token-usage totals instead of
      // silently vanishing from the spend estimate.
      return { response: null, error: error.message, provider: error.provider ?? null, model: error.model ?? null, usage: error.usage ?? null };
    }
    throw error;
  }
}

// Every newly cached assignment is written to disk at once (atomically and
// in order), so a run that is killed at any point keeps all tagging it has
// already paid for.
function cachePersister(filePath, cache) {
  let chain = Promise.resolve();
  return () => {
    chain = chain.then(() => writeJsonAtomically(filePath, cache));
    return chain;
  };
}

async function taggedTwice({ subjectId, inputHash, brief, taxonomy, taxonomyContentHash, prompt, runtime, cache, persistCache }) {
  const cached = cache.assignments[subjectId];
  if (cacheFingerprintMatches(cached, { inputHash, taxonomyContentHash, prompt, runtime })) {
    // Re-validate even a cache hit: the fingerprint guarantees the same
    // brief and taxonomy produced this assignment originally, but a
    // grounded `supportingExcerpts` claim must still be checked against
    // this exact brief text rather than trusted on faith from disk.
    return {
      taggerA: validateTagAssignmentOutput(cached.taggerA, taxonomy, brief.text),
      taggerB: validateTagAssignmentOutput(cached.taggerB, taxonomy, brief.text),
      provider: cached.provider,
      modelA: cached.modelA,
      modelB: cached.modelB,
      usageByModel: [],
      invalidCount: 0,
      taggerAError: null,
      taggerBError: null,
      reused: true
    };
  }
  const [attemptA, attemptB] = await Promise.all([
    safeRequestTagAssignment({ provider: runtime.provider, apiKey: apiKeyFor(runtime.provider), model: runtime.modelA, brief, taxonomy, prompt }),
    safeRequestTagAssignment({ provider: runtime.provider, apiKey: apiKeyFor(runtime.provider), model: runtime.modelB, brief, taxonomy, prompt })
  ]);
  // Only a fully successful pair is cached -- a subject with one invalid
  // side is retried in full next run rather than freezing the invalid half
  // in place, matching the "retried until it succeeds" pattern the real
  // evidence-pipeline enrichment step already follows.
  if (!attemptA.error && !attemptB.error) {
    cache.assignments[subjectId] = {
      inputHash,
      taxonomyContentHash,
      promptContentHash: prompt.contentHash,
      provider: runtime.provider,
      modelA: runtime.modelA,
      modelB: runtime.modelB,
      taggerA: attemptA.response.output,
      taggerB: attemptB.response.output
    };
    await persistCache();
  }
  return {
    // A null tagger output is exactly what isUnknown() (topic-routing.mjs)
    // already treats as an unclassified tagger, so an invalid response
    // degrades to the same "only one tagger classified" / "both unknown"
    // routing-review or orphan-review states a genuine model "unknown"
    // answer would -- never a silently created candidate.
    taggerA: attemptA.response?.output ?? null,
    taggerB: attemptB.response?.output ?? null,
    provider: runtime.provider,
    // A response object's own `.model` is preferred, but an invalid
    // attempt's `.model` (attached by requestTagAssignment's catch) is used
    // as the fallback before the merely-configured runtime.modelA/B, so the
    // report still names the model that actually produced the invalid
    // output rather than just what was requested.
    modelA: attemptA.response?.model ?? attemptA.model ?? runtime.modelA,
    modelB: attemptB.response?.model ?? attemptB.model ?? runtime.modelB,
    usageByModel: [attemptA.response ?? attemptA, attemptB.response ?? attemptB].map(({ model, usage }) => ({ model, usage })).filter((entry) => entry.usage),
    invalidCount: (attemptA.error ? 1 : 0) + (attemptB.error ? 1 : 0),
    taggerAError: attemptA.error,
    taggerBError: attemptB.error,
    reused: false
  };
}

const args = parseArgs(process.argv.slice(2));
const runtime = taggingRuntimeConfig();
invariant(Number.isInteger(runtime.concurrency) && runtime.concurrency > 0 && runtime.concurrency <= 16, "SLIBY_TAGGING_CONCURRENCY must be an integer from 1 to 16");
const prompt = await loadTaggingPrompt();
const taxonomy = validateTaxonomy(JSON.parse(await readFile(resolve(args.taxonomy), "utf8")));
const taxonomyContentHash = taxonomyHash(taxonomy);
const directIdIndex = directLegalIdentifierIndex(taxonomy);
// Legal identifiers of the acts each collected print amends
// (scripts/run-print-acts.mjs); they create direct structural links.
const printActs = args.printActs ? JSON.parse(await readFile(resolve(args.printActs), "utf8")) : { prints: {} };
invariant(printActs.prints && typeof printActs.prints === "object", "Invalid --print-acts file");

const registry = validatePromiseRegistry(JSON.parse(await readFile(resolve(args.promiseRegistry), "utf8")));
let publishedRegistry = publishedPromiseRegistry(registry, await loadPublishedPromiseIds(args.publishedPromises));
// A sample run trims the published set down to the first N promises
// (deterministic, not random) so a sample run's model spend and output size
// stay bounded; the full set is used whenever no sample size is given.
if (args.samplePromises !== null) publishedRegistry = { ...publishedRegistry, promises: publishedRegistry.promises.slice(0, args.samplePromises) };
const promiseById = new Map(publishedRegistry.promises.map((promise) => [promise.id, promise]));

const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
const cutoff = `${args.asOf}T23:59:59.999Z`;
// Only records that can be attributable conduct of a tracked party are routed
// and tagged; every other record could never reach an evidence package.
const trackedPartyIds = [...new Set(publishedRegistry.promises.map(({ partyId }) => partyId))].sort();
const primaryRecordsInWindow = collectorRun.records.filter((record) => record.primary === true && (!record.occurredAt || record.occurredAt <= cutoff));
let materialPrimaryRecords = primaryRecordsInWindow.filter((record) => isPotentiallyAttributable(record, trackedPartyIds));
if (args.sampleRecords !== null) materialPrimaryRecords = materialPrimaryRecords.slice(0, args.sampleRecords);

const enrichedExcerptsByRecordId = args.enrichedExcerpts ? await readJsonIfExists(resolve(args.enrichedExcerpts), {}) : {};

const promiseTagCachePath = resolve(args.tagCache, "promise-tags.json");
const sourceTagCachePath = resolve(args.tagCache, "source-tags.json");
const promiseTagCache = await readJsonIfExists(promiseTagCachePath, emptyTagCache(taxonomy.taxonomyVersion, taxonomyContentHash, prompt.contentHash));
const sourceTagCache = await readJsonIfExists(sourceTagCachePath, emptyTagCache(taxonomy.taxonomyVersion, taxonomyContentHash, prompt.contentHash));
const persistPromiseTagCache = cachePersister(promiseTagCachePath, promiseTagCache);
const persistSourceTagCache = cachePersister(sourceTagCachePath, sourceTagCache);

// Everything from here through the report write is wrapped so that any
// later failure -- a bad model response failing excerpt-grounding
// validation, a network error, a report-write IO error -- still persists
// whatever tagging work already completed, in the finally block below.
// Without this, a single failure near the end of a long run would discard
// every prior, already-paid-for model call held only in memory.
//
// A transport/quota failure inside either mapWithConcurrency call (a run out
// of API credits, a network outage -- anything that is not a per-subject
// TagValidationError) is caught here rather than left to abort the whole
// try block, specifically so the report built below still reflects however
// many subjects actually got tagged before the failure, instead of the run
// producing no report and no reusable cache at all.
let promiseTopicAssignments = [];
let sourceRouting = [];
let runFailure = null;

try {
  const promiseTaggingUsageByModel = [];
  let agreedPromiseAssignmentCount = 0;
  let invalidPromiseTaggerCount = 0;

  try {
    promiseTopicAssignments = await mapWithConcurrency(publishedRegistry.promises, runtime.concurrency, async (promise) => {
      const inputHash = sha256({ id: promise.id, originalTextCz: promise.originalTextCz, atomicClaimCz: promise.atomicClaimCz, fulfillmentTest: promise.fulfillmentTest, contradictionTest: promise.contradictionTest, promiseSource: promise.promiseSource });
      const brief = buildPromiseTaggingBrief(promise, taxonomy);
      const tagged = await taggedTwice({ subjectId: promise.id, inputHash, brief, taxonomy, taxonomyContentHash, prompt, runtime, cache: promiseTagCache, persistCache: persistPromiseTagCache });
      promiseTaggingUsageByModel.push(...tagged.usageByModel);
      invalidPromiseTaggerCount += tagged.invalidCount;
      const derived = derivePromiseTopicTags(taxonomy, tagged.taggerA, tagged.taggerB);
      return {
        promiseId: promise.id,
        tagAssignment: { tags: derived.tags.length > 0 ? derived.tags : ["unknown"] },
        needsReview: derived.needsReview,
        taggerA: tagged.taggerA,
        taggerB: tagged.taggerB,
        provider: tagged.provider,
        modelA: tagged.modelA,
        modelB: tagged.modelB,
        // Per-subject, not just an aggregate count: a reviewer needs to know
        // which promise's tagger call was invalid and why, not just that
        // invalidPromiseTaggerCount is non-zero somewhere in the run.
        taggerAError: tagged.taggerAError,
        taggerBError: tagged.taggerBError,
        // The full brief, not just IDs and hashes, so an acceptance reviewer
        // can verify a cited excerpt or reproduce a cache hit's classification
        // from this uploaded artifact alone.
        briefText: brief.text,
        inputHash
      };
    });
  } catch (error) {
    promiseTopicAssignments = error.partialResults ?? [];
    runFailure = { stage: "promise-tagging", message: error.message };
  }
  for (const assignment of promiseTopicAssignments) {
    if (!assignment.needsReview) agreedPromiseAssignmentCount += 1;
  }

  const invertedIndex = buildInvertedIndex(taxonomy, promiseTopicAssignments);

  const sourceTaggingUsageByModel = [];
  let directAssignmentCount = 0;
  let agreedSourceAssignmentCount = 0;
  let routingReviewCount = 0;
  let orphanReviewCount = 0;
  let candidateCreatedCount = 0;
  let candidateRelationshipCount = 0;
  let invalidSourceTaggerCount = 0;
  const evidenceItemsByPromise = new Map();

  // Promise tagging feeds invertedIndex, which source routing depends on --
  // if promise tagging already failed, source tagging would just fail
  // identically on its first call (the same exhausted account, the same
  // outage), so skip straight to the report instead of spending another
  // round of retries to learn that again.
  if (!runFailure) {
    try {
      sourceRouting = await mapWithConcurrency(materialPrimaryRecords, runtime.concurrency, async (record) => {
        const enrichedExcerpts = [
          ...(enrichedExcerptsByRecordId[record.id] ?? []),
          ...recordPrintIds(record).map((printId) => printActs.prints[printId]?.excerpt).filter(Boolean)
        ];
        const inputHash = sha256({ id: record.id, title: record.title, publisher: record.publisher, kind: record.kind, url: record.url, payload: record.payload, enrichedExcerpts });
        const brief = buildSourceTaggingBrief(record, enrichedExcerpts, taxonomy);
        const directLink = deriveDirectLink({ record, directIdIndex, invertedIndex, printIdentifiers: printActs.prints });

        if (directLink) {
          // Design doc step 4: "The robot first applies direct structural
          // mappings ... where deterministic signals do not make the assignment
          // safe, two independent taggers receive a bounded routing brief."
          // combineTaggerResults (scripts/lib/topic-routing.mjs) returns
          // auto-candidate unconditionally once a directLink is present, without
          // ever looking at taggerA/taggerB -- so there is nothing for either
          // paid tagger to add, and skipping them here saves two calls per hit.
          const route = routeSourceRecord({ taxonomy, record, taggerA: null, taggerB: null, invertedIndex, directLink });
          return { route, tagged: { taggerA: null, taggerB: null, provider: null, modelA: null, modelB: null, taggerAError: null, taggerBError: null }, inputHash, briefText: brief.text };
        }

        const tagged = await taggedTwice({ subjectId: record.id, inputHash, brief, taxonomy, taxonomyContentHash, prompt, runtime, cache: sourceTagCache, persistCache: persistSourceTagCache });
        sourceTaggingUsageByModel.push(...tagged.usageByModel);
        invalidSourceTaggerCount += tagged.invalidCount;

        const route = routeSourceRecord({
          taxonomy,
          record,
          taggerA: tagged.taggerA,
          taggerB: tagged.taggerB,
          invertedIndex,
          directLink: null
        });
        return { route, tagged, inputHash, briefText: brief.text };
      });
    } catch (error) {
      sourceRouting = error.partialResults ?? [];
      runFailure = { stage: "source-tagging", message: error.message };
    }
  }

  for (const { route, tagged, inputHash } of sourceRouting) {
    if (route.routeBasis.includes("direct-structural-link")) directAssignmentCount += 1;
    if (route.reason === "taggers-agree-on-specific-tag") agreedSourceAssignmentCount += 1;
    if (route.disposition === "routing-review") routingReviewCount += 1;
    if (route.disposition === "orphan-review") orphanReviewCount += 1;
    if (route.disposition === "candidate-created") {
      candidateCreatedCount += 1;
      candidateRelationshipCount += route.candidatePromiseIds.length;
      const record = materialPrimaryRecords.find(({ id }) => id === route.recordId);
      for (const promiseId of route.candidatePromiseIds) {
        const routedRecords = evidenceItemsByPromise.get(promiseId) ?? [];
        routedRecords.push({ record, routeBasis: route.routeBasis });
        evidenceItemsByPromise.set(promiseId, routedRecords);
      }
    }
  }

  function usageTotalsByModel(usageEntries) {
    const totals = new Map();
    for (const { model, usage } of usageEntries) {
      const current = totals.get(model) ?? { model, inputTokens: 0, outputTokens: 0 };
      current.inputTokens += usage?.input_tokens ?? 0;
      current.outputTokens += usage?.output_tokens ?? 0;
      totals.set(model, current);
    }
    return [...totals.values()];
  }

  const outputDirectory = resolve(args.output);
  const evidencePackageDirectory = resolve(outputDirectory, "evidence-packages");
  await mkdir(evidencePackageDirectory, { recursive: true });

  // A package is built for every promise with at least one routed record
  // that is attributable conduct; routing alone never establishes it.
  const builtPackages = [];
  for (const [promiseId, routedRecords] of evidenceItemsByPromise) {
    const promise = promiseById.get(promiseId);
    const evidencePackage = buildTopicEvidencePackage({ promise, routedRecords, collectorRun, asOf: args.asOf });
    if (!evidencePackage) {
      builtPackages.push({ promiseId, built: false, reason: "no-attributable-routed-evidence" });
      continue;
    }
    await writeFile(resolve(evidencePackageDirectory, `${promiseId}.json`), `${JSON.stringify(evidencePackage, null, 2)}\n`, { flag: "wx" });
    builtPackages.push({ promiseId, built: true, packageId: evidencePackage.packageId, selectedEvidenceCount: evidencePackage.generation.selectedPrimaryEvidenceCount });
  }

  const report = {
    schemaVersion: "1.0.0",
    routerVersion: "topic-routing-v1",
    taxonomyVersion: taxonomy.taxonomyVersion,
    taxonomyContentHash,
    promptVersion: prompt.version,
    promptContentHash: prompt.contentHash,
    // Kept alongside the per-subject provider/model fields below so the
    // active runtime configuration is auditable from this artifact alone
    // even on a fully-cached run, where tokenUsageByPass is empty.
    runtime: { provider: runtime.provider, modelA: runtime.modelA, modelB: runtime.modelB, concurrency: runtime.concurrency },
    asOf: args.asOf,
    publicationApproved: false,
    sentToAssessors: false,
    // false whenever a tagging stage aborted partway through (see
    // runFailure above) -- every count and array below still reflects
    // exactly the subjects that finished before that happened, not the full
    // catalogue, so a reader must check this before treating counts as
    // complete coverage.
    completed: runFailure === null,
    failure: runFailure,
    // null on a full run; set whenever --sample-promises/--sample-records
    // trimmed the input, so a reader of this report alone can tell it is
    // not the complete catalogue without cross-checking the invocation.
    sample: (args.samplePromises !== null || args.sampleRecords !== null)
      ? { samplePromises: args.samplePromises, sampleRecords: args.sampleRecords }
      : null,
    counts: {
      sourceRecordCount: collectorRun.records.length,
      primaryRecordsInWindowCount: primaryRecordsInWindow.length,
      notAttributableSkippedCount: primaryRecordsInWindow.length - materialPrimaryRecords.length,
      materialPrimaryRecordCount: materialPrimaryRecords.length,
      promiseCount: publishedRegistry.promises.length,
      directAssignmentCount,
      agreedPromiseAssignmentCount,
      agreedSourceAssignmentCount,
      routingReviewCount,
      orphanReviewCount,
      candidateCreatedCount,
      candidateRelationshipCount,
      packageCount: builtPackages.filter((pkg) => pkg.built).length,
      routedWithoutAttributableEvidenceCount: builtPackages.filter((pkg) => !pkg.built).length,
      // A tagger response that failed excerpt-grounding or tag-id validation
      // degrades to that side being treated as unknown (see taggedTwice)
      // rather than stopping the run; this count is how a reader notices
      // that degradation happened instead of it being silently invisible.
      invalidPromiseTaggerCount,
      invalidSourceTaggerCount
    },
    tokenUsageByPass: {
      promiseTagging: usageTotalsByModel(promiseTaggingUsageByModel),
      sourceTagging: usageTotalsByModel(sourceTaggingUsageByModel)
    },
    // Full per-subject assignment audit: this is what lets a human perform the
    // documented acceptance review from the artifact alone, including why a
    // relationship was or was not created.
    promiseTopicAssignments,
    sourceTagAssignments: sourceRouting.map(({ route, tagged, inputHash, briefText }) => ({
      recordId: route.recordId,
      inputHash,
      briefText,
      taggerA: tagged.taggerA,
      taggerB: tagged.taggerB,
      provider: tagged.provider,
      modelA: tagged.modelA,
      modelB: tagged.modelB,
      taggerAError: tagged.taggerAError,
      taggerBError: tagged.taggerBError,
      route
    })),
    builtPackages
  };

  await writeFile(resolve(outputDirectory, "topic-routing-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = [
    `# Topic-routing report (unpublished)`,
    ``,
    `As of ${args.asOf}. Taxonomy ${taxonomy.taxonomyVersion}, prompt ${prompt.version} (${prompt.contentHash.slice(0, 12)}).`,
    ``,
    ...(runFailure ? [`**RUN FAILED at stage "${runFailure.stage}"**: ${runFailure.message}`, ``, `Every count and array below reflects only the subjects that finished tagging before the failure, not the full catalogue.`, ``] : []),
    ...(report.sample ? [`**Sample run** -- promises limited to ${report.sample.samplePromises ?? "all"}, records limited to ${report.sample.sampleRecords ?? "all"}. Not the full catalogue.`, ``] : []),
    `| Metric | Count |`,
    `| --- | --- |`,
    ...Object.entries(report.counts).map(([key, value]) => `| ${key} | ${value} |`),
    ``,
    `Real, assessable evidence packages were written to evidence-packages/ for queueing. This report itself was not sent to any assessor or arbiter, and it does not change public data by itself.`
  ].join("\n");
  await writeFile(resolve(outputDirectory, "topic-routing-report.md"), `${markdown}\n`);

  console.log(JSON.stringify({ outputDirectory, ...report.counts, completed: report.completed }, null, 2));

} finally {
  await writeJsonAtomically(promiseTagCachePath, promiseTagCache);
  await writeJsonAtomically(sourceTagCachePath, sourceTagCache);
}

if (runFailure) {
  // The report above and the caches persisted in the finally block already
  // captured everything this run got done -- but a stage failure is still a
  // real failure (an exhausted account, an outage), and must still exit
  // non-zero so the workflow step and CI report it loudly instead of a
  // partial run looking like a clean success.
  throw new Error(`Topic routing failed at stage "${runFailure.stage}": ${runFailure.message}`);
}
