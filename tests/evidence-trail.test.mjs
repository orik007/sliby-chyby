import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildEvidenceTrail, createAssessmentRevision } from "../scripts/lib/evidence-trail.mjs";
import { formatDate } from "../src/lib/evidence-trail.ts";
import { assessmentRevisionSchema } from "../src/lib/schema.ts";

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
  assert.deepEqual([approval.stageCz, approval.actionCz, approval.club, approval.counts], ["3. čtení", "souhlas", "yes", { yes: 14, no: 0, abstained: 0, notVoting: 0, absent: 1 }]);
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
  const revision = createAssessmentRevision({ proposal, evidencePackage, auditRecord, promise, fileId: "spd-2025-079ef4aef5", revisions: [baseline(promise)], publishedAt: "2026-09-28" });
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
  const args = { evidencePackage, auditRecord: noProgress, promise, fileId: "spd-2025-079ef4aef5", revisions: [baseline(promise)], publishedAt: "2026-09-28" };
  const revision = createAssessmentRevision({ ...args, proposal: { ...proposal, candidateStatus: "no-progress" } });
  assert.deepEqual([revision.status, revision.evidenceSourceIds, revision.evidenceTrail, revision.proposalId], ["no-progress", [promise.primarySourceId], undefined, proposal.proposalId]);
  assert.deepEqual(assessmentRevisionSchema.parse(revision), revision);
  noProgress.resolution.status = "moving-towards";
  assert.throws(() => createAssessmentRevision({ ...args, proposal: { ...proposal, candidateStatus: "moving-towards" } }), /needs an evidence trail/);
});

test("a proposal compared with an older public revision or another package is refused", async () => {
  const { proposal, evidencePackage, auditRecord, promise } = await fixture("spd-2025-079ef4aef5");
  const args = { proposal, evidencePackage, auditRecord, promise, fileId: "spd-2025-079ef4aef5", publishedAt: "2026-09-28" };
  assert.throws(() => createAssessmentRevision({ ...args, revisions: [baseline(promise), { ...baseline(promise), revision: 2 }] }), /compared with revision 1/);
  const changed = structuredClone(evidencePackage);
  changed.asOf = "2026-09-28";
  assert.throws(() => createAssessmentRevision({ ...args, evidencePackage: changed, revisions: [baseline(promise)] }), /not the one the proposal assessed/);
  assert.throws(() => createAssessmentRevision({ ...args, proposal: { ...proposal, resolutionState: "human-review-required" }, revisions: [baseline(promise)] }), /Only a candidate/);
  assert.throws(() => createAssessmentRevision({ ...args, auditRecord: { ...auditRecord, assessmentFingerprint: "0".repeat(64) }, revisions: [baseline(promise)] }), /not the one the proposal records/);
  assert.throws(() => createAssessmentRevision({ ...args, publishedAt: "2026-02-31", revisions: [baseline(promise)] }), /calendar date/);
});

test("the public schema accepts only official psp.cz links and requires the reviewed proposal", async () => {
  const { proposal, evidencePackage, auditRecord, promise } = await fixture("spd-2025-079ef4aef5");
  const revision = createAssessmentRevision({ proposal, evidencePackage, auditRecord, promise, fileId: "spd-2025-079ef4aef5", revisions: [baseline(promise)], publishedAt: "2026-09-28" });
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

test("trail dates keep their calendar day in any time zone", () => {
  assert.equal(formatDate("2026-07-01"), "1. 7. 2026");
});
