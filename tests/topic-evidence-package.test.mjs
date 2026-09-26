import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import { validatePromiseRegistry } from "../scripts/lib/attribution.mjs";
import { buildLawChangeEvidencePackage, estimatePackageTokens, lawChangesAtCutoff, lawChangeEvidenceId, versionOfChange } from "../scripts/lib/topic-evidence-package.mjs";
import { estimateTokens, maxRequestInputTokens } from "../scripts/lib/assessment-config.mjs";

const assessorInstructions = "assessor instructions";

const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/promise-registry/promises.json", import.meta.url), "utf8")));
const fiscalPromise = registry.promises.find(({ id }) => id === "candidate-d5359e35a4c4");
const collectorRun = { schemaVersion: "1.0.0", runId: "fixture-run", records: [] };

function attributedVoteRecord(overrides = {}) {
  return createCollectedRecord({
    id: overrides.id ?? "psp--fiscal-vote-1",
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: overrides.occurredAt ?? "2026-06-01T00:00:00",
    title: "Hlasování o novele zákona o pravidlech rozpočtové odpovědnosti",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/hlasy.sqw?g=1",
    payload: {
      externalVoteId: "1",
      counts: { yes: 90, no: 10 },
      partyVoteSummaries: [{
        partyId: fiscalPromise.partyId,
        attributionStatus: "attributed",
        majorityChoice: "yes",
        counts: { yes: 20, no: 0 },
        strictMajorityThreshold: 11,
        eligibleMemberCount: 21
      }],
      linkedPrints: [{ externalPrintId: "43200", printKindId: "1", historyContexts: [{ actionCz: "souhlas", stageCz: "3. čtení" }] }],
      ...overrides.payload
    }
  });
}

function lawChange(index, textCz = "Zákon č. 23/2017 Sb., o pravidlech rozpočtové odpovědnosti, se mění takto: …", versions = null) {
  const heading = index === 1 ? "ČÁST PRVNÍ" : "ČÁST DRUHÁ";
  const titleCz = index === 1 ? "Změna zákona o pravidlech rozpočtové odpovědnosti" : "Změna rozpočtových pravidel";
  return {
    changeId: `43200-${index}`,
    printId: "43200",
    printNumber: 90,
    printKindId: "1",
    printTitleCz: "Vládní návrh zákona, kterým se mění některé zákony v oblasti veřejných rozpočtů",
    printPageUrl: "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=90&CT1=0",
    addedIn: "proposed",
    heading,
    titleCz,
    acts: [{ act: index === 1 ? "23/2017" : "218/2000", name: null }],
    titleActs: [{ act: index === 1 ? "23/2017" : "218/2000", name: null }],
    identifiers: [index === 1 ? "cz-act-23-2017" : "cz-act-218-2000"],
    versions: versions ?? { proposed: { heading, titleCz, textCz, document: { filename: "t009000.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=1" } } },
    senateResolutions: []
  };
}

const route = { routeBasis: ["direct-structural-link"], matchedTagIds: [], directLinkIdentifiers: ["cz-act-23-2017"] };
const printFirstSeenOn = new Map([["43200", "2026-02-01"]]);

