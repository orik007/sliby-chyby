import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hashEvidencePackage,
  resolveAssessmentReviews,
  validateAssessmentOutput,
  validateEvidencePackage
} from "../scripts/lib/assessment-pipeline.mjs";

const evidencePackage = JSON.parse(await readFile(new URL("../automation/golden-cases/ano-eet-2/evidence-package.json", import.meta.url), "utf8"));

function review(status, overrides = {}) {
  return {
    promiseId: evidencePackage.promise.id,
    status,
    evidenceSufficient: true,
    citedEvidenceIds: ["government-2026-05-04-eet2", "psp-print-189-status-2026-08-30"],
    explanationCz: "Návrh prošel konkrétními legislativními kroky, ale dosud nejde o dokončený výsledek.",
    confidence: "high",
    uncertainties: ["Další projednání ve Sněmovně je po rozhodném datu balíčku."],
    ...overrides
  };
}

test("validates and deterministically hashes the golden evidence package", () => {
  assert.equal(validateEvidencePackage(evidencePackage), evidencePackage);
  assert.match(hashEvidencePackage(evidencePackage), /^[a-f0-9]{64}$/);
  assert.equal(hashEvidencePackage(evidencePackage), hashEvidencePackage(structuredClone(evidencePackage)));
});

test("requires an explicit supported assessment timing context", () => {
  const missingContext = structuredClone(evidencePackage);
  delete missingContext.assessmentContext;
  assert.throws(() => validateEvidencePackage(missingContext), /assessmentContext mode/);

  const unsupportedRule = structuredClone(evidencePackage);
  unsupportedRule.assessmentContext.ruleVersion = "period-timing-unknown";
  assert.throws(() => validateEvidencePackage(unsupportedRule), /period timing rule/);
});

test("accepts matching sufficient assessor results as a candidate, never as published", () => {
  const result = resolveAssessmentReviews(review("moving-towards"), review("moving-towards"), evidencePackage);
  assert.deepEqual(result, { state: "candidate", reason: "assessor-consensus", status: "moving-towards", selectedReview: "consensus" });
});

test("requires arbitration when independent assessors disagree", () => {
  const result = resolveAssessmentReviews(review("moving-towards"), review("fulfilled"), evidencePackage);
  assert.equal(result.state, "arbitration-required");
  assert.equal(result.status, null);
});

test("requires arbitration when assessors disagree about evidence sufficiency", () => {
  const result = resolveAssessmentReviews(review("moving-towards"), review("no-progress", { evidenceSufficient: false }), evidencePackage);
  assert.equal(result.state, "arbitration-required");
  assert.equal(result.reason, "assessor-disagreement");
});

test("requires human review when both assessors agree the package is insufficient", () => {
  const result = resolveAssessmentReviews(
    review("no-progress", { evidenceSufficient: false }),
    review("no-progress", { evidenceSufficient: false }),
    evidencePackage
  );
  assert.equal(result.state, "human-review-required");
  assert.equal(result.reason, "insufficient-evidence");
});

test("rejects invented evidence identifiers", () => {
  assert.throws(
    () => validateAssessmentOutput(review("moving-towards", { citedEvidenceIds: ["invented-source"] }), evidencePackage),
    /invented evidence ID/
  );
});

test("an arbiter may select one existing review but cannot invent a third status", () => {
  const result = resolveAssessmentReviews(
    review("moving-towards"),
    review("fulfilled"),
    evidencePackage,
    { choice: "assessor-a", citedEvidenceIds: ["psp-print-189-status-2026-08-30"], explanationCz: "Zákon zatím není účinný." }
  );
  assert.deepEqual(result, { state: "candidate", reason: "arbiter-selection", status: "moving-towards", selectedReview: "assessor-a" });
});

test("an arbiter cannot turn an insufficient selected review into a candidate", () => {
  const result = resolveAssessmentReviews(
    review("moving-towards"),
    review("no-progress", { evidenceSufficient: false }),
    evidencePackage,
    { choice: "assessor-b", citedEvidenceIds: ["psp-print-189-status-2026-08-30"], explanationCz: "Dodané důkazy nestačí." }
  );
  assert.deepEqual(result, {
    state: "human-review-required",
    reason: "arbiter-selected-insufficient-evidence",
    status: null,
    selectedReview: "assessor-b"
  });
});
