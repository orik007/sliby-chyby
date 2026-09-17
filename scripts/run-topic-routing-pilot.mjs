import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { sha256 } from "./lib/collector-core.mjs";
import { loadPublishedPromiseIds, publishedMatchingRegistry } from "./lib/published-promises.mjs";
import { buildPromiseTaggingBrief, buildSourceTaggingBrief, loadTaggingPrompt, requestTagAssignment, taggingRuntimeConfig } from "./lib/topic-tagger.mjs";
import { validateTaxonomy } from "./lib/topic-taxonomy.mjs";
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

function emptyTagCache(taxonomyVersion, promptVersion) {
  return { schemaVersion: "1.0.0", taxonomyVersion, promptVersion, assignments: {} };
}

async function taggedTwice({ subjectId, inputHash, brief, taxonomy, prompt, runtime, cache }) {
  const cached = cache.assignments[subjectId];
  if (cached && cached.inputHash === inputHash && cached.taxonomyVersion === taxonomy.taxonomyVersion && cached.promptVersion === prompt.version) {
    return { taggerA: cached.taggerA, taggerB: cached.taggerB, usage: [], reused: true };
  }
  const [taggerA, taggerB] = await Promise.all([
    requestTagAssignment({ provider: runtime.provider, apiKey: apiKeyFor(runtime.provider), model: runtime.modelA, brief, taxonomy, prompt }),
    requestTagAssignment({ provider: runtime.provider, apiKey: apiKeyFor(runtime.provider), model: runtime.modelB, brief, taxonomy, prompt })
  ]);
  cache.assignments[subjectId] = { inputHash, taxonomyVersion: taxonomy.taxonomyVersion, promptVersion: prompt.version, taggerA: taggerA.output, taggerB: taggerB.output };
  return { taggerA: taggerA.output, taggerB: taggerB.output, usage: [taggerA.usage, taggerB.usage].filter(Boolean), reused: false };
}

const args = parseArgs(process.argv.slice(2));
const runtime = taggingRuntimeConfig();
const prompt = await loadTaggingPrompt();
const taxonomy = validateTaxonomy(JSON.parse(await readFile(resolve(args.taxonomy), "utf8")));

const registry = validatePromiseRegistry(JSON.parse(await readFile(resolve(args.promiseRegistry), "utf8")));
const publishedRegistry = publishedMatchingRegistry(registry, await loadPublishedPromiseIds(args.publishedPromises));

const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
const cutoff = `${args.asOf}T23:59:59.999Z`;
const materialPrimaryRecords = collectorRun.records.filter((record) => record.primary === true && (!record.occurredAt || record.occurredAt <= cutoff));

const promiseTagCachePath = resolve(args.tagCache, "promise-tags.json");
const sourceTagCachePath = resolve(args.tagCache, "source-tags.json");
const promiseTagCache = await readJsonIfExists(promiseTagCachePath, emptyTagCache(taxonomy.taxonomyVersion, prompt.version));
const sourceTagCache = await readJsonIfExists(sourceTagCachePath, emptyTagCache(taxonomy.taxonomyVersion, prompt.version));

const promiseTaggingUsage = [];
const promiseTopicAssignments = [];
let agreedPromiseAssignmentCount = 0;

for (const promise of publishedRegistry.promises) {
  const inputHash = sha256({ id: promise.id, originalTextCz: promise.originalTextCz, atomicClaimCz: promise.atomicClaimCz, fulfillmentTest: promise.fulfillmentTest, contradictionTest: promise.contradictionTest });
  const brief = buildPromiseTaggingBrief(promise, taxonomy);
  const tagged = await taggedTwice({ subjectId: promise.id, inputHash, brief, taxonomy, prompt, runtime, cache: promiseTagCache });
  promiseTaggingUsage.push(...tagged.usage);
  const derived = derivePromiseTopicTags(taxonomy, tagged.taggerA, tagged.taggerB);
  if (!derived.needsReview) agreedPromiseAssignmentCount += 1;
  promiseTopicAssignments.push({ promiseId: promise.id, tagAssignment: { tags: derived.tags.length > 0 ? derived.tags : ["unknown"] }, needsReview: derived.needsReview });
}

