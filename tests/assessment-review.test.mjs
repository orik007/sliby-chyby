import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { arbiterPromptVersion, assessorPromptVersion, loadAssessmentPrompts } from "../scripts/lib/assessment-config.mjs";
import { assessmentFingerprintVersion, mergeRelevanceVerdicts, reviewManifestSchemaVersion, planAssessmentInputs, relevanceVerdictsByRoute, renderHumanReviewMarkdown, validateReviewManifest } from "../scripts/lib/assessment-review.mjs";
import { relevancePromptVersion, screeningPromptVersion } from "../scripts/lib/law-change-screening.mjs";

const evidencePackage = {
  schemaVersion: "1.0.0",
  methodologyVersion: "slava-v7",
  packageId: "test-promise--2026-09-10--generated",
  asOf: "2026-09-10",
  assessmentContext: { mode: "live", ruleVersion: "period-timing-v2", maintenanceBaseline: null },
  promise: { id: "test-promise", titleCz: "Testovací slib", originalTextCz: "Testovací slib." },
  evidence: [
    { id: "promise-source", url: "https://example.test/promise", factSummary: "Přesné znění slibu.", locator: "strana 1", publishedAt: "2025-01-01", primary: true, role: "promise-source" },
    { id: "change-1", url: "https://example.test/change-1", factSummary: "Úřední text změny zákona.", locator: "ČÁST PRVNÍ", publishedAt: "2026-09-01", primary: true, role: "law-change", title: "90: ČÁST PRVNÍ – Změna rozpočtových pravidel", structuredFacts: { titleCz: "Změna rozpočtových pravidel" }, matchBasis: { routeBasis: ["direct-structural-link", "controlled-tag"], matchedTagIds: ["fiscal-rules"], directLinkIdentifiers: ["cz-act-218-2000"] } },
    { id: "change-2", url: "https://example.test/change-2", factSummary: "Úřední text změny zákona.", locator: "ČÁST DRUHÁ", publishedAt: "2026-09-01", primary: true, role: "law-change", title: "90: ČÁST DRUHÁ – Přechodná ustanovení", structuredFacts: { titleCz: "Přechodná ustanovení" }, matchBasis: { routeBasis: ["controlled-tag"], matchedTagIds: ["fiscal-rules"], directLinkIdentifiers: [] } },
    { id: "conduct", url: "https://example.test/conduct", factSummary: "Ověřený krok.", locator: "záznam", publishedAt: "2026-09-10", primary: true, role: "conduct-evidence" }
  ]
};

const runtime = { assessorProviderA: "openai", assessorProviderB: "openai", arbiterProvider: "openai", assessorModelA: "a", assessorModelB: "b", arbiterModel: "c" };

test("loads only the active assessor and arbiter prompts", async () => {
  const prompts = await loadAssessmentPrompts();
  assert.equal(prompts.assessor.version, "assessor-v19");
  assert.equal(prompts.arbiter.version, "arbiter-v11");
  assert.match(prompts.assessor.contentHash, /^[a-f0-9]{64}$/);
  assert.match(prompts.arbiter.contentHash, /^[a-f0-9]{64}$/);
  assert.match(prompts.assessor.instructions, /maintenanceBaseline/);
  assert.match(prompts.assessor.instructions, /Never return an empty citation array/);
  assert.match(prompts.arbiter.instructions, /maintenanceBaseline/);
  assert.match(prompts.assessor.instructions, /changeRelevance/);
  assert.match(prompts.arbiter.instructions, /changeRelevance/);
});

test("retains only the active prompt files", async () => {
  const promptFiles = await readdir(resolve(import.meta.dirname, "../automation/prompts"));
  assert.deepEqual(promptFiles.sort(), [`${arbiterPromptVersion}.md`, `${assessorPromptVersion}.md`, `${screeningPromptVersion}.md`, `${relevancePromptVersion}.md`].sort());
});

