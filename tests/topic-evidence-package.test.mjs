import assert from "node:assert/strict";
import test from "node:test";
import { predictBoundedPackage } from "../scripts/lib/topic-evidence-package.mjs";

function item(overrides = {}) {
  return {
    recordId: overrides.recordId ?? "record-1",
    primary: overrides.primary ?? true,
    factSummary: overrides.factSummary ?? "A short factual summary.",
    structuredFacts: overrides.structuredFacts ?? { a: 1 }
  };
}

test("no routed evidence items predicts no package", () => {
  const result = predictBoundedPackage({ promiseId: "p1", routedEvidenceItems: [] });
  assert.equal(result.predicted, false);
  assert.deepEqual(result.included, []);
  assert.deepEqual(result.omitted, []);
  assert.equal(result.requiresPartitionReview, false);
  assert.equal(result.estimatedTokens, 0);
  assert.equal(result.estimatedAssessorInputTokens, 0);
});

test("orders primary evidence before non-primary within the item cap", () => {
  const items = [
    item({ recordId: "context-1", primary: false }),
    item({ recordId: "primary-1", primary: true }),
    item({ recordId: "context-2", primary: false }),
    item({ recordId: "primary-2", primary: true })
  ];
  const result = predictBoundedPackage({ promiseId: "p1", routedEvidenceItems: items, maxItems: 2 });
  assert.deepEqual(result.included, ["primary-1", "primary-2"]);
  assert.deepEqual(result.omitted.map((entry) => entry.recordId), ["context-1", "context-2"]);
  assert.ok(result.omitted.every((entry) => entry.reason === "exceeds-maximum-item-count"));
});

test("omits an item that would exceed the token budget and records the reason", () => {
  const bigFactSummary = "x".repeat(30_000);
  const items = [item({ recordId: "small", factSummary: "short" }), item({ recordId: "oversized", factSummary: bigFactSummary })];
  const result = predictBoundedPackage({ promiseId: "p1", routedEvidenceItems: items, maxTokenBudget: 100 });
  assert.deepEqual(result.included, ["small"]);
  assert.deepEqual(result.omitted, [{ recordId: "oversized", reason: "exceeds-token-budget" }]);
  assert.equal(result.requiresPartitionReview, true);
});

test("never silently drops evidence -- every omission is recorded with a reason", () => {
  const items = Array.from({ length: 30 }, (_, index) => item({ recordId: `record-${index}` }));
  const result = predictBoundedPackage({ promiseId: "p1", routedEvidenceItems: items, maxItems: 24 });
  assert.equal(result.included.length, 24);
  assert.equal(result.omitted.length, 6);
  assert.ok(result.omitted.every((entry) => typeof entry.reason === "string" && entry.reason.length > 0));
});

test("estimatedAssessorInputTokens includes fixed package overhead and both assessor calls", () => {
  const result = predictBoundedPackage({ promiseId: "p1", routedEvidenceItems: [item()] });
  assert.ok(result.predicted);
  assert.ok(result.estimatedAssessorInputTokens > result.estimatedTokens * 2, "must include per-package overhead beyond the raw evidence tokens");
  assert.equal(result.estimatedAssessorInputTokens % 2, 0, "must scale for exactly two assessor calls");
});

test("a single oversized item alone still predicts a package requiring partition review", () => {
  const oversizedFactSummary = "x".repeat(30_000);
  const result = predictBoundedPackage({ promiseId: "p1", routedEvidenceItems: [item({ recordId: "oversized-only", factSummary: oversizedFactSummary })], maxTokenBudget: 100 });
  assert.equal(result.predicted, true, "a promise with routed evidence must still count toward predictedPackageCount even if that evidence needs partitioning");
  assert.deepEqual(result.included, []);
  assert.deepEqual(result.omitted, [{ recordId: "oversized-only", reason: "exceeds-token-budget" }]);
  assert.equal(result.requiresPartitionReview, true);
});

test("a package within budget requires no partition review", () => {
  const result = predictBoundedPackage({ promiseId: "p1", routedEvidenceItems: [item()] });
  assert.equal(result.requiresPartitionReview, false);
  assert.deepEqual(result.omitted, []);
});