test("a package holds every kept law change in full and the party's conduct on its print, once", () => {
  const vote = attributedVoteRecord();
  const pkg = buildLawChangeEvidencePackage({
    assessorInstructions,
    promise: fiscalPromise,
    keptChanges: [{ change: lawChange(2), route }, { change: lawChange(1), route }],
    recordsByPrintId: new Map([["43200", [vote]]]),
    printFirstSeenOn,
    collectorRun,
    asOf: "2026-06-15"
  });
  assert.equal(pkg.promise.id, fiscalPromise.id);
  const changes = pkg.evidence.filter(({ role }) => role === "law-change");
  assert.deepEqual(changes.map(({ id }) => id), [lawChangeEvidenceId(lawChange(1)), lawChangeEvidenceId(lawChange(2))]);
  assert.equal(changes[0].structuredFacts.versions.proposed.textCz, lawChange(1).versions.proposed.textCz);
  assert.equal(changes[0].publishedAt, "2026-02-01");
  assert.deepEqual(changes[0].matchBasis, route);
  const conduct = pkg.evidence.filter(({ role }) => role === "conduct-evidence");
  assert.equal(conduct.length, 1, "a vote on the print appears once for all its law changes");
  assert.equal(conduct[0].matchBasis.attributionStatus, "verified-party-vote");
  // The vote approved the bill, but psp.cz has no approved text in this
  // fixture, so the proposed version is given and the gap is named.
  assert.deepEqual(conduct[0].structuredFacts.concernsLawChanges.map(({ changeId, version, publishedVersionMissing }) => [changeId, version, publishedVersionMissing]), [["43200-1", "proposed", "approved"], ["43200-2", "proposed", "approved"]]);
  assert.equal(pkg.generation.lawChangeCount, 2);
  assert.equal(pkg.generation.oversized, false);
});

test("nothing is trimmed: many law changes all stay in the package", () => {
  const keptChanges = Array.from({ length: 40 }, (_, index) => ({ change: { ...lawChange(index + 1), heading: `ČÁST ${index + 1}` }, route }));
  const pkg = buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges, recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg.evidence.filter(({ role }) => role === "law-change").length, 40);
});

test("a package above the normal-price input limit is marked oversized, not trimmed", () => {
  const huge = "x".repeat(maxRequestInputTokens * 3 + 10);
  const pkg = buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change: lawChange(1, huge), route }], recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg.generation.oversized, true);
  assert.ok(pkg.generation.estimatedTokens > maxRequestInputTokens);
  assert.equal(pkg.evidence.find(({ role }) => role === "law-change").structuredFacts.versions.proposed.textCz, huge);
  assert.equal(estimatePackageTokens({ text: "abc" }), Math.ceil(JSON.stringify({ text: "abc" }).length / 3));
});

test("the assessor instructions count towards the input limit of a package", () => {
  const build = (text, instructions) => buildLawChangeEvidencePackage({ assessorInstructions: instructions, promise: fiscalPromise, keptChanges: [{ change: lawChange(1, text), route }], recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  // A text that leaves room for short instructions but not for long ones.
  const text = "x".repeat((maxRequestInputTokens - 6_000) * 3);
  assert.equal(build(text, assessorInstructions).generation.oversized, false);
  const longInstructions = "i".repeat(10_000 * 3);
  assert.equal(estimateTokens(longInstructions), 10_000);
  assert.equal(build(text, longInstructions).generation.oversized, true);
});

test("a law change without attributable conduct of the promise's party builds no package", () => {
  // No partyVoteSummaries: nobody from this party is recorded on the vote.
  const unattributed = createCollectedRecord({
    id: "psp--unrelated-vote",
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-06-01T00:00:00",
    title: "Hlasování bez vazby na tuto stranu",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/hlasy.sqw?g=2",
    payload: { externalVoteId: "2", counts: { yes: 50, no: 40 }, linkedPrints: [{ externalPrintId: "43200", historyContexts: [{ actionCz: "souhlas" }] }] }
  });
  const pkg = buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change: lawChange(1), route }], recordsByPrintId: new Map([["43200", [unattributed]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg, null);
  assert.equal(buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [], recordsByPrintId: new Map(), printFirstSeenOn, collectorRun, asOf: "2026-06-15" }), null);
});

function submissionRecord() {
  return createCollectedRecord({
    id: "psp-core-2025--print-step-1",
    sourceId: "psp-core-2025",
    kind: "legislative-step",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-01-10T00:00:00",
    title: "90/0: předložen",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/historie.sqw?o=10&t=90",
    payload: { externalPrintId: "43200", printKindId: "1", printNumber: 90, actionCz: "předložen", proposal: { kind: "government-proposal", submittedOn: "2026-01-10", proposerPartyIds: [fiscalPromise.partyId] } }
  });
}

