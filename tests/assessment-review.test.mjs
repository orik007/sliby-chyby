import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { arbiterPromptVersion, assessorPromptVersion, loadAssessmentPrompts } from "../scripts/lib/assessment-config.mjs";
import { assessmentFingerprintVersion, mergeRelevanceVerdicts, reviewManifestSchemaVersion, planAssessmentInputs, relevanceVerdictsByRoute, renderHumanReviewMarkdown, validateReviewManifest } from "../scripts/lib/assessment-review.mjs";
import { relevancePromptVersion, screeningPromptVersion } from "../scripts/lib/law-change-screening.mjs";
import { hashAssessmentContent, hashAssessmentFingerprint } from "../scripts/lib/assessment-pipeline.mjs";
import { exclusionOf, loadRelevanceVerdicts, withoutIrrelevantLawChanges } from "../scripts/lib/irrelevance-verdicts.mjs";

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
  assert.equal(prompts.assessor.version, "assessor-v25");
  assert.equal(prompts.arbiter.version, "arbiter-v18");
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

test("a package that differs from an assessed one only by the law changes its assessors both found not relevant keeps that assessment", () => {
  const prompts = { assessor: { version: "test", contentHash: "a".repeat(64) }, arbiter: { version: "test", contentHash: "b".repeat(64) } };
  const entries = [{ evidenceId: "change-2", title: "90: ČÁST DRUHÁ – Přechodná ustanovení", proposalId: "test-promise--abc", reasonsCz: ["Jiné téma.", "Jiné téma."] }];
  const conduct = { ...evidencePackage.evidence[3], structuredFacts: { concernsLawChanges: [{ evidenceId: "change-1" }, { evidenceId: "change-2" }] } };
  const assessed = { ...evidencePackage, evidence: [...evidencePackage.evidence.slice(0, 3), conduct] };
  const reduced = withoutIrrelevantLawChanges(assessed, entries);
  assert.deepEqual(reduced.evidence.at(-1).structuredFacts.concernsLawChanges, [{ evidenceId: "change-1" }]);
  const reducedContentHash = hashAssessmentContent(reduced);
  const proposal = {
    proposalId: "test-promise--abc", promiseId: "test-promise", assessmentFingerprint: "c".repeat(64), assessmentContentHash: hashAssessmentContent(assessed), packageHash: "d".repeat(64),
    resolutionState: "candidate", candidateStatus: "moving-towards", evaluatedAt: "2026-10-01T00:00:00Z", publicRevisionAtEvaluation: 0, humanReviewRequired: true, publicationApproved: false,
    path: "automation/review-proposals/test-promise/x", humanReviewPath: "automation/review-proposals/test-promise/x/review.md", supersedesProposalId: null, supersededByProposalId: null,
    reducedAssessmentContentHash: reducedContentHash, reducedAssessmentFingerprint: hashAssessmentFingerprint({ assessmentContentHash: reducedContentHash, prompts, runtime })
  };
  const manifest = { schemaVersion: reviewManifestSchemaVersion, fingerprintVersion: assessmentFingerprintVersion, publicationApproved: false, proposals: [proposal] };
  assert.equal(planAssessmentInputs({ packages: [{ path: "r.json", evidencePackage: reduced }], manifest, prompts, runtime })[0].disposition, "unchanged");
  // Another prompt, or anything else changed, is assessed.
  assert.equal(planAssessmentInputs({ packages: [{ path: "r.json", evidencePackage: reduced }], manifest, prompts: { ...prompts, assessor: { version: "test2", contentHash: "e".repeat(64) } }, runtime })[0].disposition, "assess");
  const changed = withoutIrrelevantLawChanges({ ...assessed, promise: { ...assessed.promise, titleCz: "Jiný slib" } }, entries);
  assert.equal(planAssessmentInputs({ packages: [{ path: "r.json", evidencePackage: changed }], manifest, prompts, runtime })[0].disposition, "assess");
});

