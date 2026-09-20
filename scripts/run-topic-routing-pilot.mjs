import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { sha256 } from "./lib/collector-core.mjs";
import { loadPublishedPromiseIds, publishedMatchingRegistry } from "./lib/published-promises.mjs";
import { buildPromiseTaggingBrief, buildSourceTaggingBrief, loadTaggingPrompt, requestTagAssignment, TagValidationError, taggingRuntimeConfig, validateTagAssignmentOutput } from "./lib/topic-tagger.mjs";
import { directLegalIdentifierIndex, taxonomyHash, validateTaxonomy } from "./lib/topic-taxonomy.mjs";
import { normalizedStructuredFacts, validatePromiseRegistry } from "./lib/evidence-matcher.mjs";
import { buildInvertedIndex, derivePromiseTopicTags, routeSourceRecord } from "./lib/topic-routing.mjs";
import { predictBoundedPackage } from "./lib/topic-evidence-package.mjs";

const envPath = resolve(".env");
if (existsSync(envPath)) loadEnvFile(envPath);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(args) {
  const options = {
    collectorRun: null,
    taxonomy: "automation/topic-routing/taxonomy-v1.json",
    promiseRegistry: "automation/matching/promises.json",
    publishedPromises: "data/promises",
    tagCache: "automation/topic-routing/pilot-cache",
    enrichedExcerpts: null,
    asOf: null,
    output: "automation/runs/pipeline/topic-routing-pilot",
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
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
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
    if (error instanceof TagValidationError) return { response: null, error: error.message };
    throw error;
  }
}

async function taggedTwice({ subjectId, inputHash, brief, taxonomy, taxonomyContentHash, prompt, runtime, cache }) {
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
    modelA: attemptA.response?.model ?? runtime.modelA,
    modelB: attemptB.response?.model ?? runtime.modelB,
    usageByModel: [attemptA.response, attemptB.response].filter(Boolean).map(({ model, usage }) => ({ model, usage })).filter((entry) => entry.usage),
    invalidCount: (attemptA.error ? 1 : 0) + (attemptB.error ? 1 : 0),
    reused: false
  };
}

function collectStringValues(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, out);
  } else if (value && typeof value === "object") {
    for (const nested of Object.values(value)) collectStringValues(nested, out);
  }
  return out;
}

/**
 * Finds a direct structural link for a source record: any string value
 * anywhere in its own structured payload (including nested structures such
 * as a parliamentary vote's `linkedPrints`) that exactly matches a taxonomy
 * tag's configured legal identifier, resolved to promises that already hold
 * that tag as an *accepted* (not needsReview) promise-topic assignment.
 *
 * No collector currently normalizes a print or vote's own numbering into
 * the canonical `directLegalIdentifiers` scheme the taxonomy uses (e.g.
 * "cz-act-23-2017"), so this path does not yet fire against real collected
 * records -- that normalization is separate, collector-side follow-up work,
 * not something this pilot script can fabricate. It is exercised today only
 * by fixtures that already carry a matching identifier, and by any future
 * record a collector emits with one.
 */
function deriveDirectLink(taxonomy, record, directIdIndex, invertedIndex) {
  const payloadValues = collectStringValues(record.payload ?? {});
  const promiseIds = new Set();
  const matchedIdentifiers = [];
  for (const value of payloadValues) {
    const tagIds = directIdIndex.get(value);
    if (!tagIds) continue;
    let matchedAny = false;
    for (const tagId of tagIds) {
      for (const promiseId of invertedIndex.get(tagId) ?? []) {
        promiseIds.add(promiseId);
        matchedAny = true;
      }
    }
    if (matchedAny) matchedIdentifiers.push(value);
  }
  if (promiseIds.size === 0) return null;
  // Accumulates every matching identifier's promises rather than returning
  // on the first hit, so a record referencing more than one direct legal
  // identifier does not silently lose the relationships the later ones
  // would have added.
  return { promiseIds: [...promiseIds], reason: `matched-legal-identifiers:${matchedIdentifiers.join(", ")}` };
}

const args = parseArgs(process.argv.slice(2));
const runtime = taggingRuntimeConfig();
invariant(Number.isInteger(runtime.concurrency) && runtime.concurrency > 0 && runtime.concurrency <= 16, "SLIBY_TAGGING_CONCURRENCY must be an integer from 1 to 16");
const prompt = await loadTaggingPrompt();
const taxonomy = validateTaxonomy(JSON.parse(await readFile(resolve(args.taxonomy), "utf8")));
const taxonomyContentHash = taxonomyHash(taxonomy);
const directIdIndex = directLegalIdentifierIndex(taxonomy);

