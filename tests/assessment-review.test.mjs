import assert from "node:assert/strict";
import test from "node:test";
import { loadAssessmentPrompts } from "../scripts/lib/assessment-config.mjs";
import { emptyReviewManifest, planAssessmentInputs, validateReviewManifest } from "../scripts/lib/assessment-review.mjs";

const evidencePackage = {
  schemaVersion: "1.0.0",
  methodologyVersion: "slava-v7",
  packageId: "test-promise--2026-09-10--generated",
  asOf: "2026-09-10",
  assessmentContext: { mode: "live", ruleVersion: "period-timing-v2", maintenanceBaseline: null },
  promise: { id: "test-promise", originalTextCz: "Testovací slib.", fulfillmentTest: "Ověřitelný výsledek.", contradictionTest: "Ověřitelný rozpor." },
  evidence: [
    { id: "promise-source", url: "https://example.test/promise", factSummary: "Přesné znění slibu.", locator: "strana 1", publishedAt: "2025-01-01", primary: true, role: "promise-source" },
    { id: "conduct", url: "https://example.test/conduct", factSummary: "Ověřený krok.", locator: "záznam", publishedAt: "2026-09-10", primary: true, role: "conduct-evidence" }
  ]
};

const runtime = { assessorProviderA: "openai", assessorProviderB: "openai", arbiterProvider: "openai", assessorModelA: "a", assessorModelB: "b", arbiterModel: "c" };

test("loads only the active assessor and arbiter prompts", async () => {
  const prompts = await loadAssessmentPrompts();
  assert.equal(prompts.assessor.version, "assessor-v12");
  assert.equal(prompts.arbiter.version, "arbiter-v5");
  assert.match(prompts.assessor.contentHash, /^[a-f0-9]{64}$/);
  assert.match(prompts.arbiter.contentHash, /^[a-f0-9]{64}$/);
  assert.match(prompts.assessor.instructions, /maintenanceBaseline/);
  assert.match(prompts.arbiter.instructions, /maintenanceBaseline/);
});

test("plans an unseen package for human review without publication", () => {
  const manifest = emptyReviewManifest();
  assert.equal(validateReviewManifest(manifest), manifest);
  const plan = planAssessmentInputs({
    packages: [{ path: "test.json", evidencePackage }],
    manifest,
    prompts: { assessor: { version: "test", contentHash: "a".repeat(64) }, arbiter: { version: "test", contentHash: "b".repeat(64) } },
    runtime
  });
  assert.equal(plan[0].disposition, "assess");
  assert.equal(manifest.publicationApproved, false);
});
