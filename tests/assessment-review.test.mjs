import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { arbiterPromptVersion, assessorPromptVersion, loadAssessmentPrompts } from "../scripts/lib/assessment-config.mjs";
import {
  addReviewProposals,
  createReviewProposal,
  currentReviewProposal,
  emptyReviewManifest,
  planAssessmentInputs,
  renderHumanReviewMarkdown,
  simplifyPublicExplanation,
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

test("active prompts use the consolidated decision order and plain Czech", async () => {
  assert.equal(assessorPromptVersion, "assessor-v10");
  assert.equal(arbiterPromptVersion, "arbiter-v3");
  const active = await loadAssessmentPrompts();
  assert.match(active.assessor.instructions, /Follow these five steps in order/);
  assert.equal(active.assessor.instructions.match(/^## [1-5]\./gm)?.length, 5);
  assert.match(active.assessor.instructions, /never use a bare identifier such as “tisk 201”/);
  assert.match(active.assessor.instructions, /strict-majority `yes` on a measure that would deliver the whole legislative promise: `fulfilled`/);
  assert.match(active.assessor.instructions, /A later vote counts regardless of who introduced the bill/);
  assert.match(active.assessor.instructions, /An official party publication proves that the party published the words/);
  assert.match(active.assessor.instructions, /A government action is only an attribution candidate/);
  assert.match(active.assessor.instructions, /neither strict-majority `yes` nor strict-majority `no` at that same direct opportunity/);
  assert.match(active.assessor.instructions, /During `live` mode, elapsed time, inactivity, or incomplete progress is not negative/);
  assert.match(active.assessor.instructions, /do not score or average individual evidence items/);
  assert.match(active.arbiter.instructions, /ordinary reader/);
});

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

test("links a replacement proposal without deleting the previous audit record", () => {
  const firstPlan = planAssessmentInputs({
    packages: [{ path: "first.json", evidencePackage }],
    manifest: emptyReviewManifest(),
    prompts,
    runtime
  })[0];
  const first = {
    schemaVersion: "1.0.0",
    proposalId: "ano-2025-eet-2--first",
    promiseId: evidencePackage.promise.id,
    assessmentFingerprint: firstPlan.assessmentFingerprint,
    assessmentContentHash: firstPlan.assessmentContentHash,
    packageHash: firstPlan.packageHash,
    evaluatedAt: "2026-09-01T00:00:00.000Z",
    resolutionState: "candidate",
    resolutionReason: "assessor-consensus",
    candidateStatus: "moving-towards",
    humanReviewRequired: true,
    publicationApproved: false,
    path: `automation/review-proposals/${evidencePackage.promise.id}/${firstPlan.assessmentFingerprint}`
  };
  const firstManifest = addReviewProposals(emptyReviewManifest(), [first]);
  const replacement = {
    ...structuredClone(first),
    proposalId: "ano-2025-eet-2--replacement",
    assessmentFingerprint: "c".repeat(64),
    evaluatedAt: "2026-09-02T00:00:00.000Z",
    supersedesProposalId: first.proposalId,
    supersededByProposalId: null,
    path: `automation/review-proposals/${evidencePackage.promise.id}/${"c".repeat(64)}`
  };
  const replacedManifest = addReviewProposals(firstManifest, [replacement]);
  assert.equal(replacedManifest.proposals.length, 2);
  assert.equal(replacedManifest.proposals[0].supersededByProposalId, replacement.proposalId);
  assert.equal(currentReviewProposal(replacedManifest, evidencePackage.promise.id).proposalId, replacement.proposalId);
});

test("separates the plain public candidate from technical reviewer data", () => {
  const plan = planAssessmentInputs({
    packages: [{ path: "evidence-package.json", evidencePackage }],
    manifest: emptyReviewManifest(),
    prompts,
    runtime
  })[0];
  const output = {
    promiseId: evidencePackage.promise.id,
    status: "moving-towards",
    evidenceSufficient: true,
    citedEvidenceIds: [evidencePackage.evidence[1].id],
    explanationCz: "Strana udělala konkrétní dílčí krok ke splnění slibu, ale slíbený výsledek zatím nenastal.",
    confidence: "high",
    uncertainties: ["Není jisté, kdy bude návrh definitivně schválen."]
  };
  const auditRecord = {
    evaluatedAt: "2026-09-02T00:00:00.000Z",
    packageHash: plan.packageHash,
    assessmentContentHash: plan.assessmentContentHash,
    assessmentFingerprint: plan.assessmentFingerprint,
    publicationApproved: false,
    assessorA: { output },
    assessorB: { output: structuredClone(output) },
    arbiter: null,
    resolution: { state: "candidate", reason: "assessor-consensus", status: "moving-towards", selectedReview: "consensus" }
  };
  const proposal = createReviewProposal({
    auditRecord,
    proposalDirectory: `automation/review-proposals/${evidencePackage.promise.id}/${plan.assessmentFingerprint}`
  });
  const markdown = renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal });
  const publicSection = markdown.match(/## Návrh pro veřejný web([\s\S]*?)## Co má zkontrolovat reviewer/)?.[1];
  assert.ok(publicSection);
  assert.match(markdown, /Toto je jediná část dokumentu určená jako kandidát veřejného textu/);
  assert.match(markdown, /Směřuje ke splnění \(\+1\)/);
  assert.match(markdown, /Původní volební slib/);
  assert.match(markdown, /## Technické podklady pro reviewera/);
  assert.match(markdown, /Interní stav: `moving-towards`/);
  assert.match(markdown, /### Shoda hodnotitelů/);
  assert.match(markdown, /Oba nezávislí hodnotitelé dospěli ke stejnému výsledku/);
  assert.doesNotMatch(markdown, /První posudek|Druhý posudek/);
  assert.doesNotMatch(publicSection, /moving-towards|candidate|verified-party/i);
});

test("shows both opinions only when a third assessor arbitrated a disagreement", () => {
  const plan = planAssessmentInputs({
    packages: [{ path: "evidence-package.json", evidencePackage }],
    manifest: emptyReviewManifest(),
    prompts,
    runtime
  })[0];
  const outputA = {
    promiseId: evidencePackage.promise.id,
    status: "moving-towards",
    evidenceSufficient: true,
    citedEvidenceIds: [evidencePackage.evidence[1].id],
    explanationCz: "První hodnotitel vidí konkrétní krok ke splnění slibu.",
    confidence: "medium",
    uncertainties: []
  };
  const outputB = {
    ...structuredClone(outputA),
    status: "no-progress",
    explanationCz: "Druhý hodnotitel považuje zjištěný krok za příliš slabý."
  };
  const auditRecord = {
    evaluatedAt: "2026-09-02T00:00:00.000Z",
    packageHash: plan.packageHash,
    assessmentContentHash: plan.assessmentContentHash,
    assessmentFingerprint: plan.assessmentFingerprint,
    publicationApproved: false,
    assessorA: { output: outputA },
    assessorB: { output: outputB },
    arbiter: { output: {
      choice: "assessor-a",
      explanationCz: "Třetí hodnotitel vybral první posudek, protože popsaný krok je konkrétní.",
      citedEvidenceIds: [evidencePackage.evidence[1].id]
    } },
    resolution: { state: "candidate", reason: "arbiter-selection", status: "moving-towards", selectedReview: "assessor-a" }
  };
  const proposal = createReviewProposal({
    auditRecord,
    proposalDirectory: `automation/review-proposals/${evidencePackage.promise.id}/${plan.assessmentFingerprint}`
  });
  const markdown = renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal });
  assert.match(markdown, /### Odlišné posudky/);
  assert.match(markdown, /První posudek: Směřuje ke splnění \(\+1\)/);
  assert.match(markdown, /Druhý posudek: Bez podstatného posunu \(0\)/);
  assert.match(markdown, /### Rozhodnutí třetího hodnotitele/);
  assert.doesNotMatch(markdown, /### Shoda hodnotitelů/);
});

test("removes unexplained parliamentary print numbers from the public candidate only", () => {
  const original = "Poslanci podpořili návrh zákona, vedený ve Sněmovně jako tisk č. 189. Návrh pokračuje do Senátu.";
  assert.equal(simplifyPublicExplanation(original), "Poslanci podpořili návrh zákona. Návrh pokračuje do Senátu.");
});

test("explains EET on first use without changing Czech grammatical case", () => {
  assert.equal(
    simplifyPublicExplanation("Návrh je významný krok k zavedení EET 2.0."),
    "Návrh je významný krok k zavedení EET 2.0 (elektronická evidence tržeb)."
  );
  assert.equal(
    simplifyPublicExplanation("Návrh zavádí elektronickou evidenci tržeb (EET 2.0)."),
    "Návrh zavádí elektronickou evidenci tržeb (EET 2.0)."
  );
  assert.equal(
    simplifyPublicExplanation("Podklady počítají s EET 2.0."),
    "Podklady počítají s EET 2.0 (elektronická evidence tržeb)."
  );
  assert.equal(
    simplifyPublicExplanation("ANO slíbilo novou elektronickou evidenci tržeb EET 2.0."),
    "ANO slíbilo novou elektronickou evidenci tržeb (EET 2.0)."
  );
  assert.equal(
    simplifyPublicExplanation("Elektronická evidence tržeb (EET 2.0) je plánovaná. EET 2.0 zatím neběží."),
    "Elektronická evidence tržeb (EET 2.0) je plánovaná. EET 2.0 zatím neběží."
  );
  assert.equal(
    simplifyPublicExplanation("EET 2.0 se připravuje; jde o elektronickou evidenci tržeb."),
    "EET 2.0 (elektronická evidence tržeb) se připravuje; jde o elektronickou evidenci tržeb."
  );
});

test("rejects a candidate review proposal without a supported public status", () => {
  const auditRecord = {
    assessorA: { output: { explanationCz: "Vysvětlení.", uncertainties: [], citedEvidenceIds: [] } },
    assessorB: { output: { explanationCz: "Vysvětlení.", uncertainties: [], citedEvidenceIds: [] } },
    resolution: { selectedReview: "assessor-a" }
  };
  const proposal = {
    proposalId: "invalid-candidate",
    resolutionState: "candidate",
    resolutionReason: "assessor-consensus",
    candidateStatus: "unsupported-status"
  };
  assert.throws(
    () => renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal }),
    /Candidate review proposal invalid-candidate must use a supported candidateStatus/
  );
});

test("renders no public candidate for insufficient evidence", () => {
  const plan = planAssessmentInputs({
    packages: [{ path: "evidence-package.json", evidencePackage }],
    manifest: emptyReviewManifest(),
    prompts,
    runtime
  })[0];
  const output = {
    promiseId: evidencePackage.promise.id,
    status: "no-progress",
    evidenceSufficient: false,
    citedEvidenceIds: [evidencePackage.evidence[1].id],
    explanationCz: "Automatické posouzení nemá dostatečné podklady.",
    confidence: "medium",
    uncertainties: []
  };
  const auditRecord = {
    evaluatedAt: "2026-09-02T00:00:00.000Z",
    packageHash: plan.packageHash,
    assessmentContentHash: plan.assessmentContentHash,
    assessmentFingerprint: plan.assessmentFingerprint,
    publicationApproved: false,
    assessorA: { output },
    assessorB: { output: structuredClone(output) },
    arbiter: null,
    resolution: { state: "human-review-required", reason: "insufficient-evidence", status: null, selectedReview: null }
  };
  const proposal = createReviewProposal({
    auditRecord,
    proposalDirectory: `automation/review-proposals/${evidencePackage.promise.id}/${plan.assessmentFingerprint}`
  });
  const markdown = renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal });
  const publicSection = markdown.match(/## Návrh pro veřejný web([\s\S]*?)## Co má zkontrolovat reviewer/)?.[1];
  assert.match(publicSection, /Nevznikl žádný návrh veřejného hodnocení ani vysvětlení/);
  assert.doesNotMatch(publicSection, /Bez automatického návrhu|Automatické posouzení nemá dostatečné podklady/);
  assert.match(markdown, /## Technické podklady pro reviewera/);
});
