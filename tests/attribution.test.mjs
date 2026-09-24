import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import {
  assessableAttributionStatuses,
  attributionStatusForRecord,
  factSummary,
  isPotentiallyAttributable,
  selectBoundedPrimaryMatches,
  validatePromiseRegistry
} from "../scripts/lib/attribution.mjs";
import { loadPublishedPromiseIds } from "../scripts/lib/published-promises.mjs";

const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/promise-registry/promises.json", import.meta.url), "utf8")));
const promise = { id: "test-promise", partyId: "motoriste" };

test("the promise registry contains exactly the confirmed public promises", async () => {
  assert.equal(registry.status, "confirmed-promise-registry-v2");
  const publishedPromiseIds = await loadPublishedPromiseIds(fileURLToPath(new URL("../data/promises/", import.meta.url)));
  assert.deepEqual(new Set(registry.promises.map(({ id }) => id)), publishedPromiseIds);
  assert.ok(registry.promises.every((entry) => entry.promiseSource.primary && entry.matching === undefined));
});

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

test("only Chamber votes and legislative steps can be collected, and only four statuses are assessable", () => {
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
  assert.deepEqual([...assessableAttributionStatuses].sort(), ["verified-government-proposal", "verified-member-bill", "verified-party-no-majority", "verified-party-vote"]);
});

test("bounded selection keeps only assessable primary evidence, direct links first", () => {
  const direct = { record: voteRecord({ id: "psp--vote-direct" }), attributionStatus: "verified-party-vote", directLink: true };
  const tagged = { record: voteRecord({ id: "psp--vote-tagged" }), attributionStatus: "verified-party-vote", directLink: false };
  const procedural = { record: voteRecord({ id: "psp--vote-procedural" }), attributionStatus: "candidate-party-vote-without-decisive-context", directLink: true };
  assert.deepEqual(selectBoundedPrimaryMatches([tagged, procedural, direct]).map(({ record }) => record.id), ["psp--vote-direct", "psp--vote-tagged"]);
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