test("each conduct names the version it concerns: the submission the proposal, the approving vote the approved text", () => {
  const versions = {
    proposed: { heading: "ČÁST PRVNÍ", titleCz: "Změna", textCz: "Schodek nejvýše 2 %.", document: null },
    approved: { heading: "ČÁST PRVNÍ", titleCz: "Změna", textCz: "Schodek nejvýše 3 %.", document: null }
  };
  const pkg = buildLawChangeEvidencePackage({
    assessorInstructions,
    promise: fiscalPromise,
    keptChanges: [{ change: lawChange(1, null, versions), route }],
    recordsByPrintId: new Map([["43200", [submissionRecord(), attributedVoteRecord({ payload: { linkedPrints: [{ externalPrintId: "43200", printKindId: "1", historyContexts: [{ actionCz: "souhlas", stageCz: "3. čtení" }] }] } })]]]),
    printFirstSeenOn,
    collectorRun,
    asOf: "2026-06-15"
  });
  const conduct = Object.fromEntries(pkg.evidence.filter(({ role }) => role === "conduct-evidence").map((evidence) => [evidence.type, evidence.structuredFacts.concernsLawChanges[0]]));
  assert.equal(conduct["legislative-step"].version, "proposed");
  assert.equal(conduct["parliamentary-vote"].version, "approved");
  assert.equal(conduct["parliamentary-vote"].publishedVersionMissing, null);
  assert.match(pkg.evidence.find(({ role }) => role === "law-change").factSummary, /Versions: proposed text; text approved by the Chamber\./);
});

test("a change added in the debate was never submitted; a removed change is named as removed", () => {
  const added = { ...lawChange(2), addedIn: "approved", versions: { approved: { heading: "ČÁST DRUHÁ", titleCz: "Změna", textCz: "Nová část.", document: null } } };
  assert.equal(versionOfChange(added, { version: "proposed", withSenateResolution: false, mark: null }), null);
  assert.equal(versionOfChange(added, { version: "passed", withSenateResolution: false, mark: null }).publishedVersionMissing, "passed");
  // Insisting on the bill re-adopts the approved text: nothing is missing.
  assert.equal(versionOfChange(added, { version: "passed", withSenateResolution: false, mark: null, sameAsApproved: true }).publishedVersionMissing, null);
  const removed = { ...lawChange(1), versions: { proposed: lawChange(1).versions.proposed, approved: { removed: true } } };
  assert.deepEqual(versionOfChange(removed, { version: "approved", withSenateResolution: true, mark: null }), { version: "approved", removed: true, publishedVersionMissing: null, withSenateResolution: true, mark: null });
});

test("a vote after the Senate's return brings the Senate resolution into the package once", () => {
  const resolution = { partNumber: 6, document: { filename: "t009006.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=6" }, textCz: "Senát vrací návrh zákona ve znění pozměňovacích návrhů." };
  const change = (index) => ({ ...lawChange(index), versions: { proposed: lawChange(index).versions.proposed, approved: { sameAs: "proposed", document: null } }, senateResolutions: [resolution] });
  const afterSenate = attributedVoteRecord({ id: "psp--vote-senate", occurredAt: "2026-05-26T00:00:00", payload: { linkedPrints: [{ externalPrintId: "43200", printKindId: "1", historyContexts: [{ actionCz: "pozm. přijat", stageCz: "Sněmovna (Senát)" }] }] } });
  const pkg = buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change: change(1), route }, { change: change(2), route }], recordsByPrintId: new Map([["43200", [afterSenate]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  const resolutions = pkg.evidence.filter(({ role }) => role === "senate-resolution");
  assert.equal(resolutions.length, 1);
  assert.equal(resolutions[0].structuredFacts.textCz, resolution.textCz);
  assert.equal(resolutions[0].publishedAt, "2026-05-26");
  assert.deepEqual(pkg.evidence.filter(({ role }) => role === "law-change").map(({ structuredFacts }) => structuredFacts.senateResolutionEvidenceIds), [[resolutions[0].id], [resolutions[0].id]]);
  assert.match(pkg.evidence.find(({ role }) => role === "law-change").factSummary, /text approved by the Chamber \(the same as the proposed text\)/);
  const concern = pkg.evidence.find(({ role }) => role === "conduct-evidence").structuredFacts.concernsLawChanges[0];
  assert.deepEqual([concern.version, concern.withSenateResolution], ["approved", true]);

  // Without such a vote, the resolution stays out of the package.
  const noReturn = buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change: change(1), route }], recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(noReturn.evidence.some(({ role }) => role === "senate-resolution"), false);
});

