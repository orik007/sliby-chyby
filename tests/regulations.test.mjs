import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isPotentiallyAttributable, versionConcerned } from "../scripts/lib/attribution.mjs";
import { lawChangeOfRegulation } from "../scripts/lib/print-parts.mjs";
import { collectRegulations, czechDate, enablingActsOf, governingPartiesOn, readRegulation, regulationHeading, regulationKindOfCitation } from "../scripts/lib/regulations.mjs";

// Six real acts as e-Sbírka holds them (read on 6 October 2026): their
// citations and the heading and first nodes of their wording as promulgated.
// 16/2026: a government regulation; 178/2026: a decree of the Ministry of the
// Interior; 483/2025: a decree of two ministries whose issuing sentence opens
// its first part; 566/2025: a decree of the Czech National Bank; 527/2025: a
// decree adopted before 15 December 2025; 179/2026: not yet digitised.
const acts = JSON.parse(await readFile(new URL("./fixtures/regulations/acts.json", import.meta.url), "utf8"));
const governmentPeriods = JSON.parse(await readFile(new URL("../automation/attribution/government-periods.json", import.meta.url), "utf8"));
const source = { id: "esbirka-regulations" };

test("a Czech date in words and the acts a regulation is issued under are read from its heading", () => {
  assert.equal(czechDate("ze dne 23. září 2026,"), "2026-09-23");
  assert.equal(czechDate("ze dne 6. listopadu 2025"), "2025-11-06");
  assert.equal(czechDate("o portálu kritické infrastruktury"), null);
  assert.deepEqual(enablingActsOf("Ministerstvo vnitra stanoví podle § 29 odst. 2 zákona č. 266/2025 Sb., o odolnosti subjektů kritické infrastruktury, k provedení § 20 odst. 9 zákona o kritické infrastruktuře:"), ["266/2025"]);
  assert.deepEqual(enablingActsOf("Vláda nařizuje podle § 123 odst. 6 písm. f) zákona č. 262/2006 Sb., zákoník práce, ve znění zákona č. 364/2011 Sb., a podle § 145 zákona č. 234/2014 Sb.:"), ["262/2006", "234/2014"]);
  assert.equal(regulationKindOfCitation("Nařízení vlády č. 16/2026 Sb."), "government-regulation");
  assert.equal(regulationKindOfCitation("Vyhláška č. 178/2026 Sb."), "ministerial-decree");
  assert.equal(regulationKindOfCitation("Zákon č. 155/2026 Sb."), null);
});

test("the heading says who adopted the act and when, also when the issuing sentence opens its first part", () => {
  assert.deepEqual(regulationHeading(acts["16/2026"].nodes), { adoptedOn: "2026-01-26", issuerCz: "Vláda", issuer: "government", enablingActs: ["262/2006", "234/2014"] });
  assert.deepEqual(regulationHeading(acts["178/2026"].nodes), { adoptedOn: "2026-09-23", issuerCz: "Ministerstvo vnitra", issuer: "ministry", enablingActs: ["266/2025"] });
  assert.deepEqual(regulationHeading(acts["483/2025"].nodes), { adoptedOn: "2025-11-06", issuerCz: "Ministerstvo zemědělství a Ministerstvo životního prostředí", issuer: "ministry", enablingActs: ["156/1998"] });
  assert.equal(regulationHeading(acts["566/2025"].nodes).issuer, "other");
  assert.equal(regulationHeading(acts["566/2025"].nodes).issuerCz, "Česká národní banka");
  // 582/2025 Sb. has a zero-width space before "podle".
  assert.deepEqual(regulationHeading([
    ["dokument/prefix/frag_1133900", "ze dne 22. prosince 2025,"],
    ["dokument/prefix/frag_1132586", "Ministerstvo zdravotnictví stanoví ​podle § 37 odst. 1 písm. g) zákona č. 95/2004 Sb., o podmínkách získávání a uznávání odborné způsobilosti:"]
  ]), { adoptedOn: "2025-12-22", issuerCz: "Ministerstvo zdravotnictví", issuer: "ministry", enablingActs: ["95/2004"] });
});

