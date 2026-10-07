import assert from "node:assert/strict";
import test from "node:test";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import {
  assessableAttributionStatuses,
  attributionStatusForRecord,
  factSummary,
  isPotentiallyAttributable,
  versionConcerned
} from "../scripts/lib/attribution.mjs";

const promise = { id: "test-promise", partyId: "motoriste" };

function voteRecord({ id = "psp--vote-1", actions = ["souhlas"], summary = { attributionStatus: "attributed", majorityChoice: "yes" } } = {}) {
  return createCollectedRecord({
    id,
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-08-26T13:40:00",
    title: "Vl.n.z., kt. se mění některé z. v oblasti veřejných rozpočtů",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/hlasy.sqw?g=88416",
    payload: {
      externalVoteId: id,
      counts: { yes: 104, no: 72 },
      partyVoteSummaries: [{ partyId: "motoriste", counts: { yes: 12, no: 0 }, eligibleMemberCount: 13, strictMajorityThreshold: 7, ...summary }],
      linkedPrints: [{ number: 90, linkBasis: "history-vote-id", historyContexts: actions.map((actionCz) => ({ actionCz })) }]
    }
  });
}

function submissionStep(proposal, actionCz = "předložen", printKindId = proposal.kind === "member-bill" ? "2" : "1") {
  return createCollectedRecord({
    id: `psp--step-${proposal.kind}-${actionCz}`,
    sourceId: "psp-core-2025",
    kind: "legislative-step",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-01-27T00:00:00",
    title: "90/0: předložen — Vládní návrh zákona, kterým se mění některé zákony v oblasti veřejných rozpočtů",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/historie.sqw?o=10&t=90",
    payload: { externalPrintId: "43200", printNumber: 90, printKindId, actionCz, proposal }
  });
}

test("a decisive Chamber vote is attributed to the party by its club's strict majority", () => {
  assert.equal(attributionStatusForRecord(voteRecord(), promise).attributionStatus, "verified-party-vote");
  assert.equal(attributionStatusForRecord(voteRecord({ actions: ["setrváno"] }), promise).attributionStatus, "verified-party-vote");
  assert.equal(attributionStatusForRecord(voteRecord({ actions: ["pozm. přijat"] }), promise).attributionStatus, "verified-party-vote");
  assert.equal(attributionStatusForRecord(voteRecord({ summary: { attributionStatus: "no-strict-majority", majorityChoice: null } }), promise).attributionStatus, "verified-party-no-majority");
  assert.equal(attributionStatusForRecord(voteRecord(), { id: "other", partyId: "ods" }).attributionStatus, "unattributed");
});

test("a procedural or unlinked vote is never decisive", () => {
  assert.equal(attributionStatusForRecord(voteRecord({ actions: ["vrácen"] }), promise).attributionStatus, "candidate-party-vote-without-decisive-context");
  assert.equal(attributionStatusForRecord(voteRecord({ actions: ["přikázán"] }), promise).attributionStatus, "candidate-party-vote-without-decisive-context");
  assert.equal(attributionStatusForRecord(voteRecord({ actions: [] }), promise).attributionStatus, "candidate-party-vote-without-decisive-context");
});

test("a submitted member bill is attributed to every party with a proposing MP", () => {
  const step = submissionStep({ kind: "member-bill", submittedOn: "2026-01-27", proposerPartyIds: ["ano", "motoriste", "spd"] });
  assert.equal(attributionStatusForRecord(step, promise).attributionStatus, "verified-member-bill");
  assert.equal(attributionStatusForRecord(step, { id: "other", partyId: "ods" }).attributionStatus, "unattributed");
});

test("a submitted government proposal is attributed to the government parties at its submission date", () => {
  const step = submissionStep({ kind: "government-proposal", submittedOn: "2026-01-27", proposerPartyIds: ["ano", "motoriste", "spd"] });
  assert.equal(attributionStatusForRecord(step, promise).attributionStatus, "verified-government-proposal");
  const earlierGovernment = submissionStep({ kind: "government-proposal", submittedOn: "2025-11-12", proposerPartyIds: [] });
  assert.equal(attributionStatusForRecord(earlierGovernment, promise).attributionStatus, "unattributed");
});

test("only the submission step of a bill is a proposal", () => {
  const step = submissionStep({ kind: "member-bill", submittedOn: "2026-01-27", proposerPartyIds: ["motoriste"] }, "přikázán");
  assert.equal(attributionStatusForRecord(step, promise).attributionStatus, "unattributed");
});

test("only Chamber votes, legislative steps, and adoptions of regulations can be collected, and only six statuses are assessable", () => {
  assert.throws(() => createCollectedRecord({
    id: "party--post",
    sourceId: "party-news",
    kind: "official-publication",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-09-19T10:00:00.000Z",
    title: "Motoristé prosadili nižší schodek",
    publisher: "Motoristé sobě",
    url: "https://party.example/post",
    payload: {}
  }), /Unknown record kind/);
  assert.deepEqual([...assessableAttributionStatuses].sort(), ["verified-government-proposal", "verified-government-regulation", "verified-member-bill", "verified-ministerial-decree", "verified-party-no-majority", "verified-party-vote"]);
});