const invertedIndex = buildInvertedIndex(taxonomy, promiseTopicAssignments);

const sourceTaggingUsage = [];
let directAssignmentCount = 0;
let agreedSourceAssignmentCount = 0;
let routingReviewCount = 0;
let orphanReviewCount = 0;
let candidateCreatedCount = 0;
let candidateRelationshipCount = 0;
const evidenceItemsByPromise = new Map();
const routingDecisions = [];

for (const record of materialPrimaryRecords) {
  const inputHash = sha256({ id: record.id, title: record.title, payload: record.payload });
  const brief = buildSourceTaggingBrief(record, [], taxonomy);
  const tagged = await taggedTwice({ subjectId: record.id, inputHash, brief, taxonomy, prompt, runtime, cache: sourceTagCache });
  sourceTaggingUsage.push(...tagged.usage);

  const route = routeSourceRecord({
    taxonomy,
    record,
    taggerA: tagged.taggerA,
    taggerB: tagged.taggerB,
    invertedIndex,
    directLink: null,
    semanticDiscoveryPromiseIds: []
  });
  routingDecisions.push(route);

  if (route.routeBasis.includes("direct-structural-link")) directAssignmentCount += 1;
  if (route.reason === "taggers-agree-on-specific-tag") agreedSourceAssignmentCount += 1;
  if (route.disposition === "routing-review") routingReviewCount += 1;
  if (route.disposition === "orphan-review") orphanReviewCount += 1;
  if (route.disposition === "candidate-created") {
    candidateCreatedCount += 1;
    candidateRelationshipCount += route.candidatePromiseIds.length;
    for (const promiseId of route.candidatePromiseIds) {
      const items = evidenceItemsByPromise.get(promiseId) ?? [];
      items.push({ recordId: record.id, primary: record.primary === true, factSummary: record.title, structuredFacts: record.payload });
      evidenceItemsByPromise.set(promiseId, items);
    }
  }
}

const predictedPackages = [...evidenceItemsByPromise.entries()].map(([promiseId, items]) => predictBoundedPackage({ promiseId, routedEvidenceItems: items }));

function sumUsage(usages, field) {
  return usages.reduce((total, usage) => total + (usage?.[field] ?? 0), 0);
}

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = resolve(args.output, runId);
await mkdir(outputDirectory, { recursive: true });

const report = {
  schemaVersion: "1.0.0",
  pilotVersion: "topic-routing-pilot-v1",
  taxonomyVersion: taxonomy.taxonomyVersion,
  promptVersion: prompt.version,
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
    promiseTagging: { model: runtime.modelA, inputTokens: sumUsage(promiseTaggingUsage, "input_tokens"), outputTokens: sumUsage(promiseTaggingUsage, "output_tokens") },
    sourceTagging: { model: runtime.modelA, inputTokens: sumUsage(sourceTaggingUsage, "input_tokens"), outputTokens: sumUsage(sourceTaggingUsage, "output_tokens") }
  },
  predictedPackages,
  routingDecisions
};

await writeFile(resolve(outputDirectory, "topic-routing-pilot-report.json"), `${JSON.stringify(report, null, 2)}\n`);
const markdown = [
  `# Topic-routing pilot report (unpublished)`,
  ``,
  `As of ${args.asOf}. Taxonomy ${taxonomy.taxonomyVersion}, prompt ${prompt.version}.`,
  ``,
  `| Metric | Count |`,
  `| --- | --- |`,
  ...Object.entries(report.counts).map(([key, value]) => `| ${key} | ${value} |`),
  ``,
  `This report is unpublished operational audit data. It was not sent to any assessor or arbiter, and it does not change public data.`
].join("\n");
await writeFile(resolve(outputDirectory, "topic-routing-pilot-report.md"), `${markdown}\n`);

await writeJsonAtomically(promiseTagCachePath, promiseTagCache);
await writeJsonAtomically(sourceTagCachePath, sourceTagCache);

console.log(JSON.stringify({ outputDirectory, ...report.counts }, null, 2));
