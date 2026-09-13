import { createHash } from "node:crypto";

export const semanticIndexSchemaVersion = "1.0.0";
export const semanticIndexVersion = "promise-semantic-v1";
export const defaultSemanticProvider = "openai";
export const defaultSemanticModel = "text-embedding-3-small";
export const defaultSemanticDimensions = 256;
export const defaultSemanticCandidateLimit = 8;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function compactText(value, maximumLength = 6000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

function recordPayloadText(record) {
  const payload = { ...(record.payload ?? {}) };
  delete payload.individualVotes;
  return compactText(JSON.stringify(payload), 4000);
}

export function semanticPromiseProfile(promise) {
  return compactText([
    `Název slibu: ${promise.titleCz ?? ""}`,
    `Přesné znění: ${promise.originalTextCz}`,
    `Jádro závazku: ${promise.atomicClaimCz ?? ""}`,
    `Co znamená splnění: ${promise.fulfillmentTest}`,
    `Co znamená jednání proti slibu: ${promise.contradictionTest}`,
    `Přesné signály: ${(promise.matching?.terms ?? []).map(({ phrase }) => phrase).join("; ")}`
  ].join("\n"));
}

export function semanticRecordText(record) {
  return compactText([
    `Název záznamu: ${record.title}`,
    `Vydavatel: ${record.publisher}`,
    `Typ záznamu: ${record.kind}`,
    `Obsah záznamu: ${recordPayloadText(record)}`
  ].join("\n"));
}

export function hashSemanticProfile(promise) {
  return createHash("sha256").update(semanticPromiseProfile(promise)).digest("hex");
}

function isEmbedding(value, dimensions) {
  return Array.isArray(value) && value.length === dimensions && value.every(Number.isFinite);
}

export function emptySemanticIndex({
  provider = defaultSemanticProvider,
  model = defaultSemanticModel,
  dimensions = defaultSemanticDimensions
} = {}) {
  return {
    schemaVersion: semanticIndexSchemaVersion,
    indexVersion: semanticIndexVersion,
    provider,
    model,
    dimensions,
    promiseEmbeddings: {}
  };
}

export function semanticIndexRequiresRebuild(index, runtime) {
  return index?.provider !== runtime.provider
    || index?.model !== runtime.model
    || index?.dimensions !== runtime.dimensions;
}

export function validateSemanticIndex(index, promises, runtime) {
  invariant(index && typeof index === "object", "Semantic index must be an object");
  invariant(index.schemaVersion === semanticIndexSchemaVersion, "Unsupported semantic index schemaVersion");
  invariant(index.indexVersion === semanticIndexVersion, "Unsupported semantic index version");
  invariant(index.provider === runtime.provider, "Semantic index provider differs from configured provider");
  invariant(index.model === runtime.model, "Semantic index model differs from configured model");
  invariant(index.dimensions === runtime.dimensions, "Semantic index dimensions differ from configured dimensions");
  invariant(index.promiseEmbeddings && typeof index.promiseEmbeddings === "object" && !Array.isArray(index.promiseEmbeddings), "Semantic index must contain promiseEmbeddings");
  const promiseIds = new Set(promises.map(({ id }) => id));
  for (const [promiseId, entry] of Object.entries(index.promiseEmbeddings)) {
    invariant(promiseIds.has(promiseId), `Semantic index references unknown promise ${promiseId}`);
    invariant(entry && typeof entry === "object", `Semantic index entry ${promiseId} must be an object`);
    invariant(/^[a-f0-9]{64}$/.test(entry.profileHash), `Semantic index entry ${promiseId} has an invalid profileHash`);
    invariant(isEmbedding(entry.embedding, runtime.dimensions), `Semantic index entry ${promiseId} has an invalid embedding`);
  }
  return index;
}

export function pruneSemanticIndex(index, promises) {
  const publishedIds = new Set(promises.map(({ id }) => id));
  return {
    ...index,
    promiseEmbeddings: Object.fromEntries(
      Object.entries(index.promiseEmbeddings ?? {}).filter(([promiseId]) => publishedIds.has(promiseId))
    )
  };
}

export function planPromiseEmbeddings({ index, promises }) {
  return promises
    .filter((promise) => index.promiseEmbeddings[promise.id]?.profileHash !== hashSemanticProfile(promise))
    .map((promise) => ({ promiseId: promise.id, profileHash: hashSemanticProfile(promise), input: semanticPromiseProfile(promise) }));
}

export function updateSemanticIndex({ index, promises, plan, embeddings }) {
  invariant(plan.length === embeddings.length, "Semantic embedding response count differs from the request plan");
  const next = {
    ...index,
    promiseEmbeddings: Object.fromEntries(promises.flatMap((promise) => {
      const plannedIndex = plan.findIndex(({ promiseId }) => promiseId === promise.id);
      const entry = plannedIndex === -1
        ? index.promiseEmbeddings[promise.id]
        : { profileHash: plan[plannedIndex].profileHash, embedding: embeddings[plannedIndex] };
      return entry ? [[promise.id, entry]] : [];
    }))
  };
  return next;
}

export function cosineSimilarity(left, right) {
  invariant(left.length === right.length && left.length > 0, "Embeddings must use the same non-zero dimensions");
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function rankSemanticCandidates({
  records,
  recordEmbeddings,
  promises,
  index,
  limit = defaultSemanticCandidateLimit,
  minimumSimilarity = 0
}) {
  invariant(Number.isInteger(limit) && limit > 0, "Semantic candidate limit must be a positive integer");
  invariant(Number.isFinite(minimumSimilarity) && minimumSimilarity >= -1 && minimumSimilarity <= 1, "Minimum semantic similarity must be between -1 and 1");
  const resultsByPromise = new Map(promises.map(({ id }) => [id, new Map()]));
  for (const record of records) {
    const embedding = recordEmbeddings.get(record.id);
    invariant(embedding, `Missing semantic embedding for record ${record.id}`);
    const ranked = promises
      .map((promise) => ({
        promise,
        similarity: cosineSimilarity(embedding, index.promiseEmbeddings[promise.id].embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity || a.promise.id.localeCompare(b.promise.id))
      .filter(({ similarity }) => similarity >= minimumSimilarity)
      .slice(0, limit);
    ranked.forEach(({ promise, similarity }, rank) => {
      resultsByPromise.get(promise.id).set(record.id, {
        candidateSource: "semantic-retrieval",
        rank: rank + 1,
        similarity,
        profileHash: index.promiseEmbeddings[promise.id].profileHash,
        indexVersion: index.indexVersion,
        model: index.model
      });
    });
  }
  return resultsByPromise;
}

export function semanticIndexHash(index) {
  return createHash("sha256").update(canonicalize(index)).digest("hex");
}