test("the human review page lists the law changes left out as not relevant, with both reasons", () => {
  const withExcluded = { ...evidencePackage, excludedLawChanges: [{ evidenceId: "change-9", title: "77: ČÁST DEVÁTÁ – Změna zákona o | myslivosti", proposalId: "test-promise--old", reasonsCz: ["Myslivost se slibu netýká.", "Jiné téma."] }] };
  const markdown = renderHumanReviewMarkdown({ evidencePackage: withExcluded, auditRecord, proposal: { proposalId: "test-promise--abc", candidateStatus: "moving-towards", resolutionState: "candidate", resolutionReason: "assessor-consensus", supersedesProposalId: null } });
  assert.match(markdown, /### Vyřazené změny zákonů/);
  assert.match(markdown, /- \*\*77: ČÁST DEVÁTÁ – Změna zákona o \/ myslivosti\*\* \(posouzení test-promise--old\): Myslivost se slibu netýká\. \/ Jiné téma\./);
  assert.doesNotMatch(renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal: { proposalId: "test-promise--abc", candidateStatus: "moving-towards", resolutionState: "candidate", resolutionReason: "assessor-consensus", supersedesProposalId: null } }), /Vyřazené změny zákonů/);
  // The page of the assessment whose verdicts leave a change out names it,
  // because a package without it keeps that assessment.
  const bothIrrelevant = { ...auditRecord, prompts: { assessor: { version: "assessor-v25", contentHash: "a".repeat(64) } }, validatedAssessments: { "assessor-a": reviewA, "assessor-b": { ...reviewB, changeRelevance: reviewA.changeRelevance } } };
  const withVersions = { ...evidencePackage, evidence: evidencePackage.evidence.map((item) => (item.role === "law-change" ? { ...item, structuredFacts: { ...item.structuredFacts, versions: { proposed: { textCz: "Text." } } } } : item)) };
  const leaving = renderHumanReviewMarkdown({ evidencePackage: withVersions, auditRecord: bothIrrelevant, proposal: { proposalId: "test-promise--abc", candidateStatus: "moving-towards", resolutionState: "candidate", resolutionReason: "assessor-consensus", supersedesProposalId: null } });
  assert.match(leaving, /další balíčky tohoto slibu vynechají[^\n]*\n\n- Změna zákona v návrhu projednávaném Sněmovnou: Přechodná ustanovení\n/);
  assert.doesNotMatch(renderHumanReviewMarkdown({ evidencePackage: withVersions, auditRecord: { ...bothIrrelevant, validatedAssessments: { "assessor-a": reviewA, "assessor-b": reviewB } }, proposal: { proposalId: "test-promise--abc", candidateStatus: "moving-towards", resolutionState: "candidate", resolutionReason: "assessor-consensus", supersedesProposalId: null } }), /další balíčky tohoto slibu vynechají/);
});

test("only a law change's latest verdict counts", async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), "verdicts-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  // The older assessment ran under one prompt, the newer one under another.
  const promptOf = { older: { assessor: { version: "assessor-v25", contentHash: "a".repeat(64) } }, newer: { assessor: { version: "assessor-v25", contentHash: "b".repeat(64) } } };
  const lawChange = { ...evidencePackage.evidence[2], structuredFacts: { titleCz: "Přechodná ustanovení", versions: { proposed: { textCz: "Text." } } } };
  const pkg = { ...evidencePackage, evidence: [evidencePackage.evidence[0], lawChange, evidencePackage.evidence[3]] };
  const verdict = (relevant) => ({ changeRelevance: [{ evidenceId: "change-2", relevant, reasonCz: relevant ? "Souvisí." : "Nesouvisí.", effectCz: "" }] });
  const proposals = [];
  for (const [name, evaluatedAt, relevantB] of [["older", "2026-10-01T00:00:00Z", false], ["newer", "2026-10-02T00:00:00Z", true]]) {
    const path = resolve(root, name);
    await mkdir(path);
    await writeFile(resolve(path, "evidence-package.json"), JSON.stringify(pkg));
    await writeFile(resolve(path, "assessment-run.json"), JSON.stringify({ prompts: promptOf[name], validatedAssessments: { "assessor-a": verdict(false), "assessor-b": verdict(relevantB) } }));
    proposals.push({ proposalId: `test-promise--${name}`, promiseId: "test-promise", evaluatedAt, path });
  }
  const latest = (await loadRelevanceVerdicts({ proposals })).get("test-promise").get("change-2");
  assert.deepEqual([latest.irrelevant, latest.entry], [false, null]);
  const onlyOlder = (await loadRelevanceVerdicts({ proposals: proposals.slice(0, 1) })).get("test-promise").get("change-2");
  assert.deepEqual([onlyOlder.irrelevant, onlyOlder.entry?.proposalId], [true, "test-promise--older"]);
  // Back under the older prompt, the older verdict's key matches again, but
  // the newer verdict, which found the change relevant, still decides.
  const exclusion = (verdicts) => exclusionOf({ verdicts, promise: pkg.promise, lawChange, assessorPrompt: promptOf.older.assessor });
  assert.equal(exclusion(await loadRelevanceVerdicts({ proposals })), null);
  assert.equal(exclusion(await loadRelevanceVerdicts({ proposals: proposals.slice(0, 1) }))?.proposalId, "test-promise--older");
});

