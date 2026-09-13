import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { semanticRetrievalRuntimeConfig } from "./lib/assessment-config.mjs";
import { sha256 } from "./lib/collector-core.mjs";
import { buildEvidencePackage, matchCollectorRecords, summarizeMatch, validatePromiseRegistry } from "./lib/evidence-matcher.mjs";
import { createEmbeddings } from "./lib/model-provider.mjs";
import { loadPublishedPromiseIds, publishedMatchingRegistry } from "./lib/published-promises.mjs";
import { emptySemanticIndex, planPromiseEmbeddings, pruneSemanticIndex, rankSemanticCandidates, semanticIndexHash, semanticIndexRequiresRebuild, semanticRecordText, updateSemanticIndex, validateSemanticIndex } from "./lib/semantic-retrieval.mjs";

const envPath = resolve(".env");
if (existsSync(envPath)) loadEnvFile(envPath);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(args) {
  const options = {
    collectorRun: null,
    promiseRegistry: "automation/matching/promises.json",
    publishedPromises: "data/promises",
    semanticIndex: "automation/semantic-index/promise-index.json",
    writeSemanticIndex: null,
    promiseIds: [],
    asOf: null,
    output: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--promises") options.promiseRegistry = args[++index];
    else if (arg === "--published-promises") options.publishedPromises = args[++index];
    else if (arg === "--semantic-index") options.semanticIndex = args[++index];
    else if (arg === "--write-semantic-index") options.writeSemanticIndex = args[++index];
    else if (arg === "--promise") options.promiseIds.push(args[++index]);
    else if (arg === "--as-of") options.asOf = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun, "--collector-run is required");
  invariant(options.semanticIndex, "--semantic-index is required");
  invariant(options.output, "--output is required");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(options.asOf ?? ""), "--as-of must use YYYY-MM-DD");
  invariant(options.promiseIds.every((id) => /^[a-z0-9-]+$/.test(id)), "--promise accepts lowercase stable IDs only");
  return options;
}

function apiKeyFor(provider) {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  throw new Error(`No API-key mapping is configured for provider: ${provider}`);
}

async function embedTexts({ runtime, inputs }) {
  const embeddings = [];
  const usages = [];
  for (let index = 0; index < inputs.length; index += 128) {
    const result = await createEmbeddings({
      provider: runtime.provider,
      apiKey: apiKeyFor(runtime.provider),
      model: runtime.model,
      dimensions: runtime.dimensions,
      inputs: inputs.slice(index, index + 128)
    });
    invariant(result.embeddings.every((embedding) => embedding.length === runtime.dimensions), "Embedding response dimensions differ from configured dimensions");
    embeddings.push(...result.embeddings);
    usages.push(result.usage);
  }
  return { embeddings, usages };
}

