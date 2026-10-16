import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { strToU8 } from "fflate";
import {
  createCollectedRecord,
  deduplicateRecords,
  fetchVerified,
  validateRegistry
} from "../scripts/lib/collector-core.mjs";
import { derivePartyVoteSummaries, normalizePspData, parseUnl } from "../scripts/lib/psp-collector.mjs";
import { attributionStatusForRecord, versionConcerned } from "../scripts/lib/attribution.mjs";

const governmentPeriods = {
  schemaVersion: "1.0.0",
  periods: [{ id: "test-government", from: "2025-12-15", to: null, partyIds: ["ano", "motoriste", "spd"], verificationUrl: "https://gov.example/appointed" }]
};

const officialSource = {
  id: "example-chamber",
  publisher: "Example Chamber",
  collector: "psp-open-data",
  enabled: true,
  primary: true,
  evidenceRole: "primary-record",
  bootstrapFrom: "2025-10-01",
  coverage: { mode: "term-snapshot", note: "Fixture snapshot covers the whole term." },
  verificationUrl: "https://news.example/open-data",
  verifiedAt: "2026-08-31",
  expectedHosts: ["news.example"]
};

test("validates a unique, explicit collector registry", () => {
  const registry = { schemaVersion: "1.0.0", sources: [officialSource] };
  assert.equal(validateRegistry(registry), registry);
  assert.throws(() => validateRegistry({ schemaVersion: "1.0.0", sources: [officialSource, officialSource] }), /Duplicate collector source id/);
  assert.throws(() => validateRegistry({
    schemaVersion: "1.0.0",
    sources: [{ ...officialSource, collector: "rss" }]
  }), /Unknown collector type/);
  assert.throws(() => validateRegistry({
    schemaVersion: "1.0.0",
    sources: [{ ...officialSource, primary: false, evidenceRole: "discovery-context" }]
  }), /not evidence sources/);
});

