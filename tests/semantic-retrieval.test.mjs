import assert from "node:assert/strict";
import test from "node:test";
import {
  emptySemanticIndex,
  planPromiseEmbeddings,
  pruneSemanticIndex,
  rankSemanticCandidates,
  updateSemanticIndex,
  validateSemanticIndex
} from "../scripts/lib/semantic-retrieval.mjs";

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
});