test("plans an unseen package for human review without publication", () => {
  const manifest = { schemaVersion: reviewManifestSchemaVersion, fingerprintVersion: assessmentFingerprintVersion, publicationApproved: false, proposals: [] };
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

const reviewA = {
  promiseId: "test-promise",
  changeRelevance: [
    { evidenceId: "change-1", relevant: true, reasonCz: "Mění schvalování rozpočtu, o kterém slib mluví." },
    { evidenceId: "change-2", relevant: false, reasonCz: "Upravuje jen dokončení zahájených řízení." }
  ],
  status: "moving-towards",
  evidenceSufficient: true,
  citedEvidenceIds: ["promise-source", "change-1", "conduct"],
  explanationCz: "Vláda předložila změnu pravidel pro schvalování rozpočtu, kterou slib žádá.",
  confidence: "medium",
  uncertainties: []
};
const reviewB = { ...reviewA, changeRelevance: [reviewA.changeRelevance[0], { evidenceId: "change-2", relevant: true, reasonCz: "Určuje, podle kterých pravidel se řízení dokončí." }] };
const auditRecord = {
  validatedAssessments: { "assessor-a": reviewA, "assessor-b": reviewB },
  arbiter: null,
  resolution: { state: "candidate", reason: "assessor-consensus", status: "moving-towards", selectedReview: "consensus" }
};

test("counts the assessors' relevance verdicts by the tag or direct link that routed each law change", () => {
  const verdicts = relevanceVerdictsByRoute(evidencePackage, auditRecord);
  assert.deepEqual(verdicts.find(({ route }) => route === "tag:fiscal-rules"), { route: "tag:fiscal-rules", verdicts: 4, notRelevant: 1 });
  assert.deepEqual(verdicts.find(({ route }) => route === "direct:cz-act-218-2000"), { route: "direct:cz-act-218-2000", verdicts: 2, notRelevant: 0 });
  const merged = mergeRelevanceVerdicts([verdicts, verdicts]);
  assert.deepEqual(merged[0], { route: "tag:fiscal-rules", verdicts: 8, notRelevant: 2 });
});

test("the human review page shows each assessor's relevance verdict for every law change", () => {
  const proposal = { proposalId: "test-promise--abc", candidateStatus: "moving-towards", resolutionState: "candidate", resolutionReason: "assessor-consensus", supersedesProposalId: null };
  const markdown = renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal });
  assert.match(markdown, /### Souvisí změny zákonů se slibem\?/);
  assert.match(markdown, /Změna rozpočtových pravidel\]\(https:\/\/example.test\/change-1\) \| ano: Mění schvalování rozpočtu/);
  assert.match(markdown, /Přechodná ustanovení\]\(https:\/\/example.test\/change-2\) \| ne: Upravuje jen dokončení zahájených řízení\. \| ano: Určuje, podle kterých pravidel se řízení dokončí\. \|/);
});

test("the human review page shows both differing assessments and the arbiter's decision", () => {
  const against = { ...reviewB, status: "moving-against", explanationCz: "Schválené znění pravidla pro schvalování rozpočtu oslabuje.", uncertainties: ["Není jasné, zda se změna použije už na příští rozpočet."] };
  const arbitrated = {
    validatedAssessments: { "assessor-a": reviewA, "assessor-b": against },
    arbiter: { output: { choice: "assessor-b", citedEvidenceIds: ["conduct"], explanationCz: "Druhý posudek vychází ze schváleného znění, o kterém se hlasovalo." } },
    resolution: { state: "candidate", reason: "arbiter-selection", status: "moving-against", selectedReview: "assessor-b" }
  };
  const proposal = { proposalId: "test-promise--def", candidateStatus: "moving-against", resolutionState: "candidate", resolutionReason: "arbiter-selection", supersedesProposalId: null };
  const markdown = renderHumanReviewMarkdown({ evidencePackage, auditRecord: arbitrated, proposal });
  // The public candidate is the arbiter's choice, with its explanation.
  assert.match(markdown, /## Návrh pro veřejný web[^]*\*\*Směřuje proti slibu \(−1\)\*\*[^]*Schválené znění pravidla pro schvalování rozpočtu oslabuje\./);
  assert.match(markdown, /o neshodě automatických posudků rozhodl třetí hodnotitel/);
  assert.match(markdown, /### Odlišné posudky/);
  assert.match(markdown, /#### První posudek: Směřuje ke splnění \(\+1\)/);
  assert.match(markdown, /#### Druhý posudek: Směřuje proti slibu \(−1\)[^]*Není jasné, zda se změna použije už na příští rozpočet\./);
  assert.match(markdown, /### Rozhodnutí třetího hodnotitele\n\nDruhý posudek vychází ze schváleného znění, o kterém se hlasovalo\./);
});

test("the human review page never calls differing assessments a consensus when the arbiter was not called", () => {
  const against = { ...reviewB, status: "moving-against" };
  const uncalled = {
    validatedAssessments: { "assessor-a": reviewA, "assessor-b": against },
    arbiter: null,
    resolution: { state: "human-review-required", reason: "arbiter-input-too-large", status: null, selectedReview: null }
  };
  const proposal = { proposalId: "test-promise--ghi", candidateStatus: null, resolutionState: "human-review-required", resolutionReason: "arbiter-input-too-large", supersedesProposalId: null };
  const markdown = renderHumanReviewMarkdown({ evidencePackage, auditRecord: uncalled, proposal });
  assert.doesNotMatch(markdown, /Shoda hodnotitelů|dospěli ke stejnému výsledku/);
  assert.match(markdown, /\*Nevznikl žádný návrh veřejného hodnocení ani vysvětlení\.\*/);
  assert.match(markdown, /### Odlišné posudky/);
  assert.match(markdown, /#### Druhý posudek: Směřuje proti slibu \(−1\)/);
  assert.match(markdown, /### Rozhodnutí třetího hodnotitele\n\nTřetí hodnotitel nebyl zavolán, protože balíček s oběma posudky je větší, než dokáže přečíst\./);
});