test("retries transient source responses before accepting verified bytes", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  const response = (status, body, contentType = "text/plain") => ({
    ok: status >= 200 && status < 300,
    status,
    url: "https://news.example/api",
    headers: new Headers({ "content-type": contentType }),
    body: null,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer
  });
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts < 3) return response(503, "temporarily unavailable");
    return response(200, '{"items":[]}', "application/json");
  };
  try {
    const result = await fetchVerified(officialSource, "https://news.example/api", {
      maxBytes: 1_000,
      expectedContentTypes: ["application/json"],
      retryAttempts: 3,
      retryDelayMs: 0
    });
    assert.equal(attempts, 3);
    assert.equal(new TextDecoder().decode(result.bytes), '{"items":[]}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries transport failures while fetching and reading source bytes", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  const response = (readBytes) => ({
    ok: true,
    status: 200,
    url: "https://news.example/api",
    headers: new Headers({ "content-type": "application/json" }),
    body: null,
    arrayBuffer: readBytes
  });
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError("connection reset before response");
    if (attempts === 2) return response(async () => { throw new TypeError("connection reset while reading body"); });
    return response(async () => new TextEncoder().encode('{"items":[]}').buffer);
  };
  try {
    const result = await fetchVerified(officialSource, "https://news.example/api", {
      maxBytes: 1_000,
      expectedContentTypes: ["application/json"],
      retryAttempts: 3,
      retryDelayMs: 0
    });
    assert.equal(attempts, 3);
    assert.equal(new TextDecoder().decode(result.bytes), '{"items":[]}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("waits twice as long before each further retry after a refused connection", async () => {
  const originalFetch = globalThis.fetch;
  const attemptTimes = [];
  globalThis.fetch = async () => {
    attemptTimes.push(Date.now());
    if (attemptTimes.length < 4) throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    return {
      ok: true,
      status: 200,
      url: "https://news.example/api",
      headers: new Headers({ "content-type": "application/json" }),
      body: null,
      arrayBuffer: async () => new TextEncoder().encode("{}").buffer
    };
  };
  try {
    await fetchVerified(officialSource, "https://news.example/api", {
      maxBytes: 1_000,
      expectedContentTypes: ["application/json"],
      retryAttempts: 4,
      retryDelayMs: 40
    });
    const waits = attemptTimes.slice(1).map((time, index) => time - attemptTimes[index]);
    assert.equal(waits.length, 3);
    // Timers never fire early; allow a millisecond of clock rounding.
    [40, 80, 160].forEach((expected, index) => assert.ok(waits[index] >= expected - 1, `wait ${index + 1} was ${waits[index]} ms, expected at least ${expected} ms`));

    // A cap stops the doubling.
    attemptTimes.length = 0;
    await fetchVerified(officialSource, "https://news.example/api", {
      maxBytes: 1_000,
      expectedContentTypes: ["application/json"],
      retryAttempts: 4,
      retryDelayMs: 40,
      maxRetryDelayMs: 50
    });
    const cappedWaits = attemptTimes.slice(1).map((time, index) => time - attemptTimes[index]);
    assert.equal(cappedWaits.length, 3);
    [40, 50, 50].forEach((expected, index) => assert.ok(cappedWaits[index] >= expected - 1 && cappedWaits[index] < expected + 60, `capped wait ${index + 1} was ${cappedWaits[index]} ms, expected about ${expected} ms`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("documents every configured collector source in the canonical pipeline policy", async () => {
  const registry = JSON.parse(await readFile(new URL("../automation/collectors/sources.json", import.meta.url), "utf8"));
  const policy = await readFile(new URL("../docs/evidence-pipeline.md", import.meta.url), "utf8");
  for (const source of registry.sources) {
    assert.match(policy, new RegExp(`\\x60${source.id}\\x60`), `Missing ${source.id} from evidence-pipeline.md`);
  }
});

test("UNL parser respects escaped delimiters and null fields", () => {
  const rows = parseUnl("1|escaped\\|pipe||\n", ["id", "text", "empty"]);
  assert.deepEqual(rows, [{ id: "1", text: "escaped|pipe", empty: null }]);
});

test("requires a strict majority of all club members for a party direction", () => {
  const vote = (externalMpId, choiceCode) => ({
    externalMpId,
    choiceCode,
    clubMembershipsAtVote: [{ projectPartyId: "ano" }]
  });
  const attributed = derivePartyVoteSummaries([
    vote("1", "A"), vote("2", "A"), vote("3", "A"), vote("4", "@"), vote("5", "M")
  ])[0];
  assert.equal(attributed.eligibleMemberCount, 5);
  assert.equal(attributed.directionalVoteCount, 3);
  assert.equal(attributed.strictMajorityThreshold, 3);
  assert.equal(attributed.majorityChoice, "yes");
  assert.equal(attributed.attributionStatus, "attributed");
  assert.equal(attributed.ruleVersion, "party-vote-strict-majority-v3");

  const insufficientSupport = derivePartyVoteSummaries([
    vote("1", "A"), vote("2", "A"), vote("3", "N"), vote("4", "C"), vote("5", "@")
  ])[0];
  assert.equal(insufficientSupport.majorityChoice, null);
  assert.equal(insufficientSupport.attributionStatus, "no-strict-majority");

  const absentMajority = derivePartyVoteSummaries([
    vote("1", "A"), vote("2", "@"), vote("3", "@"), vote("4", "M"), vote("5", "M")
  ])[0];
  assert.equal(absentMajority.majorityChoice, null);
  assert.equal(absentMajority.attributionStatus, "no-strict-majority");

  const noDirectionalVotes = derivePartyVoteSummaries([
    vote("1", "C"), vote("2", "F"), vote("3", "@")
  ])[0];
  assert.equal(noDirectionalVotes.majorityChoice, null);
  assert.equal(noDirectionalVotes.attributionStatus, "no-strict-majority");

  const voided = derivePartyVoteSummaries([
    vote("1", "A"), vote("2", "A"), vote("3", "A")
  ], { voidedByOfficialRecord: true })[0];
  assert.equal(voided.majorityChoice, null);
  assert.equal(voided.attributionStatus, "voided-vote");
});

function unl(fields) {
  return `${fields.map((value) => value ?? "").join("|")}|\n`;
}

function entry(text) {
  return strToU8(text);
}

// A row of tisky_za.unl with all its official columns (psp.cz k=1303).
function subPrintRow({ printId, partNumber, historyId = null, kindId, shortTitle, fullTitle = shortTitle, resultId = null, distributedAt = null, status = null }) {
  const fields = Array(16).fill(null);
  Object.assign(fields, { 0: printId, 1: partNumber, 2: historyId, 3: kindId, 4: shortTitle, 5: fullTitle, 11: resultId, 14: distributedAt, 15: status });
  return unl(fields);
}

// vysledek.unl as published in windows-1250, the results of a government
// opinion; "á" and "í" have the same bytes in latin1.
const resultTable = unl(["17", "nesouhlas"]) + unl(["19", "souhlas"]) + unl(["22", "neutrální"]);
const resultTableBytes = () => Buffer.from(resultTable, "latin1");

test("PSP normalizer joins votes, prints, and club membership at vote date", () => {
  const source = {
    id: "psp-core-2025",
    publisher: "PSP",
    evidenceRole: "primary-record",
    partyAliases: { ANO2011: "ano" },
    term: { year: 2025, number: 10, organId: 174 }
  };

  const votesEntries = {
    "hl2025s.unl": entry(unl(["900", "174", "12", "33", "5", "30.08.2026", "12:34", "100", "20", "10", "2", "132", "67", "N", "A", "Final vote", "Vote"])),
    "hl2025h1.unl": entry(unl(["100", "900", "A"])),
    "zmatecne.unl": entry("")
  };
  const membersEntries = {
    "osoby.unl": entry(unl(["1", null, "Novak", "Jan", null, "01.01.1980", "M", null, null])),
    "poslanec.unl": entry(unl(["100", "1", null, null, "174", null, null, null, null, null, null, null, null, null, "1"])),
    "zarazeni.unl": entry(unl(["1", "1750", "0", "2025-10-08 00", null, null, null])),
    "organy.unl": entry(unl(["1750", "174", "1", "ANO2011", "Poslanecky klub ANO 2011", "ANO club", "08.10.2025", null, null, "0"]))
  };
  const printFields = Array(24).fill(null);
  Object.assign(printFields, { 0: "700", 1: "1", 2: "20", 3: "189", 4: "0", 7: "174", 10: "Short bill", 15: "Full bill title", 21: "2026-08-29 09:15" });
  const historyFields = Array(15).fill(null);
  Object.assign(historyFields, { 0: "800", 1: "700", 2: "2026-08-30 12:34", 3: "900", 4: "10", 6: "12", 7: "55" });
  const printsEntries = {
    "tisky.unl": entry(unl(printFields)),
    "hist.unl": entry(unl(historyFields)),
    "stavy.unl": entry(unl(["20", "6", "1", "Approved", null, null]) + unl(["10", "5", "1", "Before vote", null, null])),
    "prechody.unl": entry(unl(["10", "10", "20", "5", "1"])),
    "typ_akce.unl": entry(unl(["5", "Chamber approved bill"])),
    "typ_stavu.unl": entry(unl(["5", "3. cteni"]) + unl(["6", "Odesilano do Senatu"])),
    "tisky_za.unl": entry(subPrintRow({ printId: "700", partNumber: "2", historyId: "801", kindId: "11", shortTitle: "Usnesení Senátu k tisku 189/0", fullTitle: "Usnesení Senátu" }) + subPrintRow({ printId: "700", partNumber: "1", historyId: "801", kindId: "12", shortTitle: "Zákon ze Senátu" })),
    "vysledek.unl": resultTableBytes(),
    "predkladatel.unl": entry("")
  };

  const sessionsEntries = { "schuze.unl": entry(""), "bod_schuze.unl": entry("") };
  const result = normalizePspData({ source, since: "2026-08-01", votesEntries, membersEntries, printsEntries, sessionsEntries, governmentPeriods });
  const vote = result.records.find((record) => record.kind === "parliamentary-vote");
  const step = result.records.find((record) => record.kind === "legislative-step");
  assert.ok(vote);
  assert.ok(step);
  assert.equal(vote.payload.linkedPrints[0].number, 189);
  assert.equal(vote.payload.linkedPrints[0].historyContexts[0].actionCz, "Chamber approved bill");
  assert.equal(vote.payload.linkedPrints[0].linkBasis, "history-vote-id");
  assert.equal(vote.payload.individualVotes[0].clubMembershipsAtVote[0].projectPartyId, "ano");
  assert.equal(step.payload.externalVoteId, "900");
  assert.equal(step.payload.actionCz, "Chamber approved bill");
  assert.equal(step.payload.documentPublishedAt, "2026-08-29T09:15:00");
  // The stage the step leaves tells which text of the bill the vote concerned.
  assert.equal(vote.payload.linkedPrints[0].historyContexts[0].stageCz, "3. cteni");
  assert.equal(step.payload.stageCz, "3. cteni");
  // Only the Senate resolution sub-print (druh_tisku 11) is listed.
  assert.deepEqual(vote.payload.linkedPrints[0].senateResolutionPartNumbers, [2]);
  assert.deepEqual(step.payload.senateResolutionPartNumbers, [2]);
  assert.equal(vote.primary, true);
});

function agendaFixture({ historyAgendaId = "5001" } = {}) {
  const source = {
    id: "psp-core-2025",
    publisher: "PSP",
    evidenceRole: "primary-record",
    partyAliases: { MS: "motoriste" },
    term: { year: 2025, number: 10, organId: 174 }
  };
  const voteRow = (id, number, agenda, time, longTitle) => unl([id, "174", "29", number, agenda, "26.08.2026", time, "104", "72", "0", "0", "176", "101", "N", "A", longTitle, null]);
  const votesEntries = {
    "hl2025s.unl": entry(
      voteRow("950", "10", "3", "11:00", "Pozmenovaci navrh")
      + voteRow("951", "11", "3", "11:05", null)
      + voteRow("952", "12", "0", "11:10", "Proceduralni hlasovani")
    ),
    "hl2025h1.unl": entry(unl(["100", "951", "A"]) + unl(["100", "950", "B"]) + unl(["100", "952", "A"])),
    "zmatecne.unl": entry("")
  };
  const membersEntries = {
    "osoby.unl": entry(unl(["1", null, "Novak", "Jan", null, "01.01.1980", "M", null, null])),
    "poslanec.unl": entry(unl(["100", "1", null, null, "174", null, null, null, null, null, null, null, null, null, "1"])),
    "zarazeni.unl": entry(unl(["1", "1760", "0", "2025-10-08 00", null, null, null])),
    "organy.unl": entry(unl(["1760", "174", "1", "MS", "Poslanecky klub Motoriste sobe", "MS club", "08.10.2025", null, null, "0"]))
  };
  const print = (id, number, title) => {
    const fields = Array(24).fill(null);
    Object.assign(fields, { 0: id, 1: "1", 2: "20", 3: number, 4: "0", 7: "174", 10: title, 15: title });
    return unl(fields);
  };
  const historyFields = Array(15).fill(null);
  Object.assign(historyFields, { 0: "810", 1: "701", 2: "2026-08-26 00:00", 3: "951", 4: "11", 5: historyAgendaId, 6: "29" });
  const printsEntries = {
    "tisky.unl": entry(print("701", "68", "Vladni navrh zakona, kterym se meni zakon c. 23/2017 Sb., o pravidlech rozpoctove odpovednosti") + print("702", "90", "Unrelated bill")),
    "hist.unl": entry(unl(historyFields)),
    "stavy.unl": entry(unl(["20", "6", "1", "Approved", null, null])),
    "prechody.unl": entry(unl(["11", "20", "20", "6", "1"])),
    "typ_akce.unl": entry(unl(["6", "setrvano"])),
    "typ_stavu.unl": entry(unl(["6", "Snemovna (Senat)"])),
    "tisky_za.unl": entry(""),
    "vysledek.unl": resultTableBytes(),
    "predkladatel.unl": entry("")
  };
  // PSP files are windows-1250; the fixture stays ASCII so UTF-8 bytes decode identically.
  const sessionsEntries = {
    // The proposed and approved agendas share id_schuze and id_bod and differ in pozvanka;
    // the proposed agenda numbers the item differently and must be ignored.
    "schuze.unl": entry(unl(["291", "174", "29", "2026-08-25 09", null, null, "1"]) + unl(["291", "174", "29", "2026-08-25 09", null, null, null])),
    "bod_schuze.unl": entry(
      unl(["4999", "291", "702", "1", "3", "Unrelated proposed item", null, null, null, "1"])
      + unl(["5001", "291", "701", "13", "3", "Vladni navrh zakona o pravidlech rozpoctove odpovednosti", "/snemovni tisk 68/ - zakon vraceny prezidentem", null, "1", null])
      + unl(["5001", "291", null, "6", "4", "Written interpellation answer", null, null, "1", null])
    )
  };
  return normalizePspData({ source, since: "2026-08-01", votesEntries, membersEntries, printsEntries, sessionsEntries, governmentPeriods });
}

test("PSP normalizer links votes to the print of their approved agenda item", () => {
  const result = agendaFixture();
  assert.deepEqual(result.warnings, []);
  const byId = new Map(result.records.map((record) => [record.id, record]));
  const amendment = byId.get("psp-core-2025--vote-950");
  const finalVote = byId.get("psp-core-2025--vote-951");
  const procedural = byId.get("psp-core-2025--vote-952");

  assert.equal(finalVote.payload.agendaItem.titleCz, "Vladni navrh zakona o pravidlech rozpoctove odpovednosti");
  assert.equal(finalVote.payload.agendaItem.suffixCz, "/snemovni tisk 68/ - zakon vraceny prezidentem");
  assert.equal(finalVote.payload.linkedPrints.length, 1);
  assert.equal(finalVote.payload.linkedPrints[0].number, 68);
  assert.equal(finalVote.payload.linkedPrints[0].linkBasis, "history-vote-id");
  assert.equal(finalVote.payload.linkedPrints[0].historyContexts[0].actionCz, "setrvano");

  // Another vote on the same agenda item names the print but never inherits the decisive step.
  assert.equal(amendment.payload.linkedPrints[0].number, 68);
  assert.equal(amendment.payload.linkedPrints[0].linkBasis, "agenda-item");
  assert.deepEqual(amendment.payload.linkedPrints[0].historyContexts, []);

  assert.equal(procedural.payload.agendaItem, null);
  assert.deepEqual(procedural.payload.linkedPrints, []);
});

test("PSP normalizer skips agenda links when schuze.zip and hist.unl disagree", () => {
  const result = agendaFixture({ historyAgendaId: "7777" });
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /agenda-item vote links were skipped/);
  const amendment = result.records.find((record) => record.id === "psp-core-2025--vote-950");
  assert.equal(amendment.payload.agendaItem, null);
  assert.deepEqual(amendment.payload.linkedPrints, []);
});

test("PSP normalizer attributes submitted bills to proposer and government parties", () => {
  const source = {
    id: "psp-core-2025",
    publisher: "PSP",
    evidenceRole: "primary-record",
    partyAliases: { MS: "motoriste", ANO2011: "ano" },
    term: { year: 2025, number: 10, organId: 174 }
  };
  const print = (id, number, kind, proposerType, personId, submitted, title) => {
    const fields = Array(24).fill(null);
    Object.assign(fields, { 0: id, 1: kind, 2: "20", 3: number, 4: "0", 5: proposerType, 7: "174", 8: personId, 10: title, 11: submitted, 15: title });
    return unl(fields);
  };
  const submission = (historyId, printId) => {
    const fields = Array(15).fill(null);
    Object.assign(fields, { 0: historyId, 1: printId, 2: "2026-01-27 00:00", 4: "1" });
    return unl(fields);
  };
  const result = normalizePspData({
    source,
    since: "2025-10-01",
    governmentPeriods,
    votesEntries: { "hl2025s.unl": entry(""), "hl2025h1.unl": entry(""), "zmatecne.unl": entry("") },
    membersEntries: {
      "osoby.unl": entry(unl(["1", null, "Novak", "Jan", null, "01.01.1980", "M", null, null]) + unl(["2", null, "Dvorak", "Petr", null, "01.01.1980", "M", null, null])),
      "poslanec.unl": entry(unl(["100", "1", null, null, "174", null, null, null, null, null, null, null, null, null, "1"]) + unl(["101", "2", null, null, "174", null, null, null, null, null, null, null, null, null, "1"])),
      "zarazeni.unl": entry(unl(["1", "1760", "0", "2025-10-08 00", null, null, null]) + unl(["2", "1770", "0", "2025-10-08 00", null, null, null])),
      "organy.unl": entry(unl(["1760", "174", "1", "MS", "Klub Motoriste", "MS club", "08.10.2025", null, null, "0"]) + unl(["1770", "174", "1", "PIR", "Klub Pirati", "PIR club", "08.10.2025", null, null, "0"]))
    },
    printsEntries: {
      "tisky.unl": entry(
        print("701", "11", "2", "3", null, "06.11.2025", "Member bill")
        + print("702", "90", "1", null, "9", "27.01.2026", "Government bill")
        + print("703", "94", "3", null, "9", "12.11.2025", "Earlier government budget")
        + print("704", "15", "2", "3", null, "10.11.2025", "Other party member bill")
      ),
      "hist.unl": entry(submission("801", "701") + submission("802", "702") + submission("803", "703") + submission("804", "704")),
      "stavy.unl": entry(unl(["20", "1", "1", "Submitted", null, null])),
      "prechody.unl": entry(unl(["1", "20", "20", "7", "1"])),
      "typ_akce.unl": entry(unl(["7", "předložen"])),
      "typ_stavu.unl": entry(""),
      "tisky_za.unl": entry(""),
      "vysledek.unl": resultTableBytes(),
      "predkladatel.unl": entry(unl(["701", "1", "1", "0"]) + unl(["701", "2", "2", "0"]) + unl(["704", "2", "1", "0"]))
    },
    sessionsEntries: { "schuze.unl": entry(""), "bod_schuze.unl": entry("") }
  });
  const proposalOf = (printNumber) => result.records.find((record) => record.payload.printNumber === printNumber).payload.proposal;
  assert.deepEqual(proposalOf(11), { kind: "member-bill", submittedOn: "2025-11-06", proposerPartyIds: ["motoriste"], proposerCz: null });
  assert.deepEqual(proposalOf(90).proposerPartyIds, ["ano", "motoriste", "spd"]);
  assert.equal(proposalOf(90).kind, "government-proposal");
  assert.deepEqual(proposalOf(94).proposerPartyIds, [], "a proposal of the government before 15 December 2025 is not conduct of the current governing parties");
  assert.deepEqual(proposalOf(15).proposerPartyIds, []);
});

test("PSP normalizer records the government's opinion on a bill it did not submit", () => {
  const source = { id: "psp-core-2025", publisher: "PSP", evidenceRole: "primary-record", partyAliases: {}, term: { year: 2025, number: 10, organId: 174 } };
  const print = (id, number, kindId = "2") => {
    const fields = Array(24).fill(null);
    Object.assign(fields, { 0: id, 1: kindId, 2: "20", 3: number, 4: "0", 5: "2", 7: "174", 10: `Member bill ${number}`, 11: "06.11.2025", 15: `Member bill ${number}` });
    return unl(fields);
  };
  const opinion = (printId, resultId, distributedAt) => subPrintRow({ printId, partNumber: "1", kindId: "7", shortTitle: "Stanovisko vlády", resultId, distributedAt });
  const normalize = (subPrints, governmentBill = "") => normalizePspData({
    source,
    since: "2025-10-01",
    governmentPeriods,
    votesEntries: { "hl2025s.unl": entry(""), "hl2025h1.unl": entry(""), "zmatecne.unl": entry("") },
    membersEntries: { "osoby.unl": entry(""), "poslanec.unl": entry(""), "zarazeni.unl": entry(""), "organy.unl": entry("") },
    printsEntries: {
      "tisky.unl": entry(print("701", "7") + print("702", "8") + print("703", "9") + print("704", "10") + governmentBill),
      "hist.unl": entry(""),
      "stavy.unl": entry(""),
      "prechody.unl": entry(""),
      "typ_akce.unl": entry(""),
      "typ_stavu.unl": entry(""),
      "tisky_za.unl": entry(subPrints),
      "vysledek.unl": resultTableBytes(),
      "predkladatel.unl": entry("")
    },
    sessionsEntries: { "schuze.unl": entry(""), "bod_schuze.unl": entry("") }
  });
  const senateResolution = subPrintRow({ printId: "701", partNumber: "2", kindId: "11", shortTitle: "Usnesení Senátu" });
  const result = normalize(senateResolution + opinion("701", "19", "2026-01-12 10:00") + opinion("702", "17", "2026-01-13 11:30") + opinion("703", "22", "2026-01-14 09:00") + opinion("704", "17", "2025-12-04 13:47"));
  const opinions = Object.fromEntries(result.records.filter(({ kind }) => kind === "government-opinion").map((record) => [record.payload.printNumber, record]));
  assert.equal(opinions[7].id, "psp-core-2025--government-opinion-701-1");
  assert.equal(opinions[7].url, "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=7&CT1=1");
  assert.equal(opinions[7].occurredAt, "2026-01-12T10:00:00");
  // The bill's Senate resolutions go with the opinion, for a print that
  // only the opinion brings into the pipeline.
  assert.deepEqual(opinions[7].payload.senateResolutionPartNumbers, [2]);
  assert.deepEqual(opinions[8].payload.senateResolutionPartNumbers, []);
  assert.deepEqual(
    Object.values(opinions).map(({ payload }) => [payload.printNumber, payload.resultCz, payload.opinion, payload.distributedOn, payload.proposal.proposerPartyIds]),
    [
      [7, "souhlas", "agrees", "2026-01-12", ["ano", "motoriste", "spd"]],
      [8, "nesouhlas", "disagrees", "2026-01-13", ["ano", "motoriste", "spd"]],
      [9, "neutrální", "neutral", "2026-01-14", ["ano", "motoriste", "spd"]],
      // An opinion of the government before 15 December 2025 is not
      // conduct of the current governing parties.
      [10, "nesouhlas", "disagrees", "2025-12-04", []]
    ]
  );
  // An agreement or a disagreement is conduct of every governing party; a
  // neutral opinion and an earlier government's opinion are not.
  const status = (printNumber, partyId) => attributionStatusForRecord(opinions[printNumber], { partyId }).attributionStatus;
  assert.equal(status(7, "spd"), "verified-government-opinion");
  assert.equal(status(8, "ano"), "verified-government-opinion");
  assert.equal(status(9, "ano"), "unattributed");
  assert.equal(status(10, "ano"), "unattributed");
  assert.equal(versionConcerned(opinions[7], "701").version, "proposed");
  // A revoked opinion or Senate resolution (status 1 or 2) no longer stands.
  const subPrint = (printId, partNumber, kindId, resultId, distributedAt, status) => subPrintRow({ printId, partNumber, kindId, shortTitle: kindId === "7" ? "Stanovisko vlády" : "Usnesení Senátu", resultId, distributedAt, status });
  const revoked = normalize(subPrint("702", "1", "7", "17", "2026-01-13 11:30", "2") + subPrint("701", "2", "11", null, null, "1") + subPrint("701", "3", "7", "19", "2026-01-12 10:00", null));
  assert.deepEqual(revoked.records.filter(({ kind }) => kind === "government-opinion").map(({ payload }) => [payload.printNumber, payload.partNumber, payload.senateResolutionPartNumbers]), [[7, 3, []]]);
  // An opinion not yet distributed is left out, whatever psp.cz records of
  // it so far.
  assert.equal(normalize(opinion("701", "", "")).records.filter(({ kind }) => kind === "government-opinion").length, 0);
  // An opinion on a government bill, or with a missing or unknown result,
  // stops the run, also before the cutoff.
  assert.throws(() => normalize(opinion("705", "19", "2026-01-12 10:00"), print("705", "11", "1")), /Government opinion 11\/1 is on a print of unsupported kind 1/);
  assert.throws(() => normalize(opinion("701", "19", "2025-09-12 10:00") + opinion("702", "99", "2025-09-12 10:00")), /Government opinion 8\/1 has an unsupported result: none/);
  assert.throws(() => normalize(opinion("701", "", "2026-01-12 10:00")), /Government opinion 7\/1 has an unsupported result: none/);
  assert.throws(() => normalize(opinion("701", "99", "2026-01-12 10:00")), /Government opinion 7\/1 has an unsupported result: none/);
});

test("deduplication accepts identical records and rejects conflicting content", () => {
  const base = {
    id: "psp-core-2025--vote-1",
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-08-30T10:00:00.000Z",
    title: "Title",
    publisher: "Chamber of Deputies of the Parliament of the Czech Republic",
    url: "https://www.psp.cz/sqw/hlasy.sqw?g=1",
    payload: {}
  };
  const first = createCollectedRecord(base);
  assert.equal(deduplicateRecords([first, structuredClone(first)]).length, 1);
  const second = createCollectedRecord({ ...base, title: "Changed title" });
  assert.throws(() => deduplicateRecords([first, second]), /Conflicting records/);
});
