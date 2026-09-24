import assert from "node:assert/strict";
import test from "node:test";
import { actIdentifier, actsFromBillParagraphs, actsFromPrintTitle, amendedActsExcerpt, namedActsFromBillParagraphs, namedActsFromPrintTitle, printIdentifiers, validatePrintActsCache, emptyPrintActsCache } from "../scripts/lib/print-acts.mjs";
import { deriveDirectLink } from "../scripts/lib/topic-routing.mjs";

test("reads the acts a bill title names", () => {
  assert.deepEqual(actsFromPrintTitle("Návrh poslance Andreje Babiše na vydání zákona, kterým se mění zákon č. 245/2000 Sb., o státních svátcích"), ["245/2000"]);
  assert.deepEqual(actsFromPrintTitle("Vládní návrh zákona o regulaci cen pohonných hmot vládou a o změně zákona č. 526/1990 Sb., o cenách"), ["526/1990"]);
  assert.deepEqual(actsFromPrintTitle("Vládní návrh zákona, kterým se mění některé zákony v oblasti veřejných rozpočtů"), []);
});

test("reads only amending-article headings from a bill text", () => {
  // Headings quoted from the official text of print 90 (10th term).
  const paragraphs = [
    "Změna zákona o pravidlech rozpočtové odpovědnosti",
    "Zákon č. 23/2017 Sb., o pravidlech rozpočtové odpovědnosti, ve znění zákona č. 277/2019 Sb., zákona č. 207/2020 Sb., se mění takto:",
    "(2) V souladu s výdajovým rámcem stanoveným podle zákona upravujícího pravidla rozpočtové odpovědnosti stanoví ministerstvo …",
    "V zákoně č. 218/2000 Sb., o rozpočtových pravidlech, se v § 24 odst. 1 …",
    "Podle zákona č. 159/2006 Sb. se postupuje obdobně."
  ];
  assert.deepEqual(actsFromBillParagraphs(paragraphs), ["218/2000", "23/2017"].sort((a, b) => Number(a.split("/")[1]) - Number(b.split("/")[1])));
});

test("builds sorted legal identifiers and marks the state budget", () => {
  assert.equal(actIdentifier("23/2017"), "cz-act-23-2017");
  assert.deepEqual(printIdentifiers({ kindId: "1", titleActs: ["23/2017"], textActs: ["218/2000", "23/2017"] }), ["cz-act-218-2000", "cz-act-23-2017"]);
  assert.deepEqual(printIdentifiers({ kindId: "3" }), ["cz-print-kind-state-budget"]);
});

test("validates the print-acts cache", () => {
  const cache = emptyPrintActsCache();
  cache.prints["43200"] = { printNumber: 90, documents: [{ filename: "t009000.docx", contentHash: "a".repeat(64) }], textActs: [{ act: "23/2017", name: "o pravidlech rozpočtové odpovědnosti" }] };
  assert.equal(validatePrintActsCache(cache), cache);
  cache.prints["43200"].textActs = [{ act: "zákon 23", name: null }];
  assert.throws(() => validatePrintActsCache(cache), /invalid textActs/);
});

test("a vote on a print amending a mapped act links directly to promises holding the tag", () => {
  const record = { id: "psp--vote-88416", payload: { linkedPrints: [{ externalPrintId: "43200" }] } };
  const directIdIndex = new Map([["cz-act-23-2017", ["fiscal-rules"]]]);
  const invertedIndex = new Map([["fiscal-rules", new Set(["candidate-d5359e35a4c4"])]]);
  const printIdentifiersById = { 43200: { identifiers: ["cz-act-218-2000", "cz-act-23-2017"] } };
  assert.deepEqual(deriveDirectLink({ record, directIdIndex, invertedIndex, printIdentifiers: printIdentifiersById }), {
    promiseIds: ["candidate-d5359e35a4c4"],
    reason: "matched-legal-identifiers:cz-act-23-2017"
  });
  assert.equal(deriveDirectLink({ record: { id: "other", payload: {} }, directIdIndex, invertedIndex, printIdentifiers: printIdentifiersById }), null);
});

