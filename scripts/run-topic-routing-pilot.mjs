import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { sha256 } from "./lib/collector-core.mjs";
import { loadPublishedPromiseIds, publishedMatchingRegistry } from "./lib/published-promises.mjs";
import { buildPromiseTaggingBrief, buildSourceTaggingBrief, loadTaggingPrompt, requestTagAssignment, taggingRuntimeConfig } from "./lib/topic-tagger.mjs";
import { directLegalIdentifierIndex, validateTaxonomy } from "./lib/topic-taxonomy.mjs";
import { validatePromiseRegistry } from "./lib/evidence-matcher.mjs";
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
    output: "automation/runs/pipeline/topic-routing-pilot"
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
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun, "--collector-run is required");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(options.asOf ?? ""), "--as-of must use YYYY-MM-DD");
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

function emptyTagCache(taxonomyVersion, promptContentHash) {
  return { schemaVersion: "1.0.0", taxonomyVersion, promptContentHash, assignments: {} };
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
 * response: the exact brief content, the taxonomy version, the prompt
 * content (not just its version filename), the provider, and both
 * configured models. Any change invalidates the cache entry rather than
 * silently reusing a stale assignment.
 */
function cacheFingerprintMatches(cached, { inputHash, taxonomy, prompt, runtime }) {
  return Boolean(cached)
    && cached.inputHash === inputHash
    && cached.taxonomyVersion === taxonomy.taxonomyVersion
    && cached.promptContentHash === prompt.contentHash
    && cached.provider === runtime.provider
    && cached.modelA === runtime.modelA
    && cached.modelB === runtime.modelB;
}

async function taggedTwice({ subjectId, inputHash, brief, taxonomy, prompt, runtime, cache }) {
  const cached = cache.assignments[subjectId];
  if (cacheFingerprintMatches(cached, { inputHash, taxonomy, prompt, runtime })) {
    return { taggerA: cached.taggerA, taggerB: cached.taggerB, provider: cached.provider, modelA: cached.modelA, modelB: cached.modelB, usageByModel: [], reused: true };
  }
  const [taggerA, taggerB] = await Promise.all([
    requestTagAssignment({ provider: runtime.provider, apiKey: apiKeyFor(runtime.provider), model: runtime.modelA, brief, taxonomy, prompt }),
    requestTagAssignment({ provider: runtime.provider, apiKey: apiKeyFor(runtime.provider), model: runtime.modelB, brief, taxonomy, prompt })
  ]);
  cache.assignments[subjectId] = {
    inputHash,
    taxonomyVersion: taxonomy.taxonomyVersion,
    promptContentHash: prompt.contentHash,
    provider: runtime.provider,
    modelA: runtime.modelA,
    modelB: runtime.modelB,
    taggerA: taggerA.output,
    taggerB: taggerB.output
  };
  return {
    taggerA: taggerA.output,
    taggerB: taggerB.output,
    provider: runtime.provider,
    modelA: taggerA.model,
    modelB: taggerB.model,
    usageByModel: [{ model: taggerA.model, usage: taggerA.usage }, { model: taggerB.model, usage: taggerB.usage }].filter((entry) => entry.usage),
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
  for (const value of payloadValues) {
    const tagIds = directIdIndex.get(value);
    if (!tagIds) continue;
    const promiseIds = new Set();
    for (const tagId of tagIds) {
      for (const promiseId of invertedIndex.get(tagId) ?? []) promiseIds.add(promiseId);
    }
    if (promiseIds.size > 0) {
      return { promiseIds: [...promiseIds], reason: `matched-legal-identifier:${value}` };
    }
  }
  return null;
}

const args = parseArgs(process.argv.slice(2));
const runtime = taggingRuntimeConfig();
invariant(Number.isInteger(runtime.concurrency) && runtime.concurrency > 0 && runtime.concurrency <= 16, "SLIBY_TAGGING_CONCURRENCY must be an integer from 1 to 16");
const prompt = await loadTaggingPrompt();
const taxonomy = validateTaxonomy(JSON.parse(await readFile(resolve(args.taxonomy), "utf8")));
const directIdIndex = directLegalIdentifierIndex(taxonomy);

const registry = validatePromiseRegistry(JSON.parse(await readFile(resolve(args.promiseRegistry), "utf8")));
const publishedRegistry = publishedMatchingRegistry(registry, await loadPublishedPromiseIds(args.publishedPromises));

const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
const cutoff = `${args.asOf}T23:59:59.999Z`;
const materialPrimaryRecords = collectorRun.records.filter((record) => record.primary === true && (!record.occurredAt || record.occurredAt <= cutoff));

const enrichedExcerptsByRecordId = args.enrichedExcerpts ? await readJsonIfExists(resolve(args.enrichedExcerpts), {}) : {};

const promiseTagCachePath = resolve(args.tagCache, "promise-tags.json");
const sourceTagCachePath = resolve(args.tagCache, "source-tags.json");
const promiseTagCache = await readJsonIfExists(promiseTagCachePath, emptyTagCache(taxonomy.taxonomyVersion, prompt.contentHash));
const sourceTagCache = await readJsonIfExists(sourceTagCachePath, emptyTagCache(taxonomy.taxonomyVersion, prompt.contentHash));

const promiseTaggingUsageByModel = [];
let agreedPromiseAssignmentCount = 0;

const promiseTopicAssignments = await mapWithConcurrency(publishedRegistry.promises, runtime.concurrency, async (promise) => {
  const inputHash = sha256({ id: promise.id, originalTextCz: promise.originalTextCz, atomicClaimCz: promise.atomicClaimCz, fulfillmentTest: promise.fulfillmentTest, contradictionTest: promise.contradictionTest });
  const brief = buildPromiseTaggingBrief(promise, taxonomy);
  const tagged = await taggedTwice({ subjectId: promise.id, inputHash, brief, taxonomy, prompt, runtime, cache: promiseTagCache });
  promiseTaggingUsageByModel.push(...tagged.usageByModel);
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
const evidenceItemsByPromise = new Map();

const sourceRouting = await mapWithConcurrency(materialPrimaryRecords, runtime.concurrency, async (record) => {
  const enrichedExcerpts = enrichedExcerptsByRecordId[record.id] ?? [];
  const inputHash = sha256({ id: record.id, title: record.title, publisher: record.publisher, kind: record.kind, payload: record.payload, enrichedExcerpts });
  const brief = buildSourceTaggingBrief(record, enrichedExcerpts, taxonomy);
  const tagged = await taggedTwice({ subjectId: record.id, inputHash, brief, taxonomy, prompt, runtime, cache: sourceTagCache });
  sourceTaggingUsageByModel.push(...tagged.usageByModel);

  const directLink = deriveDirectLink(taxonomy, record, directIdIndex, invertedIndex);
  const route = routeSourceRecord({
    taxonomy,
    record,
    taggerA: tagged.taggerA,
    taggerB: tagged.taggerB,
    invertedIndex,
    directLink,
    semanticDiscoveryPromiseIds: []
  });
  return { route, tagged, inputHash };
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
      items.push({ recordId: record.id, primary: record.primary === true, factSummary: record.title, structuredFacts: record.payload });
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
  promptVersion: prompt.version,
  promptContentHash: prompt.contentHash,
  // Kept alongside the per-subject provider/model fields below so the
  // active runtime configuration is auditable from this artifact alone
  // even on a fully-cached run, where tokenUsageByPass is empty.
  runtime: { provider: runtime.provider, modelA: runtime.modelA, modelB: runtime.modelB, concurrency: runtime.concurrency },
  asOf: args.asOf,
  publicationApproved: false,
  sentToAssessors: false,
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
    predictedPackageCount: predictedPackages.filter((pkg) => pkg.predicted).length
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
  sourceTagAssignments: sourceRouting.map(({ route, tagged, inputHash }) => ({
    recordId: route.recordId,
    inputHash,
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
  `| Metric | Count |`,
  `| --- | --- |`,
  ...Object.entries(report.counts).map(([key, value]) => `| ${key} | ${value} |`),
  ``,
  `Expected assessor budget (planning estimate): ${report.expectedAssessorBudget.predictedPackageCount} package(s) x ${report.expectedAssessorBudget.assessorCallsPerPackage} assessor calls, ~${report.expectedAssessorBudget.estimatedAssessorInputTokensTotal} input tokens total.`,
  ``,
  `This report is unpublished operational audit data. It was not sent to any assessor or arbiter, and it does not change public data.`
].join("\n");
await writeFile(resolve(outputDirectory, "topic-routing-pilot-report.md"), `${markdown}\n`);

await writeJsonAtomically(promiseTagCachePath, promiseTagCache);
await writeJsonAtomically(sourceTagCachePath, sourceTagCache);

console.log(JSON.stringify({ outputDirectory, ...report.counts }, null, 2));
