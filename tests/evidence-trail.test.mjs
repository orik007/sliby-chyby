import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hashEvidencePackage } from "../scripts/lib/assessment-pipeline.mjs";
import { buildEvidenceTrail, createAssessmentRevision } from "../scripts/lib/evidence-trail.mjs";
import { renderHumanReviewMarkdown } from "../scripts/lib/assessment-review.mjs";
import { formatDate, stepLinks, stepTitle } from "../src/lib/evidence-trail.ts";
import { assessmentRevisionSchema, evidenceTrailPrintSchema, evidenceTrailRegulationSchema, evidenceTrailResolutionSchema } from "../src/lib/schema.ts";
import { createCollectedRecord, sha256 } from "../scripts/lib/collector-core.mjs";
import { lawChangeOfRegulation, lawChangesOfResolution } from "../scripts/lib/print-parts.mjs";
import { loadTrackedPromises } from "../scripts/lib/published-promises.mjs";
import { buildLawChangeEvidencePackage } from "../scripts/lib/topic-evidence-package.mjs";

// Two real candidate proposals from the audit branch (run of 27 September 2026).
async function fixture(promiseId) {
  const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/evidence-trail/${promiseId}/${name}.json`, import.meta.url), "utf8"));
  const [proposal, evidencePackage, auditRecord, promise] = await Promise.all([
    read("proposal"),
    read("evidence-package"),
    read("assessment-run"),
    readFile(new URL(`../data/promises/${promiseId}.json`, import.meta.url), "utf8").then(JSON.parse)
  ]);
  return { proposal, evidencePackage, auditRecord, promise };
}

const baseline = (promise) => ({ id: `${promise.id}--001`, promiseId: promise.id, revision: 1, status: "no-progress" });

test("the trail groups cited relevant law changes by print, with the cited conduct and Senate resolution in order", async () => {
  const { evidencePackage, auditRecord } = await fixture("spd-2025-079ef4aef5");
  const [print, ...rest] = buildEvidenceTrail(evidencePackage, auditRecord);
  assert.equal(rest.length, 0);
  assert.equal(print.printNumber, 77);
  assert.equal(print.printUrl, "https://public.psp.cz/sqw/historie.sqw?o=10&t=77");
  assert.deepEqual(print.lawChanges, [{ lawChangeId: "psp-core-2025--law-change-43184-14", headingCz: "ČÁST čtyřicátá pátá", titleCz: "Změna zákona o podpoře sportu", amendedActs: ["115/2001"] }]);
  assert.deepEqual(print.steps.map(({ kind, version }) => [kind, version]), [["submission", "proposed"], ["vote", "approved"], ["senate-resolution", undefined], ["vote", "passed"]]);
  const [submission, approval, resolution, insistence] = print.steps;
  assert.deepEqual({ ...submission, textUrl: undefined }, { kind: "submission", date: "2025-12-29", evidenceId: "psp-core-2025--print-step-210648", proposal: "member-bill", proposerCz: "Vondráček R. a další", version: "proposed", textUrl: undefined, notes: [] });
  assert.deepEqual([approval.stageCz, approval.actionCz, approval.club, approval.counts], ["3. čtení", "souhlas", "yes", { yes: 14, no: 0, abstained: 0, notVoting: 0, absent: 1, unknown: 0 }]);
  assert.equal(approval.url, "https://public.psp.cz/sqw/hlasy.sqw?g=88026");
  assert.deepEqual(resolution, { kind: "senate-resolution", evidenceId: "psp-core-2025--senate-resolution-43184-7", printPartCz: "77/7", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=279102" });
  assert.deepEqual([insistence.date, insistence.stageCz, insistence.actionCz], ["2026-09-08", "Sněmovna (Senát)", "setrváno"]);
});

test("a conduct whose text psp.cz has not published links the earlier text with a note", async () => {
  const { evidencePackage, auditRecord } = await fixture("spd-2025-2a8fe4526f");
  const trail = buildEvidenceTrail(evidencePackage, auditRecord);
  assert.deepEqual(trail.map(({ printNumber, steps }) => [printNumber, steps.map(({ kind }) => kind)]), [[83, ["submission", "vote"]], [277, ["submission"]]]);
  const vote = trail[0].steps[1];
  assert.equal(vote.version, "proposed");
  assert.equal(vote.textUrl, trail[0].steps[0].textUrl);
  assert.deepEqual(vote.notes, [{ note: "published-version-missing", lawChangeIds: ["psp-core-2025--law-change-43193-2"] }]);
  assert.equal(trail[1].steps[0].proposal, "government-bill");
});

test("a version without a published text has no link and says why", async () => {
  const { evidencePackage, auditRecord } = await fixture("spd-2025-079ef4aef5");
  const titleOnly = structuredClone(evidencePackage);
  titleOnly.evidence.find(({ id }) => id === "psp-core-2025--law-change-43184-14").structuredFacts.versions.proposed.document = null;
  const submission = buildEvidenceTrail(titleOnly, auditRecord)[0].steps[0];
  assert.equal(submission.textUrl, null);
  assert.deepEqual(submission.notes, [{ note: "text-not-published", lawChangeIds: ["psp-core-2025--law-change-43184-14"] }]);
});

test("a text psp.cz does not publish links the act as promulgated in e-Sbírka and says so", async () => {
  const { proposal, evidencePackage, auditRecord, promise } = await fixture("spd-2025-079ef4aef5");
  const promulgated = structuredClone(evidencePackage);
  const passed = promulgated.evidence.find(({ id }) => id === "psp-core-2025--law-change-43184-14").structuredFacts.versions.passed;
  Object.assign(passed, { document: { filename: "Zákon č. 155/2026 Sb. ve vyhlášeném znění (e-Sbírka)", url: "https://e-sbirka.gov.cz/sb/2026/155/0000-00-00" }, promulgatedAct: "155/2026" });
  const insistence = buildEvidenceTrail(promulgated, auditRecord)[0].steps[3];
  assert.equal(insistence.textUrl, "https://e-sbirka.gov.cz/sb/2026/155/0000-00-00");
  assert.deepEqual(insistence.notes, [{ note: "promulgated-text", lawChangeIds: ["psp-core-2025--law-change-43184-14"] }]);
  const packageHash = hashEvidencePackage(promulgated);
  const assessed = { ...proposal, packageHash };
  const revision = createAssessmentRevision({ proposal: assessed, manifestProposal: assessed, evidencePackage: promulgated, auditRecord: { ...auditRecord, packageHash }, promise, fileId: "spd-2025-079ef4aef5", revisions: [baseline(promise)], publishedAt: "2026-09-28" });
  assert.equal(assessmentRevisionSchema.safeParse(revision).success, true);
  // Only the act as promulgated, never another e-Sbírka page.
  revision.evidenceTrail[0].steps[3].textUrl = "https://e-sbirka.gov.cz/sb/2026/155/2026-08-29";
  assert.equal(assessmentRevisionSchema.safeParse(revision).success, false);
});

test("cited conduct on a relevant law change stays in the trail when the change itself is not cited", async () => {
  const { evidencePackage, auditRecord } = await fixture("spd-2025-079ef4aef5");
  const uncited = structuredClone(auditRecord);
  const chosen = uncited.validatedAssessments["assessor-a"];
  chosen.citedEvidenceIds = chosen.citedEvidenceIds.filter((id) => id !== "psp-core-2025--law-change-43184-14");
  const [print] = buildEvidenceTrail(evidencePackage, uncited);
  assert.equal(print.lawChanges[0].lawChangeId, "psp-core-2025--law-change-43184-14");
  assert.ok(print.steps.some(({ evidenceId }) => evidenceId === "psp-core-2025--vote-88450"));
});

test("only relevant cited law changes and cited conduct enter the trail", async () => {
  const { evidencePackage, auditRecord } = await fixture("spd-2025-079ef4aef5");
  const chosen = auditRecord.validatedAssessments["assessor-a"];
  const withoutVote = structuredClone(auditRecord);
  withoutVote.validatedAssessments["assessor-a"].citedEvidenceIds = chosen.citedEvidenceIds.filter((id) => id !== "psp-core-2025--vote-88450");
  assert.ok(!buildEvidenceTrail(evidencePackage, withoutVote)[0].steps.some(({ evidenceId }) => evidenceId === "psp-core-2025--vote-88450"));
  const notRelevant = structuredClone(auditRecord);
  for (const verdict of notRelevant.validatedAssessments["assessor-a"].changeRelevance) verdict.relevant = false;
  assert.deepEqual(buildEvidenceTrail(evidencePackage, notRelevant), []);
});

test("a reviewed proposal becomes the next valid public revision with its trail", async () => {
  const { proposal, evidencePackage, auditRecord, promise } = await fixture("spd-2025-079ef4aef5");
  const revision = createAssessmentRevision({ proposal, manifestProposal: proposal, evidencePackage, auditRecord, promise, fileId: "spd-2025-079ef4aef5", revisions: [baseline(promise)], publishedAt: "2026-09-28" });
  assert.deepEqual([revision.id, revision.revision, revision.status, revision.proposalId, revision.evidenceSourceIds], ["spd-2025-079ef4aef5--002", 2, proposal.candidateStatus, proposal.proposalId, []]);
  assert.equal(revision.evidenceTrail.length, 1);
  assert.ok(revision.explanationShort.length > 0);
  assert.deepEqual(assessmentRevisionSchema.parse(revision), revision);
});

test("a no-progress proposal without a relevant law change cites the promise source", async () => {
  const { proposal, evidencePackage, auditRecord, promise } = await fixture("spd-2025-079ef4aef5");
  const noProgress = structuredClone(auditRecord);
  noProgress.resolution.status = "no-progress";
  for (const verdict of noProgress.validatedAssessments["assessor-a"].changeRelevance) verdict.relevant = false;
  const args = { manifestProposal: proposal, evidencePackage, auditRecord: noProgress, promise, fileId: "spd-2025-079ef4aef5", revisions: [baseline(promise)], publishedAt: "2026-09-28" };
  const revision = createAssessmentRevision({ ...args, proposal: { ...proposal, candidateStatus: "no-progress" } });
  assert.deepEqual([revision.status, revision.evidenceSourceIds, revision.evidenceTrail, revision.proposalId], ["no-progress", [promise.primarySourceId], undefined, proposal.proposalId]);
  assert.deepEqual(assessmentRevisionSchema.parse(revision), revision);
  noProgress.resolution.status = "moving-towards";
  assert.throws(() => createAssessmentRevision({ ...args, proposal: { ...proposal, candidateStatus: "moving-towards" } }), /needs an evidence trail/);
});

test("a proposal compared with an older public revision or another package is refused", async () => {
  const { proposal, evidencePackage, auditRecord, promise } = await fixture("spd-2025-079ef4aef5");
  const args = { proposal, manifestProposal: proposal, evidencePackage, auditRecord, promise, fileId: "spd-2025-079ef4aef5", publishedAt: "2026-09-28" };
  assert.throws(() => createAssessmentRevision({ ...args, revisions: [baseline(promise), { ...baseline(promise), revision: 2 }] }), /compared with revision 1/);
  const changed = structuredClone(evidencePackage);
  changed.asOf = "2026-09-28";
  assert.throws(() => createAssessmentRevision({ ...args, evidencePackage: changed, revisions: [baseline(promise)] }), /not the one the proposal assessed/);
  assert.throws(() => createAssessmentRevision({ ...args, proposal: { ...proposal, resolutionState: "human-review-required" }, revisions: [baseline(promise)] }), /Only a candidate/);
  assert.throws(() => createAssessmentRevision({ ...args, auditRecord: { ...auditRecord, assessmentFingerprint: "0".repeat(64) }, revisions: [baseline(promise)] }), /not the one the proposal records/);
  assert.throws(() => createAssessmentRevision({ ...args, publishedAt: "2026-02-31", revisions: [baseline(promise)] }), /calendar date/);
  assert.throws(() => createAssessmentRevision({ ...args, manifestProposal: { ...proposal, supersededByProposalId: "newer" }, revisions: [baseline(promise)] }), /superseded by newer/);
  assert.throws(() => createAssessmentRevision({ ...args, manifestProposal: undefined, revisions: [baseline(promise)] }), /not in the review manifest/);
  assert.throws(() => createAssessmentRevision({ ...args, revisions: [{ ...baseline(promise), publishedAt: "2026-09-29" }] }), /must not precede the current revision/);
  assert.throws(() => createAssessmentRevision({ ...args, publishedAt: "2026-09-01", revisions: [baseline(promise)] }), /must not precede/);
});

test("the public schema accepts only official psp.cz links and requires the reviewed proposal", async () => {
  const { proposal, evidencePackage, auditRecord, promise } = await fixture("spd-2025-079ef4aef5");
  const revision = createAssessmentRevision({ proposal, manifestProposal: proposal, evidencePackage, auditRecord, promise, fileId: "spd-2025-079ef4aef5", revisions: [baseline(promise)], publishedAt: "2026-09-28" });
  const withLink = structuredClone(revision);
  withLink.evidenceTrail[0].steps[1].url = "https://example.com/hlasovani";
  assert.equal(assessmentRevisionSchema.safeParse(withLink).success, false);
  const { proposalId, ...withoutProposal } = revision;
  assert.ok(proposalId);
  assert.equal(assessmentRevisionSchema.safeParse(withoutProposal).success, false);
  assert.equal(assessmentRevisionSchema.safeParse({ ...revision, evidenceTrail: undefined, evidenceSourceIds: [] }).success, false);
  assert.equal(assessmentRevisionSchema.safeParse({ ...revision, evidenceSourceIds: [promise.primarySourceId] }).success, false);
  const withoutText = structuredClone(revision);
  withoutText.evidenceTrail[0].steps[0].textUrl = null;
  assert.equal(assessmentRevisionSchema.safeParse(withoutText).success, false);
});

test("context left out of a package is named with e-Sbírka links on the review page and in the public revision", async () => {
  const { proposal, evidencePackage, auditRecord, promise } = await fixture("spd-2025-079ef4aef5");
  const change = evidencePackage.evidence.find(({ role }) => role === "law-change");
  evidencePackage.generation.contextOmissions = [{
    evidenceId: change.id,
    version: "proposed",
    suppliedCount: 3,
    omitted: [
      { act: "283/2021", wording: "2025-10-01", paths: ["dokument/norma/cast_3/hlava_3/par_166/odst_1"] },
      { act: "283/2021", wording: "0000-00-00", paths: ["dokument/prilohy/priloha_1"] }
    ]
  }];
  const packageHash = hashEvidencePackage(evidencePackage);
  const trimmedProposal = { ...proposal, packageHash };
  const trimmedRecord = { ...auditRecord, packageHash };
  const revision = createAssessmentRevision({ proposal: trimmedProposal, manifestProposal: trimmedProposal, evidencePackage, auditRecord: trimmedRecord, promise, fileId: "spd-2025-079ef4aef5", revisions: [baseline(promise)], publishedAt: "2026-09-28" });
  assert.deepEqual(revision.contextOmissions.map(({ act, wordingFrom, wordingUrl, suppliedCount, provisions }) => ({ act, wordingFrom, wordingUrl, suppliedCount, provisions })), [
    { act: "283/2021", wordingFrom: "2025-10-01", wordingUrl: "https://e-sbirka.gov.cz/sb/2021/283/2025-10-01", suppliedCount: 3, provisions: [{ citationCz: "§ 166 odst. 1", url: "https://e-sbirka.gov.cz/sb/2021/283/2025-10-01#par_166-odst_1" }] },
    { act: "283/2021", wordingFrom: null, wordingUrl: "https://e-sbirka.gov.cz/sb/2021/283/0000-00-00", suppliedCount: 3, provisions: [{ citationCz: "příloha č. 1", url: "https://e-sbirka.gov.cz/sb/2021/283/0000-00-00" }] }
  ]);
  assert.equal(revision.contextOmissions[0].lawChangeId, change.id);
  assert.deepEqual(assessmentRevisionSchema.parse(revision), revision);
  const elsewhere = structuredClone(revision);
  elsewhere.contextOmissions[0].provisions[0].url = "https://example.com/par_166";
  assert.equal(assessmentRevisionSchema.safeParse(elsewhere).success, false);
  const review = renderHumanReviewMarkdown({ evidencePackage, auditRecord: trimmedRecord, proposal: trimmedProposal });
  assert.match(review, /### Zkrácený kontext/);
  assert.match(review, /s místem pro oba posudky, které čte třetí hodnotitel/);
  assert.match(review, /\(navržený text\), zákon č\. 283\/2021 Sb\. ve znění od 1\. 10\. 2025: chybí znění 1 ustanovení, k dispozici 3\*\*: \[§ 166 odst\. 1\]\(https:\/\/e-sbirka\.gov\.cz\/sb\/2021\/283\/2025-10-01#par_166-odst_1\)/);
  assert.match(review, /ve vyhlášeném znění: chybí znění 1 ustanovení/);
});

test("a cited ministerial decree enters the trail as its adoption with a link to its promulgated text", async () => {
  // The real decree 145/2026 Sb. of the pipeline fixture, as the collector
  // reads it from e-Sbírka, in the package of a promise of a governing party.
  const run = JSON.parse(await readFile(new URL("./fixtures/pipeline/collector-run.json", import.meta.url), "utf8"));
  const record = run.records.find(({ id }) => id === "esbirka-regulations--2026-145");
  const change = lawChangeOfRegulation(record.payload, record.url);
  const { promises } = await loadTrackedPromises(new URL("..", import.meta.url).pathname);
  const promise = promises.find(({ partyId }) => partyId === "ano");
  const evidencePackage = buildLawChangeEvidencePackage({ assessorInstructions: "assessor instructions", promise, keptChanges: [{ change, route: { routeBasis: ["specific-tag"], matchedTagIds: ["vat-policy"], directLinkIdentifiers: [] } }], recordsByPrintId: new Map([[change.printId, [record]]]), printFirstSeenOn: new Map([[change.printId, "2026-07-29"]]), collectorRun: run, asOf: "2026-09-25" });
  const decree = evidencePackage.evidence.find(({ role }) => role === "law-change");
  const review = { status: "moving-towards", evidenceSufficient: true, citedEvidenceIds: [decree.id, record.id], changeRelevance: [{ evidenceId: decree.id, relevant: true, reasonCz: "Vyhláška se týká slibu.", effectCz: "Mění podíly obcí a krajů." }], explanationCz: "Ministerstvo vydalo vyhlášku." };
  const trail = buildEvidenceTrail(evidencePackage, { resolution: { state: "candidate", selectedReview: "consensus" }, validatedAssessments: { "assessor-a": review, "assessor-b": review } });
  assert.deepEqual(trail, [{
    kind: "regulation",
    lawChangeId: "esbirka-regulations--law-change-sb-2026-145",
    citationCz: "Vyhláška č. 145/2026 Sb.",
    titleCz: record.payload.titleCz,
    textUrl: "https://e-sbirka.gov.cz/sb/2026/145/0000-00-00",
    adoption: { date: "2026-07-29", evidenceId: "esbirka-regulations--2026-145", by: "ministry", issuerCz: "Ministerstvo financí" }
  }]);
  assert.deepEqual(evidenceTrailRegulationSchema.parse(trail[0]), trail[0]);
});

test("a cited government resolution enters the trail as its adoption with a link to its page in zVlády", async () => {
  // The real resolution 158/2026 of the pipeline fixture, as the collector
  // reads it from zVlády, in the package of a promise of a governing party.
  const run = JSON.parse(await readFile(new URL("./fixtures/pipeline/collector-run.json", import.meta.url), "utf8"));
  const record = run.records.find(({ id }) => id === "zvlady-resolutions--2026-158");
  const [change] = lawChangesOfResolution(record.payload, record.url);
  const { promises } = await loadTrackedPromises(new URL("..", import.meta.url).pathname);
  const promise = promises.find(({ partyId }) => partyId === "spd");
  const evidencePackage = buildLawChangeEvidencePackage({ assessorInstructions: "assessor instructions", promise, keptChanges: [{ change, route: { routeBasis: ["specific-tag"], matchedTagIds: ["vat-policy"], directLinkIdentifiers: [] } }], recordsByPrintId: new Map([[change.printId, [record]]]), printFirstSeenOn: new Map([[change.printId, "2026-03-09"]]), collectorRun: run, asOf: "2026-09-25" });
  const resolution = evidencePackage.evidence.find(({ role }) => role === "law-change");
  const review = { status: "moving-towards", evidenceSufficient: true, citedEvidenceIds: [resolution.id, record.id], changeRelevance: [{ evidenceId: resolution.id, relevant: true, reasonCz: "Usnesení se týká slibu.", effectCz: "Vláda souhlasí s účastí na výstavě." }], explanationCz: "Vláda přijala usnesení." };
  const trail = buildEvidenceTrail(evidencePackage, { resolution: { state: "candidate", selectedReview: "consensus" }, validatedAssessments: { "assessor-a": review, "assessor-b": review } });
  assert.deepEqual(trail, [{
    kind: "resolution",
    lawChangeId: "zvlady-resolutions--law-change-uv-2026-158",
    numberCz: "Usnesení vlády č. 158/2026",
    titleCz: "O zajištění účasti České republiky na Mezinárodní specializované výstavě EXPO 2027 v Bělehradě",
    pageUrl: "https://odok.gov.cz/portal/zvlady/usneseni/2026/158/",
    adoption: { date: "2026-03-09", evidenceId: "zvlady-resolutions--2026-158" }
  }]);
  assert.deepEqual(evidenceTrailResolutionSchema.parse(trail[0]), trail[0]);
  assert.equal(evidenceTrailResolutionSchema.safeParse({ ...trail[0], pageUrl: "https://example.com/usneseni/2026/158/" }).success, false);
});

test("two cited parts of one government resolution enter the trail as one adoption", async () => {
  const run = JSON.parse(await readFile(new URL("./fixtures/pipeline/collector-run.json", import.meta.url), "utf8"));
  const record = run.records.find(({ id }) => id === "zvlady-resolutions--2026-158");
  const [whole] = lawChangesOfResolution(record.payload, record.url);
  const parts = [1, 2].map((number) => ({ ...whole, changeId: `uv-2026-158-${number}`, heading: `Příloha č. ${number}`, versions: { adopted: { ...whole.versions.adopted, heading: `Příloha č. ${number}` } } }));
  const { promises } = await loadTrackedPromises(new URL("..", import.meta.url).pathname);
  const promise = promises.find(({ partyId }) => partyId === "spd");
  const route = { routeBasis: ["specific-tag"], matchedTagIds: ["vat-policy"], directLinkIdentifiers: [] };
  const evidencePackage = buildLawChangeEvidencePackage({ assessorInstructions: "assessor instructions", promise, keptChanges: parts.map((change) => ({ change, route })), recordsByPrintId: new Map([[whole.printId, [record]]]), printFirstSeenOn: new Map([[whole.printId, "2026-03-09"]]), collectorRun: run, asOf: "2026-09-25" });
  const changes = evidencePackage.evidence.filter(({ role }) => role === "law-change");
  assert.deepEqual(changes.map(({ title }) => title), ["Usnesení vlády č. 158/2026, O zajištění účasti České republiky na Mezinárodní specializované výstavě EXPO 2027 v Bělehradě – Příloha č. 1", "Usnesení vlády č. 158/2026, O zajištění účasti České republiky na Mezinárodní specializované výstavě EXPO 2027 v Bělehradě – Příloha č. 2"]);
  const review = { status: "moving-towards", evidenceSufficient: true, citedEvidenceIds: [...changes.map(({ id }) => id), record.id], changeRelevance: changes.map(({ id }) => ({ evidenceId: id, relevant: true, reasonCz: "Usnesení se týká slibu.", effectCz: "Vláda souhlasí s účastí na výstavě." })), explanationCz: "Vláda přijala usnesení." };
  const trail = buildEvidenceTrail(evidencePackage, { resolution: { state: "candidate", selectedReview: "consensus" }, validatedAssessments: { "assessor-a": review, "assessor-b": review } });
  assert.deepEqual(trail.map(({ kind, lawChangeId }) => [kind, lawChangeId]), [["resolution", "zvlady-resolutions--law-change-uv-2026-158-1"]]);
});

test("a cited government opinion enters the trail as a step on its bill, with a link to the opinion and the proposed text", async () => {
  const { promises } = await loadTrackedPromises(new URL("..", import.meta.url).pathname);
  const promise = promises.find(({ partyId }) => partyId === "ano");
  const record = createCollectedRecord({
    id: "psp-core-2025--government-opinion-43110-1",
    sourceId: "psp-core-2025",
    kind: "government-opinion",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2025-12-16T00:00:00",
    title: "7/1: Stanovisko vlády (souhlas) — Návrh zákona",
    publisher: "Chamber of Deputies",
    url: "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=7&CT1=1",
    payload: { externalPrintId: "43110", printKindId: "2", printNumber: 7, partNumber: 1, printTitleCz: "Návrh zákona", printUrl: "https://public.psp.cz/sqw/historie.sqw?o=10&t=7", resultCz: "souhlas", opinion: "agrees", distributedOn: "2025-12-16", proposal: { kind: "government-opinion", proposerPartyIds: ["ano", "motoriste", "spd"] } }
  });
  const change = {
    changeId: "43110-1",
    printId: "43110",
    printNumber: 7,
    printKindId: "2",
    printTitleCz: "Návrh zákona",
    printPageUrl: "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=7&CT1=0",
    addedIn: "proposed",
    heading: null,
    titleCz: "Návrh zákona",
    acts: [],
    titleActs: [],
    identifiers: [],
    versions: { proposed: { heading: null, titleCz: "Návrh zákona", textCz: "Zákon …", document: { filename: "t000700.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=1" } } },
    senateResolutions: [],
    governmentOpinions: [{ partNumber: 1, document: { filename: "t000701.doc", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=265860" }, textCz: "Vláda souhlasí." }]
  };
  const evidencePackage = buildLawChangeEvidencePackage({ assessorInstructions: "assessor instructions", promise, keptChanges: [{ change, route: { routeBasis: ["specific-tag"], matchedTagIds: ["vat-policy"], directLinkIdentifiers: [] } }], recordsByPrintId: new Map([["43110", [record]]]), printFirstSeenOn: new Map([["43110", "2025-12-16"]]), collectorRun: { schemaVersion: "1.0.0", runId: "fixture", records: [record] }, asOf: "2026-09-25" });
  const bill = evidencePackage.evidence.find(({ role }) => role === "law-change");
  const review = { status: "moving-towards", evidenceSufficient: true, citedEvidenceIds: [bill.id, record.id], changeRelevance: [{ evidenceId: bill.id, relevant: true, reasonCz: "Návrh se týká slibu.", effectCz: "Zavádí pravidlo." }], explanationCz: "Vláda s návrhem souhlasila." };
  const [print] = buildEvidenceTrail(evidencePackage, { resolution: { state: "candidate", selectedReview: "consensus" }, validatedAssessments: { "assessor-a": review, "assessor-b": review } });
  assert.equal(print.printUrl, "https://public.psp.cz/sqw/historie.sqw?o=10&t=7");
  assert.deepEqual(print.steps, [{ kind: "government-opinion", date: "2025-12-16", evidenceId: record.id, opinion: "agrees", printPartCz: "7/1", url: record.url, version: "proposed", textUrl: "https://www.psp.cz/sqw/text/orig2.sqw?idd=1", notes: [] }]);
  assert.deepEqual(evidenceTrailPrintSchema.parse(print), print);
  assert.equal(stepTitle(print.steps[0]), "Vláda s návrhem souhlasila");
  assert.deepEqual(stepLinks(print.steps[0], print.printUrl).map(({ label }) => label), ["Stanovisko vlády (tisk 7/1)", "Navržený text"]);
});

test("trail dates keep their calendar day in any time zone", () => {
  assert.equal(formatDate("2026-07-01"), "1. 7. 2026");
});

test("a cited amendment and a vote on it enter the trail on their bill, with the document, the vote, and the stenographic record", async () => {
  const { promises } = await loadTrackedPromises(new URL("..", import.meta.url).pathname);
  const promise = promises.find(({ partyId }) => partyId === "ano");
  const amendment = createCollectedRecord({
    id: "psp-core-2025--amendment-1306",
    sourceId: "psp-core-2025",
    kind: "member-amendment",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-06-11T00:00:00",
    title: "SD 1306: Pozměňovací návrh D1 k tisku 67 — Návrh zákona",
    publisher: "Chamber of Deputies",
    url: "https://www.psp.cz/sqw/sd.sqw?cd=1306&o=10",
    payload: { documentNumber: "1306", externalPrintId: "43174", printKindId: "2", printNumber: 67, printTitleCz: "Návrh zákona", printUrl: "https://public.psp.cz/sqw/historie.sqw?o=10&t=67", label: "D1", presenterCz: "Poslanec Boris Šťastný", presentedOn: "2026-06-11", parts: [], document: { filename: "31306.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=900" }, pageUrl: "https://www.psp.cz/sqw/sd.sqw?cd=1306&o=10", paragraphs: ["Pozměňovací návrh poslance Borise Šťastného", "1. V čl. I se bod 3 zrušuje."], proposal: { kind: "member-amendment", proposerPartyIds: ["ano"], proposerPersonIds: ["1"], unmatchedProposerNames: [] } }
  });
  const vote = createCollectedRecord({
    id: "psp-core-2025--vote-88146",
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-07-10T11:55:00",
    title: "Novela z. - stavební zákon",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/hlasy.sqw?g=88146",
    payload: { externalVoteId: "88146", counts: { yes: 120, no: 30 }, linkedPrints: [{ externalPrintId: "43174", printKindId: "2", linkBasis: "agenda-item", historyContexts: [] }], amendmentVote: { externalPrintId: "43174", printNumber: 67, documentNumbers: ["1306"], label: "D1", variant: null, presenterCz: "Poslanec Boris Šťastný", parts: [], stenoUrl: "https://www.psp.cz/eknih/2025ps/stenprot/027schuz/s027018.htm" }, partyVoteSummaries: [{ partyId: "ano", attributionStatus: "attributed", majorityChoice: "no", counts: { yes: 2, no: 10, abstained: 60, notVoting: 0, absent: 8, unknown: 0 }, strictMajorityThreshold: 41, eligibleMemberCount: 80 }] }
  });
  const change = {
    changeId: "43174-1", printId: "43174", printNumber: 67, printKindId: "2", printTitleCz: "Návrh zákona", printPageUrl: "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=67&CT1=0", addedIn: "proposed", heading: null, titleCz: "Návrh zákona", acts: [], titleActs: [], identifiers: [],
    versions: { proposed: { heading: null, titleCz: "Návrh zákona", textCz: "Zákon …", document: { filename: "t006700.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=2" } } },
    senateResolutions: [],
    printPartHeadings: [],
    amendments: [{ documentNumber: "1306", label: "D1", presenterCz: "Poslanec Boris Šťastný", presentedOn: "2026-06-11", proposerPartyIds: ["ano"], parts: [], document: { filename: "31306.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=900" }, pageUrl: "https://www.psp.cz/sqw/sd.sqw?cd=1306&o=10", textCz: "1. V čl. I se bod 3 zrušuje.", textSha256: sha256("1. V čl. I se bod 3 zrušuje.") }]
  };
  const records = [amendment, vote];
  const evidencePackage = buildLawChangeEvidencePackage({ assessorInstructions: "assessor instructions", promise, keptChanges: [{ change, route: { routeBasis: ["specific-tag"], matchedTagIds: ["vat-policy"], directLinkIdentifiers: [] } }], recordsByPrintId: new Map([["43174", records]]), printFirstSeenOn: new Map([["43174", "2025-12-12"]]), collectorRun: { schemaVersion: "1.0.0", runId: "fixture", records }, asOf: "2026-09-25" });
  const bill = evidencePackage.evidence.find(({ role }) => role === "law-change");
  const review = { status: "moving-against", evidenceSufficient: true, citedEvidenceIds: [bill.id, amendment.id, vote.id], changeRelevance: [{ evidenceId: bill.id, relevant: true, reasonCz: "Návrh se týká slibu.", effectCz: "Ruší pravidlo." }], explanationCz: "Poslanci strany návrh podali." };
  const [print] = buildEvidenceTrail(evidencePackage, { resolution: { state: "candidate", selectedReview: "consensus" }, validatedAssessments: { "assessor-a": review, "assessor-b": review } });
  assert.equal(print.printUrl, "https://public.psp.cz/sqw/historie.sqw?o=10&t=67");
  const note = [{ note: "amended-proposal", lawChangeIds: [bill.id] }];
  assert.deepEqual(print.steps, [
    { kind: "amendment", date: "2026-06-11", evidenceId: amendment.id, labelCz: "D1", documentNumber: 1306, presenterCz: "Poslanec Boris Šťastný", url: amendment.url, version: "proposed", textUrl: "https://www.psp.cz/sqw/text/orig2.sqw?idd=2", notes: note },
    { kind: "amendment-vote", date: "2026-07-10", evidenceId: vote.id, url: vote.url, labelCz: "D1", documentNumbers: [1306], presenterCz: "Poslanec Boris Šťastný", stenoUrl: "https://www.psp.cz/eknih/2025ps/stenprot/027schuz/s027018.htm", club: "no", counts: { yes: 2, no: 10, abstained: 60, notVoting: 0, absent: 8, unknown: 0 }, version: "proposed", textUrl: "https://www.psp.cz/sqw/text/orig2.sqw?idd=2", notes: note }
  ]);
  assert.deepEqual(evidenceTrailPrintSchema.parse(print), print);
  assert.deepEqual(print.steps.map(stepTitle), ["Podání pozměňovacího návrhu D1", "Klub strany pozměňovací návrh nepodpořil"]);
  assert.deepEqual(stepLinks(print.steps[1], print.printUrl).map(({ label }) => label), ["Výsledek hlasování", "Stenozáznam s označením návrhu", "Navržený text"]);
});