const registry = validatePromiseRegistry(JSON.parse(await readFile(resolve(args.promiseRegistry), "utf8")));
let publishedRegistry = publishedMatchingRegistry(registry, await loadPublishedPromiseIds(args.publishedPromises));
// A sample run trims the published set down to the first N promises
// (deterministic, not random) so a pilot run's model spend and output size
// stay bounded; the full set is used whenever no sample size is given.
if (args.samplePromises !== null) publishedRegistry = { ...publishedRegistry, promises: publishedRegistry.promises.slice(0, args.samplePromises) };
const promiseById = new Map(publishedRegistry.promises.map((promise) => [promise.id, promise]));

const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
const cutoff = `${args.asOf}T23:59:59.999Z`;
let materialPrimaryRecords = collectorRun.records.filter((record) => record.primary === true && (!record.occurredAt || record.occurredAt <= cutoff));
if (args.sampleRecords !== null) materialPrimaryRecords = materialPrimaryRecords.slice(0, args.sampleRecords);

const enrichedExcerptsByRecordId = args.enrichedExcerpts ? await readJsonIfExists(resolve(args.enrichedExcerpts), {}) : {};

const promiseTagCachePath = resolve(args.tagCache, "promise-tags.json");
const sourceTagCachePath = resolve(args.tagCache, "source-tags.json");
const promiseTagCache = await readJsonIfExists(promiseTagCachePath, emptyTagCache(taxonomy.taxonomyVersion, taxonomyContentHash, prompt.contentHash));
const sourceTagCache = await readJsonIfExists(sourceTagCachePath, emptyTagCache(taxonomy.taxonomyVersion, taxonomyContentHash, prompt.contentHash));