async function writeJsonAtomically(filePath, value) {
  const destination = resolve(filePath);
  const temporary = resolve(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

const args = parseArgs(process.argv.slice(2));
const runtime = semanticRetrievalRuntimeConfig();
invariant(Number.isInteger(runtime.dimensions) && runtime.dimensions > 0, "SLIBY_SEMANTIC_DIMENSIONS must be a positive integer");
invariant(Number.isInteger(runtime.candidateLimit) && runtime.candidateLimit > 0 && runtime.candidateLimit <= 32, "SLIBY_SEMANTIC_CANDIDATE_LIMIT must be an integer from 1 to 32");
invariant(Number.isFinite(runtime.minimumSimilarity) && runtime.minimumSimilarity >= -1 && runtime.minimumSimilarity <= 1, "SLIBY_SEMANTIC_MIN_SIMILARITY must be a number from -1 to 1");
const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
const registry = validatePromiseRegistry(JSON.parse(await readFile(resolve(args.promiseRegistry), "utf8")));
const publishedRegistry = publishedMatchingRegistry(registry, await loadPublishedPromiseIds(args.publishedPromises));
const promises = publishedRegistry.promises.filter((promise) => args.promiseIds.length === 0 || args.promiseIds.includes(promise.id));
for (const requested of args.promiseIds) invariant(promises.some(({ id }) => id === requested), `Unknown promise id: ${requested}`);

const loadedSemanticIndex = JSON.parse(await readFile(resolve(args.semanticIndex), "utf8"));
const semanticIndexRebuilt = semanticIndexRequiresRebuild(loadedSemanticIndex, runtime);
const semanticIndex = validateSemanticIndex(
  semanticIndexRebuilt ? emptySemanticIndex(runtime) : pruneSemanticIndex(loadedSemanticIndex, publishedRegistry.promises),
  publishedRegistry.promises,
  runtime
);
const profilePlan = planPromiseEmbeddings({ index: semanticIndex, promises: publishedRegistry.promises });
const profileEmbeddingResult = profilePlan.length === 0 ? { embeddings: [], usages: [] } : await embedTexts({ runtime, inputs: profilePlan.map(({ input }) => input) });
const updatedSemanticIndex = validateSemanticIndex(
  updateSemanticIndex({ index: semanticIndex, promises: publishedRegistry.promises, plan: profilePlan, embeddings: profileEmbeddingResult.embeddings }),
  publishedRegistry.promises,
  runtime
);
if (args.writeSemanticIndex && semanticIndexHash(updatedSemanticIndex) !== semanticIndexHash(loadedSemanticIndex)) {
  await writeJsonAtomically(args.writeSemanticIndex, updatedSemanticIndex);
}

const cutoff = `${args.asOf}T23:59:59.999Z`;
const semanticRecords = collectorRun.records.filter((record) => record.primary === true && (!record.occurredAt || record.occurredAt <= cutoff));
const recordEmbeddingResult = semanticRecords.length === 0 ? { embeddings: [], usages: [] } : await embedTexts({ runtime, inputs: semanticRecords.map(semanticRecordText) });
const recordEmbeddings = new Map(semanticRecords.map((record, index) => [record.id, recordEmbeddingResult.embeddings[index]]));
const semanticCandidatesByPromise = rankSemanticCandidates({
  records: semanticRecords,
  recordEmbeddings,
  promises: publishedRegistry.promises,
  index: updatedSemanticIndex,
  limit: runtime.candidateLimit,
  minimumSimilarity: runtime.minimumSimilarity
});
const semanticCandidateRelationships = [...semanticCandidatesByPromise.values()]
  .reduce((total, candidatesByRecord) => total + candidatesByRecord.size, 0);

const outputDirectory = resolve(args.output);
const packageDirectory = resolve(outputDirectory, "evidence-packages");
await mkdir(packageDirectory, { recursive: true });

const promiseResults = [];
for (const promise of promises) {
  const matches = matchCollectorRecords(collectorRun.records, promise, { asOf: args.asOf, semanticCandidates: semanticCandidatesByPromise.get(promise.id) });
  const evidencePackage = buildEvidencePackage({ promise, matches, collectorRun, asOf: args.asOf });
  const packagePath = evidencePackage ? resolve(packageDirectory, `${promise.id}.json`) : null;
  if (packagePath) await writeFile(packagePath, `${JSON.stringify(evidencePackage, null, 2)}\n`, { flag: "wx" });
  promiseResults.push({
    promiseId: promise.id,
    candidateMatchCount: matches.length,
    semanticCandidateMatchCount: matches.filter(({ semanticCandidate }) => semanticCandidate !== null).length,
    attributablePrimaryMatchCount: matches.filter(({ record, attributionStatus }) => record.primary && ["verified-party-vote", "verified-party-no-majority", "verified-party-sponsor", "verified-party-publication", "candidate-government-action"].includes(attributionStatus)).length,
    evidencePackage: packagePath ? `evidence-packages/${basename(packagePath)}` : null,
    noPackageReason: packagePath ? null : "no-primary-candidate-match",
    matches: matches.map(summarizeMatch)
  });
  console.log(`${promise.id}: ${matches.length} candidates, ${packagePath ? "package generated" : "no package"}`);
}

const run = {
  schemaVersion: "1.0.0",
  matcherVersion: "hybrid-semantic-matcher-v1",
  assessmentContext: { mode: "live", ruleVersion: "period-timing-v2", maintenanceBaseline: "per-evidence-package" },
  matchedAt: new Date().toISOString(),
  asOf: args.asOf,
  publicationApproved: false,
  directionAssigned: false,
  collectorRunId: collectorRun.runId,
  collectorRunHash: sha256(collectorRun),
  promiseRegistryHash: sha256(publishedRegistry),
  semanticRetrieval: {
    provider: runtime.provider,
    model: runtime.model,
    dimensions: runtime.dimensions,
    candidateLimit: runtime.candidateLimit,
    minimumSimilarity: runtime.minimumSimilarity,
    indexVersion: updatedSemanticIndex.indexVersion,
    indexHash: semanticIndexHash(updatedSemanticIndex),
    indexRebuilt: semanticIndexRebuilt,
    promiseEmbeddingsCreated: profilePlan.length,
    recordEmbeddingsCreated: semanticRecords.length,
    candidateRelationships: semanticCandidateRelationships,
    usage: [...profileEmbeddingResult.usages, ...recordEmbeddingResult.usages].filter(Boolean)
  },
  promiseResults
};
await writeFile(resolve(outputDirectory, "match-run.json"), `${JSON.stringify(run, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ outputDirectory, promiseCount: promises.length, packageCount: promiseResults.filter((result) => result.evidencePackage).length, semanticRecords: semanticRecords.length, publicationApproved: false }, null, 2));
