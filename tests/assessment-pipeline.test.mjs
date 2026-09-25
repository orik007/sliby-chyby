import assert from "node:assert/strict";
import test from "node:test";
import {
  assessmentOutputJsonSchema,
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
    { id: "change-1", url: "https://example.test/change-1", factSummary: "Úřední text první změny zákona.", locator: "ČÁST PRVNÍ", publishedAt: "2026-09-01", primary: true, role: "law-change" },
    { id: "change-2", url: "https://example.test/change-2", factSummary: "Úřední text druhé změny zákona.", locator: "ČÁST DRUHÁ", publishedAt: "2026-09-01", primary: true, role: "law-change" },
    { id: "conduct", url: "https://example.test/conduct", factSummary: "Ověřený krok.", locator: "záznam", publishedAt: "2026-09-10", primary: true, role: "conduct-evidence" }
  ]
};

function review(status) {
  return {
    promiseId: "test-promise",
    changeRelevance: [
      { evidenceId: "change-1", relevant: true, reasonCz: "Změna upravuje přesně to, co slib žádá." },
      { evidenceId: "change-2", relevant: false, reasonCz: "Změna se týká jiné věci." }
    ],
    status,
    evidenceSufficient: true,
    citedEvidenceIds: ["promise-source", "change-1", "conduct"],
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

test("validates an assessment package and hashes assessable content", () => {
  assert.equal(validateEvidencePackage(evidencePackage), evidencePackage);
  assert.match(hashAssessmentContent(evidencePackage), /^[a-f0-9]{64}$/);
  const changed = structuredClone(evidencePackage);
  changed.evidence[3].factSummary = "Jiný ověřený krok.";
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
  assert.equal(assessmentOutputJsonSchema.properties.citedEvidenceIds.minItems, 1);
  const invalid = review("moving-towards");
  invalid.citedEvidenceIds = [];
  const resolved = resolveAvailableAssessmentReviews(invalid, review("moving-towards"), evidencePackage);
  assert.equal(resolved.reviewA, null);
  assert.equal(resolved.reviewB.status, "moving-towards");
  assert.match(resolved.validationErrors["assessor-a"], /cite evidence/);

  const duplicateCitation = review("moving-towards");
  duplicateCitation.citedEvidenceIds = ["conduct", "conduct"];
  assert.throws(() => validateAssessmentOutput(duplicateCitation, evidencePackage), /duplicate evidence/);
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

test("requires a law change in every package", () => {
  const withoutChange = structuredClone(evidencePackage);
  withoutChange.evidence = withoutChange.evidence.filter(({ role }) => role !== "law-change");
  assert.throws(() => validateEvidencePackage(withoutChange), /Missing law change/);
});

test("requires exactly one relevance verdict for every law change", () => {
  const omitted = review("moving-towards");
  omitted.changeRelevance = omitted.changeRelevance.slice(0, 1);
  assert.throws(() => validateAssessmentOutput(omitted, evidencePackage), /omits the relevance verdict for law change change-2/);

  const twice = review("moving-towards");
  twice.changeRelevance.push({ evidenceId: "change-1", relevant: false, reasonCz: "Znovu." });
  assert.throws(() => validateAssessmentOutput(twice, evidencePackage), /more than one relevance verdict/);

  const notAChange = review("moving-towards");
  notAChange.changeRelevance.push({ evidenceId: "conduct", relevant: true, reasonCz: "Hlasování." });
  assert.throws(() => validateAssessmentOutput(notAChange, evidencePackage), /other than a law change/);

  const withoutReason = review("moving-towards");
  withoutReason.changeRelevance[0].reasonCz = " ";
  assert.throws(() => validateAssessmentOutput(withoutReason, evidencePackage), /needs a reason/);

  // An invalid output is isolated to that assessor, like any other.
  const resolved = resolveAvailableAssessmentReviews(omitted, review("moving-towards"), evidencePackage);
  assert.equal(resolved.reviewA, null);
  assert.equal(resolved.resolution.state, "arbitration-required");
});

test("a law change found not relevant cannot support a sufficient assessment", () => {
  const citesRejected = review("moving-towards");
  citesRejected.citedEvidenceIds.push("change-2");
  assert.throws(() => validateAssessmentOutput(citesRejected, evidencePackage), /cites law change change-2 it found not relevant/);
  // Without sufficient evidence, the rejected change may still be cited to
  // show the gap.
  citesRejected.evidenceSufficient = false;
  assert.equal(validateAssessmentOutput(citesRejected, evidencePackage), citesRejected);
  assert.deepEqual(assessmentOutputJsonSchema.required.includes("changeRelevance"), true);
});

test("two valid assessments that disagree go to the arbiter, whose choice decides", () => {
  const towards = review("moving-towards");
  const against = review("moving-against");
  assert.deepEqual(resolveAssessmentReviews(towards, against, evidencePackage), { state: "arbitration-required", reason: "assessor-disagreement", status: null, selectedReview: null });
  const choose = (choice) => resolveAssessmentReviews(towards, against, evidencePackage, { choice, citedEvidenceIds: ["conduct"], explanationCz: "Druhý posudek odpovídá předloženým podkladům." });
  assert.deepEqual(choose("assessor-a"), { state: "candidate", reason: "arbiter-selection", status: "moving-towards", selectedReview: "assessor-a" });
  assert.deepEqual(choose("assessor-b"), { state: "candidate", reason: "arbiter-selection", status: "moving-against", selectedReview: "assessor-b" });
  assert.deepEqual(choose("cannot-decide"), { state: "human-review-required", reason: "arbiter-cannot-decide", status: null, selectedReview: null });
  // An arbiter may cite only evidence of the package.
  assert.throws(() => resolveAssessmentReviews(towards, against, evidencePackage, { choice: "assessor-a", citedEvidenceIds: ["invented"], explanationCz: "Druhý posudek odpovídá předloženým podkladům." }), /invented evidence ID/);
});

test("assessments that differ only in whether the evidence suffices also go to the arbiter", () => {
  const sufficient = review("no-progress");
  const insufficient = { ...review("no-progress"), evidenceSufficient: false };
  assert.equal(resolveAssessmentReviews(sufficient, insufficient, evidencePackage).state, "arbitration-required");
  // An arbiter that selects the assessment with insufficient evidence leaves it to a person.
  assert.deepEqual(resolveAssessmentReviews(sufficient, insufficient, evidencePackage, { choice: "assessor-b", citedEvidenceIds: ["conduct"], explanationCz: "Druhý posudek odpovídá předloženým podkladům." }),
    { state: "human-review-required", reason: "arbiter-selected-insufficient-evidence", status: null, selectedReview: "assessor-b" });
  // Both assessors finding the evidence insufficient needs no arbiter, but a person.
  assert.deepEqual(resolveAssessmentReviews(insufficient, { ...insufficient }, evidencePackage), { state: "human-review-required", reason: "insufficient-evidence", status: null, selectedReview: null });
});

test("an assessment may cite only evidence of its package", () => {
  const invented = review("moving-towards");
  invented.citedEvidenceIds = ["promise-source", "change-1", "news-article"];
  assert.throws(() => validateAssessmentOutput(invented, evidencePackage), /invented evidence ID: news-article/);
});
