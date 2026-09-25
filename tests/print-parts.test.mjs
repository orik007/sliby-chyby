import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  actIdentifier,
  amendedActOfPart,
  laterTextDocxLink,
  laterTextLinks,
  lawChangesOfPrint,
  namedActsFromPrintTitle,
  proposalBody,
  proposalDocumentLink,
  splitProposalText
} from "../scripts/lib/print-parts.mjs";

// Paragraphs of the official DOCX proposal texts of 10th-term prints 85 (a
// member bill) and 163 (a government bill), the file tables of the psp.cz
// pages of prints 16 and 91, the later-text links of print 77's history
// page, and print 16's approved-text page, downloaded on 24-25 September
// 2026.
const fixture = (name) => readFile(new URL(`./fixtures/print-parts/${name}`, import.meta.url), "utf8");
const print85Paragraphs = JSON.parse(await fixture("print-85-paragraphs.json"));
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
  const body = proposalBody(print85Paragraphs);
  assert.equal(body.at(-1), "Tento zákon nabývá účinnosti dnem 30. dubna 2026.");
  assert.equal(body.some((paragraph) => /^Důvodová zpráva$/i.test(paragraph)), false);
  const parts = splitProposalText(print85Paragraphs);
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
  const parts = splitProposalText(print85Paragraphs);
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

const document = { filename: "t008500.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=266983" };
const print85 = { printId: "44085", number: 85, kindId: "2", title: "Novela z. o životním a existenčním minimu", pageUrl: pageUrl(85) };

test("each part of a print is one law change with its full text, acts, and identifiers", () => {
  const changes = lawChangesOfPrint({ print: print85, texts: { proposed: { document, paragraphs: proposalBody(print85Paragraphs) } } });
  assert.deepEqual(changes.map(({ changeId, identifiers, addedIn }) => [changeId, identifiers, addedIn]), [
    ["44085-1", ["cz-act-110-2006"], "proposed"],
    ["44085-2", ["cz-act-108-2006"], "proposed"],
    ["44085-3", ["cz-act-152-2025"], "proposed"],
    ["44085-4", [], "proposed"]
  ]);
  assert.match(changes[0].versions.proposed.textCz, /^ČÁST PRVNÍ\nZměna zákona o životním a existenčním minimu\nČl\. I\n/);
  assert.equal(changes[3].versions.proposed.textCz, "ČÁST ČTVRTÁ\núčinnost\nČl. IV\nTento zákon nabývá účinnosti dnem 30. dubna 2026.");
  assert.equal(changes[0].printPageUrl, pageUrl(85));
  assert.equal(changes[0].versions.proposed.document.filename, "t008500.docx");
  assert.deepEqual(Object.keys(changes[0].versions), ["proposed"]);
  assert.deepEqual(changes[0].senateResolutions, []);
});