test("the governing parties are those of the government in office on the adoption date", () => {
  assert.deepEqual(governingPartiesOn(governmentPeriods, "2025-12-15"), ["ano", "motoriste", "spd"]);
  assert.deepEqual(governingPartiesOn(governmentPeriods, "2025-12-10"), []);
});

// A reader that holds the fixture acts as numbers of their years and nothing
// after them, counting what it is asked for.
function fixtureReader(byAct) {
  const asked = [];
  return {
    asked,
    async citation(act) {
      asked.push(act);
      return byAct[act]?.citation ?? null;
    },
    async nodes(act) {
      return byAct[act].nodes;
    }
  };
}

test("collection reads every act of each year until three numbers in a row are missing, and attributes only what the government or a ministry adopted while a tracked government governed", async () => {
  const byAct = {
    "1/2025": { citation: { citation: "Zákon č. 1/2025 Sb.", title: "Zákon", promulgatedOn: "2025-01-02" } },
    "2/2025": { ...acts["483/2025"] },
    "3/2025": { ...acts["566/2025"] },
    "4/2025": { ...acts["527/2025"] },
    "1/2026": { ...acts["16/2026"] },
    "2/2026": { ...acts["178/2026"] },
    "3/2026": { ...acts["179/2026"] }
  };
  // The fixtures keep their own numbers in their nodes; the reader serves them under these.
  const reader = fixtureReader(byAct);
  const { records, quality } = await collectRegulations({ reader, governmentPeriods, since: "2025-12-01", today: "2026-10-06", source });
  assert.deepEqual(reader.asked, ["1/2025", "2/2025", "3/2025", "4/2025", "5/2025", "6/2025", "7/2025", "1/2026", "2/2026", "3/2026", "4/2026", "5/2026", "6/2026"]);
  assert.deepEqual(records.map(({ payload }) => [payload.citationCz, payload.regulationKind, payload.adoptedOn, payload.proposal.proposerPartyIds]), [
    ["Nařízení vlády č. 16/2026 Sb.", "government-regulation", "2026-01-26", ["ano", "motoriste", "spd"]],
    ["Vyhláška č. 178/2026 Sb.", "ministerial-decree", "2026-09-23", ["ano", "motoriste", "spd"]]
  ]);
  assert.deepEqual({ ...quality, notYetDigitised: quality.notYetDigitised.map(({ act }) => act) }, {
    actsRead: 7,
    // 483/2025 was promulgated before `since` and is not counted.
    regulations: 5,
    governmentRegulations: 2,
    ministerialDecrees: 3,
    attributed: 2,
    notYetDigitised: ["3/2026"],
    adoptedBeforeGovernment: 1,
    otherIssuers: { "Česká národní banka": 1 },
    unreadableHeadings: []
  });
});

test("a regulation's adoption is attributable conduct of every governing party and concerns its one law change, its text as adopted", async () => {
  const { record } = await readRegulation({ reader: fixtureReader(acts), act: "16/2026", kind: "government-regulation", info: acts["16/2026"].citation, governmentPeriods, source });
  assert.equal(record.id, "esbirka-regulations--2026-16");
  assert.equal(record.kind, "regulation-adoption");
  assert.equal(record.occurredAt, "2026-01-26T00:00:00");
  assert.equal(record.url, "https://e-sbirka.gov.cz/sb/2026/16/0000-00-00");
  assert.equal(record.payload.promulgatedOn, "2026-02-10");
  assert.equal(isPotentiallyAttributable(record, ["spd"]), true);
  assert.equal(isPotentiallyAttributable(record, ["stan"]), false);
  assert.equal(versionConcerned(record, record.payload.externalPrintId).version, "adopted");
  const change = lawChangeOfRegulation(record.payload, record.url);
  assert.deepEqual(Object.keys(change.versions), ["adopted"]);
  assert.match(change.versions.adopted.textCz, /^NAŘÍZENÍ VLÁDY\nze dne 26\. ledna 2026,/);
  assert.deepEqual(change.acts, []);
  assert.deepEqual(change.identifiers, ["cz-act-262-2006", "cz-act-234-2014"]);
});
