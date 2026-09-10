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
const freeMuseums = registry.promises.find(({ id }) => id === "ano-2025-free-state-museums-selected-groups");
test("matching configuration contains exactly the confirmed public promises", async () => {
  assert.equal(registry.status, "confirmed-promise-matching-v1");
  assert.equal(registry.promises.length, 22);
  assert.ok(registry.promises.every((promise) => promise.promiseSource.primary));
});

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

test("finds a Culture Ministry free-entry item even when timing words split the promise phrase", () => {
  const item = createCollectedRecord({
    id: "mk-news-archive--free-entry",
    sourceId: "mk-news-archive",
    kind: "official-publication",
    primary: true,
    evidenceRole: "official-discovery",
    occurredAt: "2026-08-17T12:26:00",
    timeZone: "Europe/Prague",
    title: "První neděle v měsíci zdarma. Státní muzea a galerie se otevírají úplně všem.",
    publisher: "Ministry of Culture of the Czech Republic",
    url: "https://www.mk.gov.cz/novinky-a-media-cs-4/example",
    payload: { excerptCz: "Ministerstvo otevírá stálé expozice každou první neděli v měsíci zdarma." }
  });
  const match = matchRecordToPromise(item, freeMuseums);
  assert.ok(match);
  assert.deepEqual(match.matchedTerms.map(({ phrase }) => phrase), ["státní muzea a galerie"]);
});

test("builds a bounded primary-only evidence package", () => {
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
  assert.equal(evidencePackage.methodologyVersion, "slava-v6");
  assert.deepEqual(evidencePackage.assessmentContext, { mode: "live", ruleVersion: "period-timing-v1" });
  assert.equal(evidencePackage.evidence.length, 2);
  assert.equal(evidencePackage.evidence[0].role, "promise-source");
  assert.equal(evidencePackage.evidence[1].id, primary.id);
  assert.equal(evidencePackage.generation.candidateMatchCount, 2);
  assert.equal(evidencePackage.generation.selectedPrimaryEvidenceCount, 1);
  assert.equal(evidencePackage.generation.directionAssigned, false);
  assert.equal(evidencePackage.generation.publicationApproved, false);
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

test("treats a matched official ministry publication as a government-action candidate", () => {
  const promise = registry.promises[0];
  const record = createCollectedRecord({
    id: "ministry--eet",
    sourceId: "ministry",
    kind: "official-publication",
    primary: true,
    evidenceRole: "official-discovery",
    occurredAt: "2026-06-01T10:00:00.000Z",
    title: "Ministerstvo představilo EET 2.0",
    publisher: "Ministerstvo",
    url: "https://example.gov.cz/eet",
    payload: { excerptCz: "Ministerstvo připravilo evidenci tržeb." }
  });
  const match = matchRecordToPromise(record, promise);
  assert.equal(match.attributionStatus, "candidate-government-action");
  const evidencePackage = buildEvidencePackage({ promise, matches: [match], collectorRun: { schemaVersion: "1.0.0", runId: "collector-official", records: [record] }, asOf: "2026-09-02" });
  assert.ok(evidencePackage);
  assert.equal(evidencePackage.generation.directionAssigned, false);
});

test("attributes an official party publication only to the party that published it", () => {
  const statement = createCollectedRecord({
    id: "party--eet",
    sourceId: "ano-party-news",
    kind: "official-publication",
    primary: true,
    evidenceRole: "official-party-publication",
    occurredAt: "2026-06-01T10:00:00.000Z",
    title: "ANO představilo další krok k EET 2.0",
    publisher: "ANO 2011",
    url: "https://party.example/eet",
    payload: { excerptCz: "Hnutí oznámilo konkrétní další krok.", sourcePartyId: "ano" }
  });
  const ownMatch = matchRecordToPromise(statement, eet);
  assert.equal(ownMatch.attributionStatus, "verified-party-publication");
  const evidencePackage = buildEvidencePackage({
    promise: eet,
    matches: [ownMatch],
    collectorRun: { schemaVersion: "1.0.0", runId: "collector-party", records: [statement] },
    asOf: "2026-09-03"
  });
  assert.equal(evidencePackage.evidence[1].matchBasis.attributionStatus, "verified-party-publication");

  const otherPartyStatement = createCollectedRecord({
    ...statement,
    id: "party--eet-other",
    sourceId: "other-party-news",
    publisher: "Other party",
    payload: { ...statement.payload, sourcePartyId: "spd" }
  });
  assert.equal(matchRecordToPromise(otherPartyStatement, eet).attributionStatus, "unattributed");
});

test("requires decisive vote context before a party direction enters the package", () => {
  const votePayload = {
    externalVoteId: "900",
    counts: { yes: 100, no: 20 },
    partyVoteSummaries: [{
      partyId: "ano",
      eligibleMemberCount: 80,
      directionalVoteCount: 70,
      strictMajorityThreshold: 41,
      counts: { yes: 70, no: 0, abstained: 0, notVoting: 0, absent: 10, unknown: 0 },
      majorityChoice: "yes",
      attributionStatus: "attributed",
      ruleVersion: "party-vote-strict-majority-v3"
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

test("includes a decisive vote without a strict party majority for non-support review", () => {
  const vote = record({
    id: "psp--vote-insufficient-party-support",
    kind: "parliamentary-vote",
    title: "Vl.n.z. o evidenci tržeb",
    payload: {
      externalVoteId: "902",
      counts: { yes: 80, no: 40 },
      partyVoteSummaries: [{
        partyId: "ano",
        eligibleMemberCount: 7,
        directionalVoteCount: 3,
        strictMajorityThreshold: 4,
        counts: { yes: 3, no: 0, abstained: 0, notVoting: 0, absent: 4, unknown: 0 },
        majorityChoice: null,
        attributionStatus: "no-strict-majority",
        ruleVersion: "party-vote-strict-majority-v3"
      }],
      linkedPrints: [{
        number: 189,
        titleCz: "Vládní návrh zákona o evidenci tržeb",
        historyContexts: [{ actionCz: "souhlas", resolutionNumber: 265 }]
      }]
    }
  });

  const match = matchRecordToPromise(vote, eet);
  assert.equal(match.attributionStatus, "verified-party-no-majority");
  const evidencePackage = buildEvidencePackage({
    promise: eet,
    matches: [match],
    collectorRun: { schemaVersion: "1.0.0", runId: "collector-no-majority", records: [vote] },
    asOf: "2026-08-31"
  });
  assert.equal(evidencePackage.evidence[1].matchBasis.attributionStatus, "verified-party-no-majority");
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
        strictMajorityThreshold: 41,
        counts: { yes: 60, no: 0, abstained: 0, notVoting: 0, absent: 20, unknown: 0 },
        majorityChoice: "yes",
        attributionStatus: "attributed",
        ruleVersion: "party-vote-strict-majority-v3"
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
