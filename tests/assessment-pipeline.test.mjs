import assert from "node:assert/strict";
import test from "node:test";
import {
  hashAssessmentContent,
  hashAssessmentFingerprint,
  resolveAssessmentReviews,
  validateAssessmentOutput,
  validateEvidencePackage
} from "../scripts/lib/assessment-pipeline.mjs";

const evidencePackage = {
  schemaVersion: "1.0.0",
  methodologyVersion: "slava-v6",
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

test("includes prompt and model identity in an assessment fingerprint", () => {
  const content = hashAssessmentContent(evidencePackage);
  const fingerprint = hashAssessmentFingerprint({
    assessmentContentHash: content,
    prompts: { assessor: { version: "test", contentHash: "a".repeat(64) }, arbiter: { version: "test", contentHash: "b".repeat(64) } },
    runtime: { assessorProviderA: "openai", assessorProviderB: "openai", arbiterProvider: "openai", assessorModelA: "a", assessorModelB: "b", arbiterModel: "c" }
  });
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
});
