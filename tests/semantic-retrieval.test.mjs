import assert from "node:assert/strict";
import test from "node:test";
import {
  emptySemanticIndex,
  planPromiseEmbeddings,
  pruneSemanticIndex,
  rankSemanticCandidates,
  semanticIndexRequiresRebuild,
  updateSemanticIndex,
  validateSemanticIndex
} from "../scripts/lib/semantic-retrieval.mjs";
import { semanticRetrievalRuntimeConfig } from "../scripts/lib/assessment-config.mjs";

const runtime = { provider: "openai", model: "test-embedding", dimensions: 2 };
const promises = [
  {
    id: "teacher-pay",
    titleCz: "Vyšší platy učitelů",
    originalTextCz: "Zvýšíme platy učitelů.",
    atomicClaimCz: "Zvýšíme platy pedagogů.",
    fulfillmentTest: "Teacher pay rises.",
    contradictionTest: "Teacher pay falls.",
    matching: { terms: [{ phrase: "platy učitelů" }] }
  },
  {
    id: "road-tax",
    titleCz: "Zrušení silniční daně",
    originalTextCz: "Zrušíme silniční daň.",
    atomicClaimCz: "Zrušíme silniční daň.",
    fulfillmentTest: "Road tax is repealed.",
    contradictionTest: "Road tax rises.",
    matching: { terms: [{ phrase: "silniční daň" }] }
  }
];

test("semantic retrieval defaults favor a small, stronger candidate set", () => {
  const runtime = semanticRetrievalRuntimeConfig({});
  assert.equal(runtime.candidateLimit, 3);
  assert.equal(runtime.minimumSimilarity, 0.55);
});

test("semantic retrieval ranks every promise locally and keeps only the top candidates", () => {
  const empty = emptySemanticIndex(runtime);
  const plan = planPromiseEmbeddings({ index: empty, promises });
  const index = validateSemanticIndex(updateSemanticIndex({
    index: empty,
    promises,
    plan,
    embeddings: [[1, 0], [0, 1]]
  }), promises, runtime);
  assert.equal(planPromiseEmbeddings({ index, promises }).length, 0);
  assert.equal(semanticIndexRequiresRebuild(index, runtime), false);
  assert.equal(semanticIndexRequiresRebuild(index, { ...runtime, model: "replacement-embedding" }), true);
  assert.deepEqual(
    Object.keys(pruneSemanticIndex({ ...index, promiseEmbeddings: { ...index.promiseEmbeddings, retired: index.promiseEmbeddings["road-tax"] } }, promises).promiseEmbeddings),
    ["teacher-pay", "road-tax"]
  );

  const records = [{ id: "official-teacher-pay", primary: true, title: "Pedagogům stoupnou tarify", publisher: "Ministerstvo", kind: "official-publication", payload: {} }];
  const candidates = rankSemanticCandidates({
    records,
    recordEmbeddings: new Map([["official-teacher-pay", [0.9, 0.1]]]),
    promises,
    index,
    limit: 1
  });
  assert.equal(candidates.get("teacher-pay").get("official-teacher-pay").rank, 1);
  assert.equal(candidates.get("road-tax").size, 0);

  const thresholded = rankSemanticCandidates({
    records,
    recordEmbeddings: new Map([["official-teacher-pay", [0.9, 0.1]]]),
    promises,
    index,
    limit: 8,
    minimumSimilarity: 0.999
  });
  assert.equal(thresholded.get("teacher-pay").size, 0);
});

test("semantic retrieval can exclude a weak lower-ranked relationship before assessment", () => {
  const indexedPromises = Array.from({ length: 8 }, (_, index) => ({
    ...promises[0],
    id: `promise-${index + 1}`
  }));
  const index = {
    ...emptySemanticIndex(runtime),
    promiseEmbeddings: Object.fromEntries(indexedPromises.map((promise, offset) => [promise.id, {
      profileHash: `${String(offset).padStart(64, "0")}`,
      embedding: [1, offset * 0.2]
    }]))
  };
  const records = [{ id: "broad-eu-policy", primary: true, title: "Broad EU policy", publisher: "Ministry", kind: "official-publication", payload: {} }];
  const candidates = rankSemanticCandidates({
    records,
    recordEmbeddings: new Map([["broad-eu-policy", [1, 0]]]),
    promises: indexedPromises,
    index
  });

  assert.equal(candidates.get("promise-1").get("broad-eu-policy").rank, 1);
  assert.equal(candidates.get("promise-3").get("broad-eu-policy").rank, 3);
  assert.equal(candidates.get("promise-4").size, 0);

  const weakPromise = { ...promises[0], id: "weak-relationship" };
  const weakIndex = {
    ...emptySemanticIndex(runtime),
    promiseEmbeddings: {
      "weak-relationship": {
        profileHash: "f".repeat(64),
        embedding: [0.535, Math.sqrt(1 - 0.535 ** 2)]
      }
    }
  };
  const belowThreshold = rankSemanticCandidates({
    records,
    recordEmbeddings: new Map([["broad-eu-policy", [1, 0]]]),
    promises: [weakPromise],
    index: weakIndex
  });
  assert.equal(belowThreshold.get("weak-relationship").size, 0);
});