const reviewA = {
  promiseId: "test-promise",
  changeRelevance: [
    { evidenceId: "change-1", relevant: true, reasonCz: "Mění schvalování rozpočtu, o kterém slib mluví.", effectCz: "Dosud rozpočet schvalovala vláda, nově | Sněmovna;\npravidlo se zpřísňuje." },
    { evidenceId: "change-2", relevant: false, reasonCz: "Upravuje jen dokončení zahájených řízení.", effectCz: "" }
  ],
  status: "moving-towards",
  evidenceSufficient: true,
  citedEvidenceIds: ["promise-source", "change-1", "conduct"],
  explanationCz: "Vláda předložila změnu pravidel pro schvalování rozpočtu, kterou slib žádá.",
  confidence: "medium",
  uncertainties: []
};
const reviewB = { ...reviewA, changeRelevance: [reviewA.changeRelevance[0], { evidenceId: "change-2", relevant: true, reasonCz: "Určuje, podle kterých pravidel se řízení dokončí.", effectCz: "Kontext dosavadní znění neuvádí, směr nelze určit." }] };
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
  // The effect of a relevant change follows its reason, on one table row.
  assert.match(markdown, /ano: Mění schvalování rozpočtu, o kterém slib mluví\.<br>Dopad: Dosud rozpočet schvalovala vláda, nově \/ Sněmovna; pravidlo se zpřísňuje\. \|/);
  assert.match(markdown, /ne: Upravuje jen dokončení zahájených řízení\. \|/);
  const withIrrelevantEffect = structuredClone(auditRecord);
  withIrrelevantEffect.validatedAssessments["assessor-a"].changeRelevance[1].effectCz = "Nepatří sem.";
  assert.doesNotMatch(renderHumanReviewMarkdown({ evidencePackage, auditRecord: withIrrelevantEffect, proposal }), /Nepatří sem/);
  assert.match(markdown, /Přechodná ustanovení\]\(https:\/\/example.test\/change-2\) \| ne: Upravuje jen dokončení zahájených řízení\. \| ano: Určuje, podle kterých pravidel se řízení dokončí\.<br>Dopad: Kontext dosavadní znění neuvádí, směr nelze určit\. \|/);
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

test("the human review page shows both assessments when they share a score but not the sufficiency of the evidence", () => {
  const insufficient = { ...reviewB, evidenceSufficient: false, explanationCz: "Z podkladů není jasné, zda změna platí i pro obce." };
  const record = {
    validatedAssessments: { "assessor-a": reviewA, "assessor-b": insufficient },
    arbiter: null,
    resolution: { state: "candidate", reason: "assessor-consensus-one-sufficient", status: "moving-towards", selectedReview: "assessor-a" }
  };
  const proposal = { proposalId: "test-promise--jkl", candidateStatus: "moving-towards", resolutionState: "candidate", resolutionReason: "assessor-consensus-one-sufficient", supersedesProposalId: null };
  const markdown = renderHumanReviewMarkdown({ evidencePackage, auditRecord: record, proposal });
  assert.doesNotMatch(markdown, /Shoda hodnotitelů|dospěli ke stejnému výsledku/);
  assert.match(markdown, /### Stejné hodnocení, rozdílný názor na podklady\n\nOba nezávislí hodnotitelé dali stejné hodnocení: \*\*Směřuje ke splnění \(\+1\)\*\*/);
  assert.match(markdown, /#### První posudek: podklady stačí/);
  assert.match(markdown, /#### Druhý posudek: podklady nestačí\n\nZ podkladů není jasné, zda změna platí i pro obce\./);
  assert.doesNotMatch(markdown, /Rozhodnutí třetího hodnotitele/);
});