// Everything from here through the report write is wrapped so that any
// later failure -- a bad model response failing excerpt-grounding
// validation, a network error, a report-write IO error -- still persists
// whatever tagging work already completed, in the finally block below.
// Without this, a single failure near the end of a long run would discard
// every prior, already-paid-for model call held only in memory.
try {
  const promiseTaggingUsageByModel = [];
  let agreedPromiseAssignmentCount = 0;
  let invalidPromiseTaggerCount = 0;

  const promiseTopicAssignments = await mapWithConcurrency(publishedRegistry.promises, runtime.concurrency, async (promise) => {
    const inputHash = sha256({ id: promise.id, originalTextCz: promise.originalTextCz, atomicClaimCz: promise.atomicClaimCz, fulfillmentTest: promise.fulfillmentTest, contradictionTest: promise.contradictionTest, promiseSource: promise.promiseSource });
    const brief = buildPromiseTaggingBrief(promise, taxonomy);
    const tagged = await taggedTwice({ subjectId: promise.id, inputHash, brief, taxonomy, taxonomyContentHash, prompt, runtime, cache: promiseTagCache });
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
      // The full brief, not just IDs and hashes, so an acceptance reviewer
      // can verify a cited excerpt or reproduce a cache hit's classification
      // from this uploaded artifact alone.
      briefText: brief.text,
      inputHash
    };
  });
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

  const sourceRouting = await mapWithConcurrency(materialPrimaryRecords, runtime.concurrency, async (record) => {
    const enrichedExcerpts = enrichedExcerptsByRecordId[record.id] ?? [];
    const inputHash = sha256({ id: record.id, title: record.title, publisher: record.publisher, kind: record.kind, url: record.url, payload: record.payload, enrichedExcerpts });
    const brief = buildSourceTaggingBrief(record, enrichedExcerpts, taxonomy);
    const directLink = deriveDirectLink(taxonomy, record, directIdIndex, invertedIndex);

    if (directLink) {
      // Design doc step 4: "The robot first applies direct structural
      // mappings ... where deterministic signals do not make the assignment
      // safe, two independent taggers receive a bounded routing brief."
      // combineTaggerResults (scripts/lib/topic-routing.mjs) returns
      // auto-candidate unconditionally once a directLink is present, without
      // ever looking at taggerA/taggerB -- so there is nothing for either
      // paid tagger to add, and skipping them here saves two calls per hit.
      const route = routeSourceRecord({ taxonomy, record, taggerA: null, taggerB: null, invertedIndex, directLink, semanticDiscoveryPromiseIds: [] });
      return { route, tagged: { taggerA: null, taggerB: null, provider: null, modelA: null, modelB: null }, inputHash, briefText: brief.text };
    }

    const tagged = await taggedTwice({ subjectId: record.id, inputHash, brief, taxonomy, taxonomyContentHash, prompt, runtime, cache: sourceTagCache });
    sourceTaggingUsageByModel.push(...tagged.usageByModel);
    invalidSourceTaggerCount += tagged.invalidCount;

    const route = routeSourceRecord({
      taxonomy,
      record,
      taggerA: tagged.taggerA,
      taggerB: tagged.taggerB,
      invertedIndex,
      directLink: null,
      semanticDiscoveryPromiseIds: []
    });
    return { route, tagged, inputHash, briefText: brief.text };
  });

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
        const items = evidenceItemsByPromise.get(promiseId) ?? [];
        // Official-document excerpts are part of what the tagger actually
        // saw and what an eventual assessor package would carry; omitting
        // them here would understate predictBoundedPackage's token estimate.
        const officialDocumentExcerpts = enrichedExcerptsByRecordId[record.id] ?? [];
        // Mirrors the real package builder's evidence shape
        // (evidenceFromMatch in scripts/lib/evidence-matcher.mjs), which
        // drops a parliamentary vote's per-MP individualVotes and keeps only
        // this promise's party summary -- estimating from the raw collector
        // payload instead would systematically overstate the token budget.
        const structuredFacts = normalizedStructuredFacts(record, promiseById.get(promiseId)?.partyId);
        items.push({
          recordId: record.id,
          primary: record.primary === true,
          factSummary: record.title,
          structuredFacts: officialDocumentExcerpts.length > 0 ? { ...structuredFacts, officialDocumentExcerpts } : structuredFacts
        });
        evidenceItemsByPromise.set(promiseId, items);
      }
    }
  }

  const predictedPackages = [...evidenceItemsByPromise.entries()].map(([promiseId, items]) => predictBoundedPackage({ promiseId, routedEvidenceItems: items }));
  const estimatedAssessorInputTokensTotal = predictedPackages.reduce((total, pkg) => total + pkg.estimatedAssessorInputTokens, 0);

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

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDirectory = resolve(args.output, runId);
  await mkdir(outputDirectory, { recursive: true });

  const report = {
    schemaVersion: "1.0.0",
    pilotVersion: "topic-routing-pilot-v1",
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
    // null on a full run; set whenever --sample-promises/--sample-records
    // trimmed the input, so a reader of this report alone can tell it is
    // not the complete catalogue without cross-checking the invocation.
    sample: (args.samplePromises !== null || args.sampleRecords !== null)
      ? { samplePromises: args.samplePromises, sampleRecords: args.sampleRecords }
      : null,
    counts: {
      sourceRecordCount: collectorRun.records.length,
      materialPrimaryRecordCount: materialPrimaryRecords.length,
      promiseCount: publishedRegistry.promises.length,
      directAssignmentCount,
      agreedPromiseAssignmentCount,
      agreedSourceAssignmentCount,
      routingReviewCount,
      orphanReviewCount,
      candidateCreatedCount,
      candidateRelationshipCount,
      predictedPackageCount: predictedPackages.filter((pkg) => pkg.predicted).length,
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
    expectedAssessorBudget: {
      predictedPackageCount: predictedPackages.filter((pkg) => pkg.predicted).length,
      assessorCallsPerPackage: 2,
      estimatedAssessorInputTokensTotal,
      note: "Planning estimate only, per docs/topic-routing-design.md's token budget model. Does not include arbitration calls, which occur only on assessor disagreement."
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
      route
    })),
    predictedPackages
  };

  await writeFile(resolve(outputDirectory, "topic-routing-pilot-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = [
    `# Topic-routing pilot report (unpublished)`,
    ``,
    `As of ${args.asOf}. Taxonomy ${taxonomy.taxonomyVersion}, prompt ${prompt.version} (${prompt.contentHash.slice(0, 12)}).`,
    ``,
    ...(report.sample ? [`**Sample run** -- promises limited to ${report.sample.samplePromises ?? "all"}, records limited to ${report.sample.sampleRecords ?? "all"}. Not the full catalogue.`, ``] : []),
    `| Metric | Count |`,
    `| --- | --- |`,
    ...Object.entries(report.counts).map(([key, value]) => `| ${key} | ${value} |`),
    ``,
    `Expected assessor budget (planning estimate): ${report.expectedAssessorBudget.predictedPackageCount} package(s) x ${report.expectedAssessorBudget.assessorCallsPerPackage} assessor calls, ~${report.expectedAssessorBudget.estimatedAssessorInputTokensTotal} input tokens total.`,
    ``,
    `This report is unpublished operational audit data. It was not sent to any assessor or arbiter, and it does not change public data.`
  ].join("\n");
  await writeFile(resolve(outputDirectory, "topic-routing-pilot-report.md"), `${markdown}\n`);

  console.log(JSON.stringify({ outputDirectory, ...report.counts }, null, 2));

} finally {
  await writeJsonAtomically(promiseTagCachePath, promiseTagCache);
  await writeJsonAtomically(sourceTagCachePath, sourceTagCache);
}