test("a package holds only the versions up to the latest one its conduct concerns", () => {
  const versions = {
    proposed: { heading: "ČÁST PRVNÍ", titleCz: "Změna", textCz: "Schodek nejvýše 2 %.", document: null },
    approved: { heading: "ČÁST PRVNÍ", titleCz: "Změna", textCz: "Schodek nejvýše 3 %.", document: null }
  };
  const pkg = buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change: lawChange(1, null, versions), route }], recordsByPrintId: new Map([["43200", [submissionRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.deepEqual(Object.keys(pkg.evidence.find(({ role }) => role === "law-change").structuredFacts.versions), ["proposed"]);
});

test("at the cutoff a law change has only the versions its print's conduct concerns", () => {
  const approvedVote = attributedVoteRecord({ id: "psp--vote-approved", payload: { linkedPrints: [{ externalPrintId: "43200", printKindId: "1", historyContexts: [{ actionCz: "souhlas", stageCz: "3. čtení" }] }] } });
  const submission = { ...attributedVoteRecord(), id: "psp--submission", kind: "legislative-step", payload: {} };
  const withApproved = { ...lawChange(1), versions: { proposed: lawChange(1).versions.proposed, approved: { heading: "ČÁST PRVNÍ", titleCz: "Změna", textCz: "Nový text.", amendedAct: null, document: null } } };
  const added = { ...lawChange(2), changeId: "43200-approved-2", addedIn: "approved", versions: { approved: { heading: "ČÁST DRUHÁ", titleCz: "Změna", textCz: "Nová část.", amendedAct: null, document: null } } };
  // Only the submission before the cutoff: the proposal, without the added part.
  const early = lawChangesAtCutoff([withApproved, added], new Map([["43200", [submission]]]));
  assert.deepEqual(early.map(({ changeId, versions }) => [changeId, Object.keys(versions)]), [["43200-1", ["proposed"]]]);
  // After the approving vote, both changes with the approved text.
  const late = lawChangesAtCutoff([withApproved, added], new Map([["43200", [submission, approvedVote]]]));
  assert.deepEqual(late.map(({ changeId, versions }) => [changeId, Object.keys(versions)]), [["43200-1", ["proposed", "approved"]], ["43200-approved-2", ["approved"]]]);
  // A print without conduct naming it contributes no law change.
  assert.deepEqual(lawChangesAtCutoff([withApproved], new Map()), []);

  // A print without a proposal text whose parts come from the approved text
  // is, before that text, one law change known by its title.
  const titleOnly = (index) => ({ ...lawChange(index), changeId: `43200-${index}`, printTitleCz: "Návrh zákona, kterým se mění zákon č. 23/2017 Sb.", titleActs: [], versions: { proposed: { heading: null, titleCz: "Návrh zákona", textCz: null, amendedAct: null, document: null }, approved: { heading: `ČÁST ${index}`, titleCz: "Změna", textCz: "Text.", amendedAct: { act: "23/2017", name: null }, document: null } } });
  const beforeText = lawChangesAtCutoff([titleOnly(1), titleOnly(2)], new Map([["43200", [submission]]]));
  assert.equal(beforeText.length, 1);
  assert.deepEqual(beforeText[0].identifiers, ["cz-act-23-2017"]);
});
