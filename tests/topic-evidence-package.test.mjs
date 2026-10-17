import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import { loadTrackedPromises } from "../scripts/lib/published-promises.mjs";
import { buildLawChangeEvidencePackage, estimatePackageTokens, lawChangesAtCutoff, lawChangeEvidenceId, versionOfChange } from "../scripts/lib/topic-evidence-package.mjs";
import { arbiterReviewReserveTokens, charactersPerToken, estimateTokens, maxPackageRequestTokens, maxRequestInputTokens } from "../scripts/lib/assessment-config.mjs";
import { withContext } from "../scripts/lib/law-context.mjs";

const assessorInstructions = "assessor instructions";

const registry = await loadTrackedPromises(fileURLToPath(new URL("..", import.meta.url)));
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

test("the government's opinion on a bill it did not submit is conduct on its proposed version, with its text", () => {
  const opinionRecord = (opinion, resultCz) => createCollectedRecord({
    id: `psp-core-2025--government-opinion-43200-1-${opinion}`,
    sourceId: "psp-core-2025",
    kind: "government-opinion",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-02-10T10:00:00",
    title: `90/1: Stanovisko vlády (${resultCz}) — Návrh zákona`,
    publisher: "Chamber of Deputies",
    url: "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=90&CT1=1",
    payload: {
      externalPrintId: "43200",
      printKindId: "2",
      printNumber: 90,
      partNumber: 1,
      printTitleCz: "Návrh zákona",
      printUrl: "https://public.psp.cz/sqw/historie.sqw?o=10&t=90",
      resultCz,
      opinion,
      distributedOn: "2026-02-10",
      proposal: { kind: "government-opinion", proposerPartyIds: [fiscalPromise.partyId] }
    }
  });
  const opinionText = { partNumber: 1, document: { filename: "t009001.doc", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=9" }, textCz: "Vláda vyslovuje nesouhlas s návrhem zákona." };
  const change = { ...lawChange(1), printKindId: "2", governmentOpinions: [opinionText] };
  const build = (records) => buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change, route }], recordsByPrintId: new Map([["43200", records]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  const pkg = build([opinionRecord("disagrees", "nesouhlas")]);
  const [conduct] = pkg.evidence.filter(({ role }) => role === "conduct-evidence");
  assert.equal(conduct.matchBasis.attributionStatus, "verified-government-opinion");
  assert.equal(conduct.structuredFacts.opinion, "disagrees");
  assert.equal(conduct.structuredFacts.textCz, opinionText.textCz);
  assert.deepEqual(conduct.structuredFacts.document, opinionText.document);
  assert.deepEqual(conduct.structuredFacts.concernsLawChanges.map(({ version }) => version), ["proposed"]);
  assert.match(conduct.factSummary, /^The government disagrees with print 90/);
  // A neutral opinion is not conduct, so it alone gives no package.
  assert.equal(build([opinionRecord("neutral", "neutrální")]), null);
});

test("nothing is trimmed: many law changes all stay in the package", () => {
  const keptChanges = Array.from({ length: 40 }, (_, index) => ({ change: { ...lawChange(index + 1), heading: `ČÁST ${index + 1}` }, route }));
  const pkg = buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges, recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg.evidence.filter(({ role }) => role === "law-change").length, 40);
});

test("a package larger than the models can read even without context is marked oversized, and its text is never trimmed", () => {
  const huge = "x".repeat(maxRequestInputTokens * charactersPerToken + 10);
  const pkg = buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change: lawChange(1, huge), route }], recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg.generation.oversized, true);
  assert.ok(pkg.generation.estimatedTokens > maxRequestInputTokens);
  assert.equal(pkg.evidence.find(({ role }) => role === "law-change").structuredFacts.versions.proposed.textCz, huge);
  assert.equal(estimatePackageTokens({ text: "abc" }), Math.ceil(JSON.stringify({ text: "abc" }).length / charactersPerToken));
});

