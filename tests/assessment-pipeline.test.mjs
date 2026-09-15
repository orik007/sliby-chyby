import assert from "node:assert/strict";
import test from "node:test";
import {
  hashAssessmentContent,
  hashAssessmentFingerprint,
  resolveAssessmentReviews,
  resolveAvailableAssessmentReviews,
  validateAssessmentOutput,
  validateEvidencePackage
} from "../scripts/lib/assessment-pipeline.mjs";

const evidencePackage = {
  schemaVersion: "1.0.0",
  methodologyVersion: "slava-v7",
  packageId: "test-promise--2026-09-10--generated",
  asOf: "2026-09-10",
  assessmentContext: { mode: "live", ruleVersion: "period-timing-v2", maintenanceBaseline: null },
  promise: {
    id: "test-promise",
    originalTextCz: "Testovací slib.",
    fulfillmentTest: "Ověřitelný výsledek.",
    contradictionTest: "Ověřitelný rozpor."
  },
  evidence: [
    { id: "promise-source", url: "https://example.test/promise", factSummary: "Přesné znění slibu.", locator: "strana 1", publishedAt: "2025-01-01", primary: true, role: "promise-source" },
    { id: "conduct", url: "https://example.test/conduct", factSummary: "Ověřený krok.", locator: "záznam", publishedAt: "2026-09-10", primary: true, role: "conduct-evidence" }
  ]
};

function review(status) {
  return {
    promiseId: "test-promise",
    status,
    evidenceSufficient: true,
    citedEvidenceIds: ["promise-source", "conduct"],
    explanationCz: "Strana provedla ověřený krok související s tímto slibem.",
    confidence: "high",
    uncertainties: []
  };
}

const prompts = {
  assessor: { version: "test", contentHash: "a".repeat(64) },
  arbiter: { version: "test", contentHash: "b".repeat(64) }
};
const assessmentRuntime = {
  assessorProviderA: "openai",
  assessorProviderB: "openai",
  arbiterProvider: "openai",
  assessorModelA: "a",
  assessorModelB: "b",
  arbiterModel: "c"
};

test("validates a bounded assessment package and hashes assessable content", () => {
  assert.equal(validateEvidencePackage(evidencePackage), evidencePackage);
  assert.match(hashAssessmentContent(evidencePackage), /^[a-f0-9]{64}$/);
  const changed = structuredClone(evidencePackage);
  changed.evidence[1].factSummary = "Jiný ověřený krok.";
  assert.notEqual(hashAssessmentContent(changed), hashAssessmentContent(evidencePackage));
});

test("requires the active assessment context", () => {
  const incomplete = structuredClone(evidencePackage);
  delete incomplete.assessmentContext;
  assert.throws(() => validateEvidencePackage(incomplete), /assessmentContext/);
});

test("requires an auditable evidence item for a maintenance baseline", () => {
  const maintenance = structuredClone(evidencePackage);
  maintenance.assessmentContext.maintenanceBaseline = {
    preservedStateCz: "Zachovávaný stav trvá.",
    evidenceId: "baseline"
  };
  assert.throws(() => validateEvidencePackage(maintenance), /Maintenance baseline evidence/);
  maintenance.evidence.push({ id: "baseline", url: "https://example.test/baseline", factSummary: "Ověřený výchozí stav.", locator: "záznam", publishedAt: "2026-09-10", primary: true, role: "maintenance-baseline" });
  assert.equal(validateEvidencePackage(maintenance), maintenance);
  assert.notEqual(hashAssessmentContent(maintenance), hashAssessmentContent(evidencePackage));
});

test("keeps a consensus assessment as an unpublished candidate", () => {
  const output = review("moving-towards");
  assert.equal(validateAssessmentOutput(output, evidencePackage), output);
  assert.deepEqual(resolveAssessmentReviews(output, review("moving-towards"), evidencePackage), {
    state: "candidate",
    reason: "assessor-consensus",
    status: "moving-towards",
    selectedReview: "consensus"
  });
});

test("requires the arbiter when one assessor output is invalid", () => {
  const invalid = review("moving-towards");
  invalid.citedEvidenceIds = [];
  const resolved = resolveAvailableAssessmentReviews(invalid, review("moving-towards"), evidencePackage);
  assert.equal(resolved.reviewA, null);
  assert.equal(resolved.reviewB.status, "moving-towards");
  assert.match(resolved.validationErrors["assessor-a"], /cite evidence/);
  assert.deepEqual(resolved.resolution, { state: "arbitration-required", reason: "single-valid-assessor", status: null, selectedReview: null });
  assert.deepEqual(resolveAssessmentReviews(resolved.reviewA, resolved.reviewB, evidencePackage, {
    choice: "assessor-b", citedEvidenceIds: ["conduct"], explanationCz: "Druhý posudek odpovídá předloženým podkladům."
  }), { state: "candidate", reason: "arbiter-confirmed-single-assessor", status: "moving-towards", selectedReview: "assessor-b" });
  assert.deepEqual(resolveAssessmentReviews(resolved.reviewA, resolved.reviewB, evidencePackage, {
    choice: "assessor-a", citedEvidenceIds: ["conduct"], explanationCz: "Druhý posudek odpovídá předloženým podkladům."
  }), { state: "human-review-required", reason: "arbiter-cannot-decide", status: null, selectedReview: null });

  const malformed = structuredClone(review("moving-towards"));
  malformed.promiseId = "other-promise";
  assert.throws(() => resolveAssessmentReviews(null, malformed, evidencePackage), /promiseId/);
});

test("records a failed assessment only when both assessor outputs are invalid", () => {
  const invalidA = review("moving-towards");
  const invalidB = review("moving-towards");
  invalidA.citedEvidenceIds = [];
  invalidB.citedEvidenceIds = [];
  const resolved = resolveAvailableAssessmentReviews(invalidA, invalidB, evidencePackage);
  assert.equal(resolved.reviewA, null);
  assert.equal(resolved.reviewB, null);
  assert.equal(resolved.resolution.state, "assessment-failed");
  assert.equal(resolved.resolution.reason, "both-assessors-invalid");
  assert.match(resolved.validationErrors["assessor-a"], /cite evidence/);
  assert.match(resolved.validationErrors["assessor-b"], /cite evidence/);
});
test("includes prompt and model identity in an assessment fingerprint", () => {
  const content = hashAssessmentContent(evidencePackage);
  const fingerprint = hashAssessmentFingerprint({ assessmentContentHash: content, prompts, runtime: assessmentRuntime });
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
});

test("ignores concurrency when hashing assessment identity", () => {
  const content = hashAssessmentContent(evidencePackage);
  const first = hashAssessmentFingerprint({ assessmentContentHash: content, prompts, runtime: { ...assessmentRuntime, concurrency: 1 } });
  const second = hashAssessmentFingerprint({ assessmentContentHash: content, prompts, runtime: { ...assessmentRuntime, concurrency: 8 } });
  assert.equal(first, second);
});