test("only records that can be attributable conduct of a tracked party are routed", () => {
  const tracked = ["ano", "motoriste", "spd"];
  assert.equal(isPotentiallyAttributable(voteRecord(), tracked), true);
  assert.equal(isPotentiallyAttributable(voteRecord({ actions: ["přikázán"] }), tracked), false);
  assert.equal(isPotentiallyAttributable(submissionStep({ kind: "member-bill", submittedOn: "2026-01-27", proposerPartyIds: ["motoriste"] }), tracked), true);
  assert.equal(isPotentiallyAttributable(submissionStep({ kind: "member-bill", submittedOn: "2026-01-27", proposerPartyIds: [] }), tracked), false);
  assert.equal(isPotentiallyAttributable(submissionStep({ kind: "member-bill", submittedOn: "2026-01-27", proposerPartyIds: ["motoriste"] }, "přikázán"), tracked), false);
});

test("a proposal's fact summary names its official print kind", () => {
  const proposal = { kind: "government-proposal", submittedOn: "2026-01-27", proposerPartyIds: ["ano", "motoriste", "spd"] };
  assert.match(factSummary(submissionStep(proposal), "motoriste"), /It is a government bill submitted on 2026-01-27/);
  assert.match(factSummary(submissionStep(proposal, "předložen", "3"), "motoriste"), /It is a government state budget bill/);
  assert.match(factSummary(submissionStep(proposal, "předložen", "4"), "motoriste"), /It is an international treaty submitted by the government/);
  assert.match(factSummary(submissionStep({ ...proposal, kind: "member-bill" }), "motoriste"), /It is a member bill/);
});

test("a vote concerns the text its print-history step decided on", () => {
  const vote = (actionCz, stageCz, printKindId = "1") => ({ kind: "parliamentary-vote", payload: { linkedPrints: [{ externalPrintId: "43200", printKindId, historyContexts: [{ actionCz: "přikázán", stageCz: "1. čtení" }, { actionCz, stageCz }] }] } });
  const concerned = (record) => versionConcerned(record, "43200");
  const plain = (version, extra = {}) => ({ version, withSenateResolution: false, sameAsApproved: false, senateAmendmentsRejected: false, mark: null, ...extra });
  // Stages and actions as psp.cz names them (typ_stavu.unl, typ_akce.unl).
  assert.deepEqual(concerned({ kind: "legislative-step", payload: {} }), plain("proposed"));
  assert.deepEqual(concerned(vote("souhlas", "3. čtení")), plain("approved"));
  assert.deepEqual(concerned(vote("souhlas", "1. čtení (§ 90, odst. 2) - podr. rozprava")), plain("approved"));
  assert.deepEqual(concerned(vote("souhlas", "2. čtení", "4")), plain("proposed"), "a treaty has no approved text");
  // After a Senate return, insisting re-adopts the approved text.
  assert.deepEqual(concerned(vote("setrváno", "Sněmovna (Senát)")), plain("passed", { withSenateResolution: true, sameAsApproved: true }));
  // A vote on the Senate's amendments concerns the approved text changed by
  // them, which is the passed text.
  assert.deepEqual(concerned(vote("pozm. přijat", "Sněmovna (Senát)")), plain("passed", { withSenateResolution: true }));
  assert.deepEqual(concerned(vote("nepřijat", "Sněmovna (Senát)")), plain("passed", { withSenateResolution: true, senateAmendmentsRejected: true }));
  // After a presidential return, the text sent to the President may include
  // accepted Senate amendments, so the approved text is not assumed to be it.
  assert.deepEqual(concerned(vote("setrváno", "Sněmovna (Prezident)")), plain("passed"));
  assert.deepEqual(concerned(vote("nepřijat", "Sněmovna (Prezident)")), plain("passed"));
  assert.deepEqual(concerned(vote("zamítnut", "3. čtení")), plain("proposed", { mark: "third-reading-rejection" }));
  assert.deepEqual(concerned(vote("zamítnut", "1. čtení")), plain("proposed"));
  assert.deepEqual(concerned(vote("schváleno", "1. čtení", "5")), plain("proposed"));
  // "nepřijat" outside a return is not a vote on the Senate's resolution.
  assert.deepEqual(concerned(vote("nepřijat", "3. čtení")), plain("proposed"));
  // A vote linked to a print only through its agenda item is not conduct on
  // that print.
  assert.equal(versionConcerned({ kind: "parliamentary-vote", payload: { linkedPrints: [{ externalPrintId: "43200", printKindId: "1", historyContexts: [] }] } }, "43200"), null);
});