test("keeps the official names of amended acts for the tagging brief", () => {
  assert.deepEqual(namedActsFromBillParagraphs([
    "Zákon č. 23/2017 Sb., o pravidlech rozpočtové odpovědnosti, ve znění zákona č. 277/2019 Sb., se mění takto:",
    "V zákoně č. 218/2000 Sb., o rozpočtových pravidlech, ve znění pozdějších předpisů, se v § 24 …"
  ]), [
    { act: "218/2000", name: "o rozpočtových pravidlech" },
    { act: "23/2017", name: "o pravidlech rozpočtové odpovědnosti" }
  ]);
  assert.deepEqual(namedActsFromPrintTitle("Návrh poslance na vydání zákona, kterým se mění zákon č. 245/2000 Sb., o státních svátcích, o ostatních svátcích, ve znění pozdějších předpisů"), [
    { act: "245/2000", name: "o státních svátcích, o ostatních svátcích" }
  ]);
  assert.equal(
    amendedActsExcerpt([{ act: "23/2017", name: "o pravidlech rozpočtové odpovědnosti" }, { act: "1/1993", name: null }]),
    "Acts amended by the concerned parliamentary print: zákon č. 23/2017 Sb., o pravidlech rozpočtové odpovědnosti; zákon č. 1/1993 Sb."
  );
  assert.equal(amendedActsExcerpt([]), null);
});

test("a print title yields every act it amends or repeals, and no act cited only inside another act's name or history", () => {
  // Official titles of 10th-term prints 231, 153, 88, 62, and 36 (psp.cz tisky.unl).
  assert.deepEqual(actsFromPrintTitle("Vládní návrh zákona, kterým se mění zákon č. 483/1991 Sb., o České televizi, ve znění pozdějších předpisů, a zákon č. 484/1991 Sb., o Českém rozhlasu, ve znění pozdějších předpisů, a kterým se zrušuje zákon č. 348/2005 Sb., o rozhlasových a televizních poplatcích a o změně některých zákonů, ve znění pozdějších předpisů"), ["483/1991", "484/1991", "348/2005"]);
  assert.deepEqual(namedActsFromPrintTitle("Vládní návrh zákona, kterým se mění zákon č. 40/1995 Sb., o regulaci reklamy a o změně a doplnění zákona č. 468/1991 Sb., o provozování rozhlasového a televizního vysílání, ve znění pozdějších předpisů, ve znění pozdějších předpisů, a zákon č. 375/2022 Sb., o zdravotnických prostředcích a diagnostických zdravotnických prostředcích in vitro, ve znění pozdějších předpisů"), [
    { act: "40/1995", name: "o regulaci reklamy" },
    { act: "375/2022", name: "o zdravotnických prostředcích a diagnostických zdravotnických prostředcích in vitro" }
  ]);
  assert.deepEqual(actsFromPrintTitle("Návrh poslance Aleše Juchelky na vydání zákona, kterým se mění zákon č. 151/2025 Sb., o dávce státní sociální pomoci, ve znění zákona č. 360/2025 Sb., zákon č. 110/2006 Sb., o životním a existenčním minimu, ve znění pozdějších předpisů, a další související zákony"), ["110/2006", "151/2025"]);
  assert.deepEqual(actsFromPrintTitle("Vládní návrh zákona o některých povinnostech souvisejících s opravou výrobku a o změně zákona č. 634/1992 Sb., o ochraně spotřebitele, ve znění pozdějších předpisů"), ["634/1992"]);
  assert.deepEqual(namedActsFromPrintTitle("Návrh poslankyň Barbory Urbanové a Adriany Chochelové na vydání zákona, kterým se mění zákon č. 268/2025 Sb., kterým se mění zákon č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů, a další související zákony"), [
    { act: "268/2025", name: "kterým se mění zákon č. 89/2012 Sb., občanský zákoník" }
  ]);
});
