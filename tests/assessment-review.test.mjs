import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addReviewProposals,
  createReviewProposal,
  emptyReviewManifest,
  planAssessmentInputs,
  validateReviewManifest
} from "../scripts/lib/assessment-review.mjs";

const evidencePackage = JSON.parse(await readFile(new URL("../automation/golden-cases/ano-eet-2/evidence-package.json", import.meta.url), "utf8"));
const prompts = {
  assessor: { version: "assessor-test", contentHash: "a".repeat(64) },
  arbiter: { version: "arbiter-test", contentHash: "b".repeat(64) }
};
const runtime = {
  assessorProviderA: "openai",
  assessorProviderB: "openai",
  arbiterProvider: "openai",
  assessorModelA: "model-a",
  assessorModelB: "model-a",
  arbiterModel: "model-b"
};

test("plans only unseen assessment fingerprints", () => {
  const firstPlan = planAssessmentInputs({
    packages: [{ path: "evidence-package.json", evidencePackage }],
    manifest: emptyReviewManifest(),
    prompts,
    runtime
  });
  assert.equal(firstPlan[0].disposition, "assess");

  const proposal = {
    schemaVersion: "1.0.0",
    proposalId: "ano-2025-eet-2--existing",
    promiseId: evidencePackage.promise.id,
    assessmentFingerprint: firstPlan[0].assessmentFingerprint,
    assessmentContentHash: firstPlan[0].assessmentContentHash,
    packageHash: firstPlan[0].packageHash,
    evaluatedAt: "2026-09-02T00:00:00.000Z",
    resolutionState: "candidate",
    resolutionReason: "assessor-consensus",
    candidateStatus: "moving-towards",
    humanReviewRequired: true,
    publicationApproved: false,
    path: `automation/review-proposals/${evidencePackage.promise.id}/${firstPlan[0].assessmentFingerprint}`
  };
  const manifest = addReviewProposals(emptyReviewManifest(), [proposal]);
  const repeatPlan = planAssessmentInputs({
    packages: [{ path: "later-package.json", evidencePackage: { ...evidencePackage, packageId: "later", asOf: "2026-09-02" } }],
    manifest,
    prompts,
    runtime
  });
  assert.equal(repeatPlan[0].disposition, "unchanged");
});

test("blocks a changed package with an official-document enrichment warning", () => {
  const plan = planAssessmentInputs({
    packages: [{ path: "evidence-package.json", evidencePackage }],
    manifest: emptyReviewManifest(),
    blockedPromiseIds: new Set([evidencePackage.promise.id]),
    prompts,
    runtime
  });
  assert.equal(plan[0].disposition, "blocked-enrichment-warning");
});

test("creates an unpublished human-review proposal from a candidate audit", () => {
  const plan = planAssessmentInputs({
    packages: [{ path: "evidence-package.json", evidencePackage }],
    manifest: emptyReviewManifest(),
    prompts,
    runtime
  })[0];
  const auditRecord = {
    evaluatedAt: "2026-09-02T00:00:00.000Z",
    packageHash: plan.packageHash,
    assessmentContentHash: plan.assessmentContentHash,
    assessmentFingerprint: plan.assessmentFingerprint,
    publicationApproved: false,
    assessorA: { output: { promiseId: evidencePackage.promise.id, confidence: "high" } },
    assessorB: { output: { promiseId: evidencePackage.promise.id, confidence: "medium" } },
    resolution: { state: "candidate", reason: "assessor-consensus", status: "moving-towards" }
  };
  const proposal = createReviewProposal({
    auditRecord,
    proposalDirectory: `automation/review-proposals/${evidencePackage.promise.id}/${plan.assessmentFingerprint}`
  });
  assert.equal(proposal.humanReviewRequired, true);
  assert.equal(proposal.publicationApproved, false);
  assert.equal(proposal.candidateStatus, "moving-towards");
  assert.equal(validateReviewManifest(addReviewProposals(emptyReviewManifest(), [proposal])).proposals.length, 1);
});
