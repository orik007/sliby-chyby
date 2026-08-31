import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import {
  buildEvidencePackage,
  matchCollectorRecords,
  matchRecordToPromise,
  validatePromiseRegistry
} from "../scripts/lib/evidence-matcher.mjs";

const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/matching/promises.json", import.meta.url), "utf8")));
const eet = registry.promises.find(({ id }) => id === "ano-2025-eet-2");

function record(overrides = {}) {
  return createCollectedRecord({
    id: overrides.id ?? "psp--step-1",
    sourceId: "psp-core-2025",
    kind: overrides.kind ?? "legislative-step",
    primary: overrides.primary ?? true,
    evidenceRole: overrides.primary === false ? "discovery-context" : "primary-record",
    occurredAt: overrides.occurredAt ?? "2026-07-15T00:00:00",
    timeZone: "Europe/Prague",
    title: overrides.title ?? "189/0: souhlas — Vládní návrh zákona o evidenci tržeb",
    publisher: overrides.publisher ?? "Chamber of Deputies",
    url: overrides.url ?? "https://public.psp.cz/sqw/historie.sqw?o=10&t=189",
    payload: overrides.payload ?? {
      externalHistoryId: "1",
      externalPrintId: "43310",
      printNumber: 189,
      printTitleCz: "Vládní návrh zákona o evidenci tržeb",
      actionCz: "souhlas",
      currentStateCz: "vrácen Senátem"
    }
  });
}

test("matches by explicit official identifier and reports the visible basis", () => {
  const match = matchRecordToPromise(record({ title: "Uninformative title" }), eet);
  assert.equal(match.score >= 100, true);
  assert.deepEqual(match.matchedExternalReferences.map(({ path }) => path), ["payload.printNumber"]);
});

test("does not turn an unrelated record into candidate evidence", () => {
  const unrelated = record({
    id: "psp--unrelated",
    title: "Novela zákona o civilním letectví",
    payload: { printNumber: 278, actionCz: "předložen", printTitleCz: "Civilní letectví" }
  });
  assert.equal(matchRecordToPromise(unrelated, eet), null);
});

test("builds a bounded unpublished primary-only package", () => {
  const primary = record();
  const article = record({
    id: "media--1",
    kind: "article",
    primary: false,
    title: "EET 2.0 a evidence tržeb",
    publisher: "Example publisher",
    url: "https://example.com/eet",
    payload: { excerptCz: "Článek popisuje návrh." }
  });
  const collectorRun = {
    schemaVersion: "1.0.0",
    runId: "collector-test",
    records: [primary, article]
  };
  const matches = matchCollectorRecords(collectorRun.records, eet, { asOf: "2026-08-31" });
  const evidencePackage = buildEvidencePackage({ promise: eet, matches, collectorRun, asOf: "2026-08-31" });
  assert.equal(evidencePackage.evidence.length, 2);
  assert.equal(evidencePackage.evidence[0].role, "promise-source");
  assert.equal(evidencePackage.evidence[1].id, primary.id);
  assert.equal(evidencePackage.generation.candidateMatchCount, 2);
  assert.equal(evidencePackage.generation.selectedPrimaryEvidenceCount, 1);
  assert.equal(evidencePackage.generation.directionAssigned, false);
  assert.equal("status" in evidencePackage, false);
});

test("creates no assessable package when only media or no records match", () => {
  const article = record({
    id: "media--only",
    kind: "article",
    primary: false,
    title: "EET 2.0 a evidence tržeb",
    publisher: "Example publisher",
    url: "https://example.com/eet",
    payload: { excerptCz: "Článek popisuje návrh." }
  });
  const collectorRun = { schemaVersion: "1.0.0", runId: "collector-test", records: [article] };
  const matches = matchCollectorRecords(collectorRun.records, eet, { asOf: "2026-08-31" });
  assert.equal(buildEvidencePackage({ promise: eet, matches, collectorRun, asOf: "2026-08-31" }), null);
});

test("requires decisive vote context before a party direction enters the package", () => {
  const votePayload = {
    externalVoteId: "900",
    counts: { yes: 100, no: 20 },
    partyVoteSummaries: [{
      partyId: "ano",
      eligibleMemberCount: 80,
      directionalVoteCount: 70,
      counts: { yes: 70, no: 0, abstained: 0, notVoting: 0, absent: 10, unknown: 0 },
      majorityChoice: "yes",
      attributionStatus: "attributed",
      ruleVersion: "party-vote-directional-majority-v2"
    }],
    linkedPrints: [{ number: 189, titleCz: "Vládní návrh zákona o evidenci tržeb", historyContexts: [] }]
  };
  const ambiguousVote = record({ id: "psp--vote-ambiguous", kind: "parliamentary-vote", title: "Vl.n.z. o evidenci tržeb", payload: votePayload });
  const ambiguousMatch = matchRecordToPromise(ambiguousVote, eet);
  assert.equal(ambiguousMatch.attributionStatus, "candidate-party-vote-without-decisive-context");

  const decisiveVote = record({
    id: "psp--vote-decisive",
    kind: "parliamentary-vote",
    title: "Vl.n.z. o evidenci tržeb",
    payload: {
      ...votePayload,
      linkedPrints: [{
        number: 189,
        titleCz: "Vládní návrh zákona o evidenci tržeb",
        historyContexts: [{ actionCz: "souhlas", resolutionNumber: 263 }]
      }]
    }
  });
  const decisiveMatch = matchRecordToPromise(decisiveVote, eet);
  assert.equal(decisiveMatch.attributionStatus, "verified-party-vote");
});

test("attributes a decisive party vote even when another party introduced the bill", () => {
  const vote = record({
    id: "psp--vote-other-party-bill",
    kind: "parliamentary-vote",
    title: "Návrh jiné strany o evidenci tržeb",
    payload: {
      externalVoteId: "901",
      proposerPartyId: "different-party",
      partyVoteSummaries: [{
        partyId: "ano",
        eligibleMemberCount: 80,
        directionalVoteCount: 60,
        counts: { yes: 60, no: 0, abstained: 0, notVoting: 0, absent: 20, unknown: 0 },
        majorityChoice: "yes",
        attributionStatus: "attributed",
        ruleVersion: "party-vote-directional-majority-v2"
      }],
      linkedPrints: [{
        number: 999,
        titleCz: "Návrh jiné strany o evidenci tržeb",
        historyContexts: [{ actionCz: "souhlas", resolutionNumber: 264 }]
      }]
    }
  });

  const match = matchRecordToPromise(vote, eet);
  assert.equal(match.attributionStatus, "verified-party-vote");
});