test("a package too large with its context fits by leaving out the longest provisions, never the text, and names them", () => {
  const provision = (path, citation, textCz, wording = "2026-01-01") => ({ act: "23/2017", wording, path, citation, textCz });
  const huge = "h".repeat(maxRequestInputTokens * charactersPerToken);
  const versionContext = (provisions) => ({
    conductDate: "2026-02-01",
    amendedAct: "23/2017",
    instructions: [{ instructionCz: "V § 1 …", targets: Object.keys(provisions).map((id) => ({ target: provisions[id].citation, status: "found", wording: provisions[id].wording, provisionIds: [id] })) }],
    provisions
  });
  const shared = provision("dokument/norma/par_2", "§ 2", "sdílené znění");
  const context = {
    versions: {
      proposed: versionContext({ a: provision("dokument/norma/par_1", "§ 1", huge), b: shared, c: provision("dokument/norma/par_3/odst_1", "§ 3 odst. 1", "krátké znění") }),
      approved: versionContext({ b: shared, d: { ...provision("dokument/prilohy/priloha_1", "příloha č. 1", "příloha", "0000-00-00"), promulgatedOn: "2017-02-01" } })
    }
  };
  const versions = {
    proposed: { heading: "ČÁST PRVNÍ", titleCz: "Změna zákona", textCz: "Zákon č. 23/2017 Sb. se mění takto: …", document: { filename: "t.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=1" } },
    approved: { heading: "ČÁST PRVNÍ", titleCz: "Změna zákona", textCz: "Zákon č. 23/2017 Sb. se mění takto: … (schváleno)", document: { filename: "s.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=2" } }
  };
  const change = withContext(lawChange(1, undefined, versions), context);
  const vote = attributedVoteRecord({ payload: { linkedPrints: [{ externalPrintId: "43200", printKindId: "1", historyContexts: [{ actionCz: "souhlas", stageCz: "3. čtení" }] }] } });
  const build = (contextOf) => buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change, route }], recordsByPrintId: new Map([["43200", [vote]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15", contextOf });
  assert.equal(build(null).generation.oversized, true, "without the contexts the package cannot be fitted");
  const pkg = build(() => context);
  assert.equal(pkg.generation.oversized, false);
  assert.ok(pkg.generation.estimatedTokens <= maxPackageRequestTokens);
  const facts = pkg.evidence.find(({ role }) => role === "law-change").structuredFacts;
  assert.equal(facts.versions.proposed.textCz, versions.proposed.textCz, "the text is never trimmed");
  assert.equal(facts.versions.approved.textCz, versions.approved.textCz);
  const proposedContext = facts.versions.proposed.contextCz;
  assert.match(proposedContext, /Not supplied, because the evidence package would not otherwise fit what the models can read with room left for the arbiter to read both reviews: the wording of 1 of the 3 provisions this version's context holds \(§ 1 zákona č\. 23\/2017 Sb\.\)/);
  assert.ok(!proposedContext.includes(huge.slice(0, 1000)));
  assert.match(proposedContext, /§ 3 odst\. 1 zákona č\. 23\/2017 Sb\. \(wording from 2026-01-01\):\nkrátké znění/, "the shorter provisions are put back");
  assert.match(facts.versions.approved.contextCz, /§ 2 zákona č\. 23\/2017 Sb\. \(wording from 2026-01-01\): the same text as supplied for the proposed text\./);
  assert.deepEqual(pkg.generation.contextOmissions, [{ evidenceId: lawChangeEvidenceId(change), version: "proposed", suppliedCount: 2, omitted: [{ act: "23/2017", wording: "2026-01-01", paths: ["dokument/norma/par_1"] }] }]);
});

test("a package is fitted with room for the arbiter to read both reviews, or, when its text leaves no such room, to what the models can read", () => {
  const provision = (path, textCz) => ({ act: "23/2017", wording: "2026-01-01", path, citation: path.replace("dokument/norma/par_", "§ "), textCz });
  const contextWith = (provisions) => ({
    versions: {
      proposed: {
        conductDate: "2026-02-01",
        amendedAct: "23/2017",
        instructions: [{ instructionCz: "V § 1 …", targets: Object.keys(provisions).map((id) => ({ target: provisions[id].citation, status: "found", wording: "2026-01-01", provisionIds: [id] })) }],
        provisions
      }
    }
  });
  const build = (textTokens, contextTokens) => {
    const versions = { proposed: { heading: "ČÁST PRVNÍ", titleCz: "Změna zákona", textCz: "t".repeat(textTokens * charactersPerToken), document: null } };
    // Twenty provisions of the same size, so the context can be cut in steps.
    const provisions = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`p${index}`, provision(`dokument/norma/par_${index + 1}`, "c".repeat(contextTokens / 20 * charactersPerToken))]));
    const context = contextWith(provisions);
    return buildLawChangeEvidencePackage({ assessorInstructions, promise: fiscalPromise, keptChanges: [{ change: withContext(lawChange(1, null, versions), context), route }], recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15", contextOf: () => context });
  };
  assert.equal(maxPackageRequestTokens, maxRequestInputTokens - arbiterReviewReserveTokens);
  // The models could read it whole, but the arbiter could not read it with both reviews.
  const reserved = build(maxPackageRequestTokens - 30_000, 40_000);
  assert.ok(reserved.generation.contextOmissions.length > 0);
  assert.ok(reserved.generation.estimatedTokens <= maxPackageRequestTokens);
  assert.ok(reserved.generation.estimatedTokens > maxPackageRequestTokens - 5_000, "as many provisions as still fit are put back");
  assert.equal(reserved.generation.oversized, false);
  assert.match(reserved.evidence.find(({ role }) => role === "law-change").structuredFacts.versions.proposed.contextCz, /Not supplied, because the evidence package would not otherwise fit what the models can read with room left for the arbiter to read both reviews: the wording of \d+ of the 20 provisions/);
  // Its text alone leaves no room for the reviews: it keeps the context the models can still read.
  const textOnly = build(maxPackageRequestTokens + 10_000, 40_000);
  assert.ok(textOnly.generation.contextOmissions.length > 0);
  assert.ok(textOnly.generation.estimatedTokens > maxPackageRequestTokens + 20_000, "the context that still fits the models is kept");
  assert.ok(textOnly.generation.estimatedTokens <= maxRequestInputTokens);
  assert.equal(textOnly.generation.oversized, false);
});

test("the assessor instructions count towards the input limit of a package", () => {
  const build = (text, instructions) => buildLawChangeEvidencePackage({ assessorInstructions: instructions, promise: fiscalPromise, keptChanges: [{ change: lawChange(1, text), route }], recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  // A text that leaves room for short instructions but not for long ones.
  const text = "x".repeat((maxRequestInputTokens - 6_000) * charactersPerToken);
  assert.equal(build(text, assessorInstructions).generation.oversized, false);
  const longInstructions = "i".repeat(10_000 * charactersPerToken);
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

// Issue #103: a law change both assessors found not relevant is left out of
// later packages while what they judged is unchanged.
test("a law change both assessors found not relevant is left out, and the package is the one the assessment's own verdicts leave", async () => {
  const { relevanceVerdictsOf, withoutIrrelevantLawChanges, exclusionOf } = await import("../scripts/lib/irrelevance-verdicts.mjs");
  const { hashAssessmentContent, validateEvidencePackage } = await import("../scripts/lib/assessment-pipeline.mjs");
  const vote = attributedVoteRecord();
  const build = (exclusion = null, changes = [lawChange(1), lawChange(2)]) => buildLawChangeEvidencePackage({
    assessorInstructions, promise: fiscalPromise, keptChanges: changes.map((change) => ({ change, route })),
    recordsByPrintId: new Map([["43200", [vote]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15", exclusionOf: exclusion
  });
  const full = build();
  const [first, second] = full.evidence.filter(({ role }) => role === "law-change").map(({ id }) => id);
  const assessorPrompt = { version: "assessor-v23", contentHash: "a".repeat(64) };
  const review = (relevantSecond) => ({ changeRelevance: [{ evidenceId: first, relevant: true, reasonCz: "Souvisí.", effectCz: "Zpřísňuje." }, { evidenceId: second, relevant: relevantSecond, reasonCz: relevantSecond ? "Souvisí." : "Jiné téma.", effectCz: "" }] });
  const audit = (reviewA, reviewB, prompt = assessorPrompt) => ({ prompts: { assessor: prompt }, validatedAssessments: { "assessor-a": reviewA, "assessor-b": reviewB } });
  const verdictsOf = (auditRecord, evidencePackage = full) => {
    const byChange = new Map();
    for (const verdict of relevanceVerdictsOf({ evidencePackage, auditRecord, proposalId: "p--1" })) byChange.set(verdict.evidenceId, verdict);
    return new Map([[fiscalPromise.id, byChange]]);
  };
  const exclusionFrom = (verdicts, prompt = assessorPrompt) => (lawChangeItem) => exclusionOf({ verdicts, promise: fiscalPromise, lawChange: lawChangeItem, assessorPrompt: prompt });

  // Both assessors: the second change is not relevant.
  const both = audit(review(false), review(false));
  const entries = relevanceVerdictsOf({ evidencePackage: full, auditRecord: both, proposalId: "p--1" }).filter(({ irrelevant }) => irrelevant).map(({ entry }) => entry);
  assert.deepEqual(entries, [{ evidenceId: second, title: full.evidence.find(({ id }) => id === second).title, proposalId: "p--1", reasonsCz: ["Jiné téma.", "Jiné téma."] }]);
  const reduced = build(exclusionFrom(verdictsOf(both)));
  assert.deepEqual(reduced.evidence.filter(({ role }) => role === "law-change").map(({ id }) => id), [first]);
  assert.deepEqual(reduced.excludedLawChanges, entries);
  assert.deepEqual(reduced.evidence.find(({ role }) => role === "conduct-evidence").structuredFacts.concernsLawChanges.map(({ evidenceId }) => evidenceId), [first]);
  validateEvidencePackage(reduced);
  // The rebuilt package is exactly the assessed one without the change, so
  // it keeps the assessment instead of being assessed again.
  assert.equal(hashAssessmentContent(reduced), hashAssessmentContent(withoutIrrelevantLawChanges(full, entries)));
  assert.notEqual(hashAssessmentContent(reduced), hashAssessmentContent(full));

  // One assessor found it relevant, or one output was invalid: kept.
  for (const auditRecord of [audit(review(false), review(true)), audit(review(false), null)]) {
    assert.equal(build(exclusionFrom(verdictsOf(auditRecord))).excludedLawChanges, undefined);
  }
  // Another assessor prompt or a changed text brings the change back.
  assert.equal(build(exclusionFrom(verdictsOf(both), { version: "assessor-v23", contentHash: "b".repeat(64) })).excludedLawChanges, undefined);
  assert.equal(build(exclusionFrom(verdictsOf(both)), [lawChange(1), lawChange(2, "Zákon č. 218/2000 Sb. se mění takto: jinak.")]).excludedLawChanges, undefined);
  // A change whose context was trimmed in the assessed package gives no verdict.
  const trimmed = { ...full, generation: { ...full.generation, contextOmissions: [{ evidenceId: second, version: "proposed", suppliedCount: 0, omitted: [] }] } };
  assert.equal(relevanceVerdictsOf({ evidencePackage: trimmed, auditRecord: both, proposalId: "p--1" }).some(({ evidenceId }) => evidenceId === second), false);
  // Every law change left out: no package.
  const none = audit({ changeRelevance: review(false).changeRelevance.map((verdict) => ({ ...verdict, relevant: false })) }, { changeRelevance: review(false).changeRelevance.map((verdict) => ({ ...verdict, relevant: false })) });
  assert.equal(build(exclusionFrom(verdictsOf(none))), null);
});
