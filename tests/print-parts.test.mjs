import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  actIdentifier,
  amendedActOfPart,
  lawChangesOfPrint,
  namedActsFromPrintTitle,
  proposalBody,
  proposalDocumentLink,
  splitProposalText
} from "../scripts/lib/print-parts.mjs";

// Paragraphs of the official DOCX proposal texts of 10th-term prints 85 (a
// member bill) and 163 (a government bill), and the file tables of the
// psp.cz pages of prints 16 and 91, downloaded on 24 September 2026.
const fixture = (name) => readFile(new URL(`./fixtures/print-parts/${name}`, import.meta.url), "utf8");
const print85 = JSON.parse(await fixture("print-85-paragraphs.json"));
const print163 = JSON.parse(await fixture("print-163-paragraphs.json"));
const pageUrl = (number) => `https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=${number}&CT1=0`;

test("reads only the proposal-text DOCX from a print page", async () => {
  // Print 16 also lists the RIA, the consolidated text with marked changes,
  // and EU compatibility; only the bill itself is the proposal text.
  assert.deepEqual(proposalDocumentLink(await fixture("print-16-files.html"), pageUrl(16)), {
    filename: "t001600.docx",
    url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=265179",
    sectionLabel: "Návrh zákona včetně důvodové zprávy"
  });
  // Print 91 (a state fund budget) has its resolution only as a legacy .doc;
  // its text is the DOCX of the section "Text".
  const print91 = proposalDocumentLink(await fixture("print-91-files.html"), pageUrl(91));
  assert.equal(print91.filename, "t0091a0.docx");
  assert.equal(print91.sectionLabel, "Text");
  assert.equal(proposalDocumentLink("<p>Soubory sněmovního tisku</p><table><tr><th>Důvodová zpráva</th></tr><tr><td><a href=\"/sqw/text/orig2.sqw?idd=1\">t0001a0.docx</a></td></tr></table>", pageUrl(1)), null);
  assert.throws(() => proposalDocumentLink("Soubory sněmovního tisku<table><tr><th>Text</th></tr><tr><td><a href=\"https://other.example/orig2.sqw?idd=1\">t.docx</a></td></tr></table>", pageUrl(1)), /outside the PSP allowlist/);
});

test("cuts the explanatory memorandum and splits a bill into its parts", () => {
  const body = proposalBody(print85);
  assert.equal(body.at(-1), "Tento zákon nabývá účinnosti dnem 30. dubna 2026.");
  assert.equal(body.some((paragraph) => /^Důvodová zpráva$/i.test(paragraph)), false);
  const parts = splitProposalText(print85);
  assert.deepEqual(parts.map(({ heading, titleCz }) => [heading, titleCz]), [
    ["ČÁST PRVNÍ", "Změna zákona o životním a existenčním minimu"],
    ["ČÁST DRUHÁ", "Změna zákona o sociálních službách"],
    ["ČÁST TŘETÍ", "Změna zákona č. 152/2025 Sb."],
    ["ČÁST ČTVRTÁ", "účinnost"]
  ]);
  // Print 163 writes one heading as "ČÁST DRUhÁ" and ends at "DŮVODOVÁ ZPRÁVA".
  assert.deepEqual(splitProposalText(print163).map(({ heading }) => heading), ["ČÁST PRVNÍ", "ČÁST DRUhÁ", "ČÁST TŘETÍ"]);
  assert.deepEqual(splitProposalText(["Zákon č. 1/2000 Sb. se mění takto:", "V § 1 se slovo „a“ zrušuje."]).map(({ heading }) => heading), [null]);
});

test("finds the act each part amends from its first amending sentence", () => {
  const parts = splitProposalText(print85);
  // "V § 7 odst. 2 písm. h) zákona č. 110/2006 Sb., …, se … doplňuje"
  assert.deepEqual(amendedActOfPart(parts[0].paragraphs), { act: "110/2006", name: "o životním a existenčním minimu" });
  // "…, se část věty za středníkem včetně středníku zrušuje."
  assert.equal(amendedActOfPart(parts[1].paragraphs).act, "108/2006");
  assert.equal(amendedActOfPart(parts[2].paragraphs).act, "152/2025");
  assert.equal(amendedActOfPart(parts[3].paragraphs), null);
  // Print 163's first part creates new provisions and amends no act.
  const print163Parts = splitProposalText(print163);
  assert.equal(amendedActOfPart(print163Parts[0].paragraphs), null);
  assert.deepEqual(amendedActOfPart(print163Parts[1].paragraphs), { act: "526/1990", name: "o cenách" });
  assert.equal(amendedActOfPart(["Příloha k zákonu č. 634/2004 Sb., o správních poplatcích, ve znění zákona č. 217/2005 Sb., se mění takto:"]).act, "634/2004");
  assert.equal(amendedActOfPart(["Podle zákona č. 159/2006 Sb. postupuje ministerstvo."]), null);
});