test("later texts are matched to the proposed parts; added and removed parts are kept apart", () => {
  const proposed = proposalBody(print85Paragraphs);
  // The approved text drops part two, changes part one, and adds a part
  // amending another act.
  const approved = [
    ...proposed.slice(0, proposed.indexOf("ČÁST DRUHÁ")),
    "ČÁST DRUHÁ",
    "Změna zákona o státní sociální podpoře",
    "Čl. II",
    "V § 5 zákona č. 117/1995 Sb., o státní sociální podpoře, se číslo „3“ nahrazuje číslem „4“.",
    ...proposed.slice(proposed.indexOf("ČÁST TŘETÍ"))
  ].map((paragraph) => paragraph === "„12. příjmu plynoucího z dávky státní sociální pomoci,“." ? "„12. příjmu z dávky státní sociální pomoci,“." : paragraph);
  const changes = lawChangesOfPrint({
    print: print85,
    texts: { proposed: { document, paragraphs: proposed }, approved: { document: { filename: "approved text of print 85", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=1" }, paragraphs: approved } },
    senateResolutions: [{ partNumber: 2, document: { filename: "t008502.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=2" }, paragraphs: ["USNESENÍ SENÁTU", "V čl. I bodu 1 …"] }]
  });
  const byTitle = Object.fromEntries(changes.map((change) => [change.titleCz, change]));
  const minimum = byTitle["Změna zákona o životním a existenčním minimu"];
  assert.equal(minimum.changeId, "44085-1");
  assert.notEqual(minimum.versions.proposed.textCz, minimum.versions.approved.textCz);
  assert.deepEqual(byTitle["Změna zákona o sociálních službách"].versions.approved, { removed: true });
  const added = byTitle["Změna zákona o státní sociální podpoře"];
  assert.equal(added.addedIn, "approved");
  assert.equal(added.changeId, "44085-approved-2");
  assert.deepEqual(Object.keys(added.versions), ["approved"]);
  assert.deepEqual(added.identifiers, ["cz-act-117-1995"]);
  assert.equal(minimum.senateResolutions[0].textCz, "USNESENÍ SENÁTU\nV čl. I bodu 1 …");
});

test("without a proposal text, the parts of the first later text are the law changes, proposed by title only", () => {
  const title = "Vládní návrh zákona, kterým se mění zákon č. 375/2022 Sb., o zdravotnických prostředcích, ve znění pozdějších předpisů";
  const print = { printId: "1", number: 57, kindId: "1", title, pageUrl: pageUrl(57) };
  const [titleOnly] = lawChangesOfPrint({ print });
  assert.equal(titleOnly.versions.proposed.textCz, null);
  assert.equal(titleOnly.titleCz, title);
  assert.deepEqual(titleOnly.identifiers, ["cz-act-375-2022"]);
  const withApproved = lawChangesOfPrint({ print, texts: { approved: { document, paragraphs: proposalBody(print85Paragraphs) } } });
  assert.equal(withApproved.length, 4);
  assert.deepEqual(withApproved.map(({ addedIn }) => addedIn), ["proposed", "proposed", "proposed", "proposed"]);
  assert.equal(withApproved[0].changeId, "1-1");
  assert.equal(withApproved[0].versions.proposed.textCz, null);
  assert.match(withApproved[0].versions.approved.textCz, /^ČÁST PRVNÍ/);
  const [budget] = lawChangesOfPrint({ print: { printId: "2", number: 94, kindId: "3", title: "Vládní návrh zákona o státním rozpočtu České republiky na rok 2026", pageUrl: pageUrl(94) }, texts: { proposed: { document, paragraphs: ["§ 1", "Celkové příjmy státního rozpočtu se stanoví částkou 2 360 miliard Kč."] } } });
  assert.deepEqual(budget.identifiers, ["cz-print-kind-state-budget"]);
});

test("reads the later-text links from a print's history page and the DOCX of a later-text page", async () => {
  const historyUrl = "https://www.psp.cz/sqw/historie.sqw?o=10&t=77";
  assert.deepEqual(laterTextLinks(await fixture("print-77-history-status.html"), historyUrl), {
    approved: "https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=77&ct1=0&v=PZ&pn=4&pt=1",
    passed: "https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=77&ct1=0&v=SZ"
  });
  assert.deepEqual(laterTextLinks("<p>No later text.</p>", historyUrl), { approved: null, passed: null });
  // The link is found by its text-page kind, not by the surrounding markup.
  assert.equal(laterTextLinks('<div><a title="Schválený text" class="x" href="/sqw/text/tiskt.sqw?o=10&amp;ct=5&amp;ct1=0&amp;v=PZ&amp;pn=2&amp;pt=1">text</a></div>', historyUrl).approved, "https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=5&ct1=0&v=PZ&pn=2&pt=1");
  assert.throws(() => laterTextLinks('<a href="https://evil.example/sqw/text/tiskt.sqw?v=SZ">x</a>', historyUrl), /outside the PSP allowlist/);
  assert.equal(laterTextDocxLink(await fixture("print-16-approved-text.html"), "https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=16&ct1=0&v=PZ&pn=2&pt=1"), "https://www.psp.cz/sqw/text/orig2.sqw?idd=278470");
  assert.equal(laterTextDocxLink("<h1>Dokument nebyl nalezen.</h1>", historyUrl), null);
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

test("a part is matched across versions even when its key changes or two parts amend the same act", () => {
  const print = { printId: "9", number: 9, kindId: "1", title: "Vládní návrh zákona o podpoře bydlení", pageUrl: pageUrl(9) };
  const doc = { filename: "t.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=9" };
  const law = ["ZÁKON", "o podpoře bydlení", "§ 1", "Stát poskytuje příspěvek na bydlení domácnostem s nízkými příjmy ve výši 5000 Kč měsíčně."];
  // A proposal without parts that the debate divided into parts.
  const divided = lawChangesOfPrint({ print, texts: {
    proposed: { document: doc, paragraphs: law },
    approved: { document: doc, paragraphs: ["ČÁST PRVNÍ", "Podpora bydlení", ...law.slice(2), "ČÁST DRUHÁ", "Změna zákona o daních z příjmů", "V § 4 zákona č. 586/1992 Sb., o daních z příjmů, se doplňuje písmeno z), které zní: „z) příspěvek na bydlení,“."] }
  } });
  assert.equal(divided.length, 2);
  assert.equal(divided[0].changeId, "9-1");
  assert.match(divided[0].versions.approved.textCz, /5000 Kč/);
  assert.equal(divided[1].addedIn, "approved");

  // Two parts amend the same act; the debate removes the first.
  const vat = (heading, rate) => [heading, "Změna zákona o dani z přidané hodnoty", `V § 47 zákona č. 235/2004 Sb., o dani z přidané hodnoty, se sazba ${rate} % nahrazuje sazbou ${rate - 1} % pro potraviny a nápoje.`];
  const same = lawChangesOfPrint({ print, texts: {
    proposed: { document: doc, paragraphs: [...vat("ČÁST PRVNÍ", 21), ...vat("ČÁST DRUHÁ", 15)] },
    approved: { document: doc, paragraphs: vat("ČÁST PRVNÍ", 15) }
  } });
  assert.deepEqual(same[0].versions.approved, { removed: true });
  // The surviving part was only renumbered, so its text is stored once, and
  // it is named by its heading in the approved text.
  assert.equal(same[1].versions.approved.sameAs, "proposed");
  assert.equal(same[1].heading, "ČÁST PRVNÍ");
  assert.match(same[1].versions.proposed.textCz, /sazba 15 %/);

  // A part retitled in the debate stays the same law change.
  const retitled = lawChangesOfPrint({ print, texts: {
    proposed: { document: doc, paragraphs: ["ČÁST PRVNÍ", "Účinnost", "Tento zákon nabývá účinnosti prvním dnem kalendářního měsíce následujícího po dni jeho vyhlášení."] },
    approved: { document: doc, paragraphs: ["ČÁST PRVNÍ", "Přechodné ustanovení a účinnost", "Tento zákon nabývá účinnosti prvním dnem druhého kalendářního měsíce následujícího po dni jeho vyhlášení."] }
  } });
  assert.equal(retitled.length, 1);
  assert.equal(retitled[0].titleCz, "Přechodné ustanovení a účinnost");
  assert.equal(retitled[0].addedIn, "proposed");
});

test("a later version with the same text is stored as the same, not repeated", () => {
  const paragraphs = proposalBody(print85Paragraphs);
  const changes = lawChangesOfPrint({ print: print85, texts: { proposed: { document, paragraphs }, approved: { document, paragraphs }, passed: { document, paragraphs } } });
  assert.deepEqual(changes[0].versions.approved, { sameAs: "proposed", heading: "ČÁST PRVNÍ", titleCz: "Změna zákona o životním a existenčním minimu", document: { filename: document.filename, url: document.url } });
  assert.equal(changes[0].versions.passed.sameAs, "proposed");
  assert.equal(changes[0].titleCz, "Změna zákona o životním a existenčním minimu");
});