test("each part of a print is one law change with its full text, acts, and identifiers", () => {
  const print = { printId: "44085", number: 85, kindId: "2", title: "Novela z. o životním a existenčním minimu", pageUrl: pageUrl(85) };
  const document = { filename: "t008500.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=266983", sectionLabel: "Návrh zákona včetně důvodové zprávy" };
  const changes = lawChangesOfPrint({ print, document, paragraphs: proposalBody(print85) });
  assert.deepEqual(changes.map(({ changeId, identifiers }) => [changeId, identifiers]), [
    ["44085-1", ["cz-act-110-2006"]],
    ["44085-2", ["cz-act-108-2006"]],
    ["44085-3", ["cz-act-152-2025"]],
    ["44085-4", []]
  ]);
  assert.match(changes[0].textCz, /^ČÁST PRVNÍ\nZměna zákona o životním a existenčním minimu\nČl\. I\n/);
  assert.equal(changes[3].textCz, "ČÁST ČTVRTÁ\núčinnost\nČl. IV\nTento zákon nabývá účinnosti dnem 30. dubna 2026.");
  assert.equal(changes[0].printPageUrl, pageUrl(85));
  assert.equal(changes[0].document.filename, "t008500.docx");
});

test("a print without a DOCX text is one law change with its title's acts; a state budget carries its identifier", () => {
  const title = "Vládní návrh zákona, kterým se mění zákon č. 375/2022 Sb., o zdravotnických prostředcích, ve znění pozdějších předpisů";
  const [change] = lawChangesOfPrint({ print: { printId: "1", number: 57, kindId: "1", title, pageUrl: pageUrl(57) } });
  assert.equal(change.textCz, null);
  assert.equal(change.titleCz, title);
  assert.deepEqual(change.identifiers, ["cz-act-375-2022"]);
  const [budget] = lawChangesOfPrint({ print: { printId: "2", number: 94, kindId: "3", title: "Vládní návrh zákona o státním rozpočtu České republiky na rok 2026", pageUrl: pageUrl(94) }, document: { filename: "t009400.docx", url: "https://www.psp.cz/x", sectionLabel: "Návrh zákona včetně důvodové zprávy" }, paragraphs: ["§ 1", "Celkové příjmy státního rozpočtu se stanoví částkou 2 360 miliard Kč."] });
  assert.deepEqual(budget.identifiers, ["cz-print-kind-state-budget"]);
});

test("reads the acts a print title names, and no act cited only inside another act's name or history", () => {
  assert.equal(actIdentifier("23/2017"), "cz-act-23-2017");
  const acts = (title) => namedActsFromPrintTitle(title).map(({ act }) => act);
  assert.deepEqual(acts("Vládní návrh zákona, kterým se mění některé zákony v oblasti veřejných rozpočtů"), []);
  // Official titles of 10th-term prints 231, 153, 88, 62, and 36 (psp.cz tisky.unl).
  assert.deepEqual(acts("Vládní návrh zákona, kterým se mění zákon č. 483/1991 Sb., o České televizi, ve znění pozdějších předpisů, a zákon č. 484/1991 Sb., o Českém rozhlasu, ve znění pozdějších předpisů, a kterým se zrušuje zákon č. 348/2005 Sb., o rozhlasových a televizních poplatcích a o změně některých zákonů, ve znění pozdějších předpisů"), ["483/1991", "484/1991", "348/2005"]);
  assert.deepEqual(namedActsFromPrintTitle("Vládní návrh zákona, kterým se mění zákon č. 40/1995 Sb., o regulaci reklamy a o změně a doplnění zákona č. 468/1991 Sb., o provozování rozhlasového a televizního vysílání, ve znění pozdějších předpisů, ve znění pozdějších předpisů, a zákon č. 375/2022 Sb., o zdravotnických prostředcích a diagnostických zdravotnických prostředcích in vitro, ve znění pozdějších předpisů"), [
    { act: "40/1995", name: "o regulaci reklamy" },
    { act: "375/2022", name: "o zdravotnických prostředcích a diagnostických zdravotnických prostředcích in vitro" }
  ]);
  assert.deepEqual(acts("Návrh poslance Aleše Juchelky na vydání zákona, kterým se mění zákon č. 151/2025 Sb., o dávce státní sociální pomoci, ve znění zákona č. 360/2025 Sb., zákon č. 110/2006 Sb., o životním a existenčním minimu, ve znění pozdějších předpisů, a další související zákony"), ["110/2006", "151/2025"]);
  assert.deepEqual(acts("Vládní návrh zákona o některých povinnostech souvisejících s opravou výrobku a o změně zákona č. 634/1992 Sb., o ochraně spotřebitele, ve znění pozdějších předpisů"), ["634/1992"]);
  assert.deepEqual(namedActsFromPrintTitle("Návrh poslankyň Barbory Urbanové a Adriany Chochelové na vydání zákona, kterým se mění zákon č. 268/2025 Sb., kterým se mění zákon č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů, a další související zákony"), [
    { act: "268/2025", name: "kterým se mění zákon č. 89/2012 Sb., občanský zákoník" }
  ]);
});
