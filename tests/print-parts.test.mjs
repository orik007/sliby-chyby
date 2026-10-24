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
  promulgatedActOfHistory,
  promulgatedParagraphs,
  promulgatedTextUrl,
  promulgatedTextVersions,
  proposalBody,
  governmentOpinionSectionLabels,
  proposalDocumentLink,
  splitProposalText,
  splitTreatyText,
  changeThroughVersion,
  collectPrints,
  versionOfChange
} from "../scripts/lib/print-parts.mjs";
import { lawChangeText } from "../scripts/lib/law-change-screening.mjs";

// Paragraphs of the official DOCX proposal texts of 10th-term prints 85 (a
// member bill) and 163 (a government bill), the file tables of the psp.cz
// pages of prints 16 and 91, the later-text links of print 77's history
// page, and print 16's approved-text page, downloaded on 24-25 September
// 2026; the file tables of prints 57 and 87 and the Senate referral in
// print 163's history, downloaded on 26 September 2026; the line that ends
// print 90's history and the e-Sbírka nodes of 155/2026 Sb. as promulgated
// (its heading, first and last part, and signatures) and of 166/2026 Sb.
// (still being digitised), read on 5 October 2026.
const fixture = (name) => readFile(new URL(`./fixtures/print-parts/${name}`, import.meta.url), "utf8");
const print85Paragraphs = JSON.parse(await fixture("print-85-paragraphs.json"));
const print163 = JSON.parse(await fixture("print-163-paragraphs.json"));
const pageUrl = (number) => `https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=${number}&CT1=0`;

test("reads a government opinion's Word file from its \"Stanovisko\" section, and only for an opinion", async () => {
  // The file table of sub-print 7/1, the government's opinion on member bill
  // 7, downloaded on 15 October 2026: a PDF and a DOC under "Stanovisko".
  const page = await fixture("print-7-1-files.html");
  const url = "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=7&CT1=1";
  assert.deepEqual(proposalDocumentLink(page, url, governmentOpinionSectionLabels), {
    filename: "t000701.doc",
    url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=265860",
    sectionLabel: "Stanovisko",
    format: "doc"
  });
  assert.equal(proposalDocumentLink(page, url), null, "a proposal text is never read from an opinion's section");
});

test("reads only the proposal-text Word file from a print page, a DOCX before a DOC", async () => {
  // Print 16 also lists the RIA, the consolidated text with marked changes,
  // and EU compatibility; only the bill itself is the proposal text.
  assert.deepEqual(proposalDocumentLink(await fixture("print-16-files.html"), pageUrl(16)), {
    filename: "t001600.docx",
    url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=265179",
    sectionLabel: "Návrh zákona včetně důvodové zprávy",
    format: "docx"
  });
  // Print 57 lists its bill only as PDF and .doc; the .doc is read.
  assert.deepEqual(proposalDocumentLink(await fixture("print-57-files.html"), pageUrl(57)), {
    filename: "t005700.doc",
    url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=266020",
    sectionLabel: "Návrh zákona včetně důvodové zprávy",
    format: "doc"
  });
  // Print 87 lists its bill only as PDF, which is never read; the DOCX files
  // of other sections are not the proposal text.
  assert.equal(proposalDocumentLink(await fixture("print-87-files.html"), pageUrl(87)), null);
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
    ["44085-3", ["cz-act-152-2025"], "proposed"]
  ]);
  assert.match(changes[0].versions.proposed.textCz, /^ČÁST PRVNÍ\nZměna zákona o životním a existenčním minimu\nČl\. I\n/);
  // Part four ("účinnost") is not a law change; its text is every change's
  // effective date.
  for (const change of changes) assert.equal(change.versions.proposed.effectiveCz, "Čl. IV\nTento zákon nabývá účinnosti dnem 30. dubna 2026.");
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
  assert.equal(withApproved.length, 3);
  assert.deepEqual(withApproved.map(({ addedIn }) => addedIn), ["proposed", "proposed", "proposed"]);
  assert.equal(withApproved[0].versions.proposed.effectiveCz, null);
  assert.match(withApproved[0].versions.approved.effectiveCz, /dnem 30\. dubna 2026/);
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
    passed: "https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=77&ct1=0&v=SZ",
    referredToSenate: null
  });
  assert.deepEqual(laterTextLinks("<p>No later text.</p>", historyUrl), { approved: null, passed: null, referredToSenate: null });
  // Print 163, which the Senate rejected, has no approved-text page; its
  // history links sub-print 163/2 with the text referred to the Senate, and
  // then the Senate's document 163/3.
  assert.deepEqual(laterTextLinks(await fixture("print-163-history-senate.html"), "https://www.psp.cz/sqw/historie.sqw?o=10&t=163"), {
    approved: null,
    passed: null,
    referredToSenate: "https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=163&ct1=2"
  });
  // An entry without its own link never takes the link of the next entry,
  // such as the Senate's document.
  assert.equal(laterTextLinks('<p>Návrh zákona ve znění, ve kterém byl postoupen Senátu, doručen Senátu.<br>Dokument Senátu rozeslán jako tisk <B><a href="/sqw/text/tiskt.sqw?o=10&ct=163&ct1=3">163/3</a></B>.</p>', historyUrl).referredToSenate, null);
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
    proposed: { document: doc, paragraphs: ["ČÁST PRVNÍ", "Přechodné ustanovení", "Řízení zahájená přede dnem nabytí účinnosti tohoto zákona se dokončí podle dosavadních právních předpisů."] },
    approved: { document: doc, paragraphs: ["ČÁST PRVNÍ", "Přechodná ustanovení", "Řízení zahájená přede dnem nabytí účinnosti tohoto zákona se dokončí podle dosavadních právních předpisů.", "Lhůty běžící přede dnem nabytí účinnosti tohoto zákona se posuzují podle dosavadních právních předpisů."] }
  } });
  assert.equal(retitled.length, 1);
  assert.equal(retitled[0].titleCz, "Přechodná ustanovení");
  assert.equal(retitled[0].addedIn, "proposed");
});

test("a later version with the same text is stored as the same, not repeated", () => {
  const paragraphs = proposalBody(print85Paragraphs);
  const changes = lawChangesOfPrint({ print: print85, texts: { proposed: { document, paragraphs }, approved: { document, paragraphs }, passed: { document, paragraphs } } });
  assert.deepEqual(changes[0].versions.approved, { sameAs: "proposed", heading: "ČÁST PRVNÍ", titleCz: "Změna zákona o životním a existenčním minimu", amendedAct: { act: "110/2006", name: "o životním a existenčním minimu" }, effectiveCz: "Čl. IV\nTento zákon nabývá účinnosti dnem 30. dubna 2026.", document: { filename: document.filename, url: document.url } });
  assert.equal(changes[0].versions.passed.sameAs, "proposed");
  assert.equal(changes[0].titleCz, "Změna zákona o životním a existenčním minimu");
});

test("the effective-date part is no law change; its text goes with every version of every change", () => {
  // The effective-date wording of print 13's proposed and approved texts on
  // psp.cz (run 56); the amending part is a made-up one that the debate
  // left unchanged.
  const print = { printId: "43120", number: 13, kindId: "1", title: "Vládní návrh zákona", pageUrl: pageUrl(13) };
  const doc = { filename: "t.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=1" };
  const partOne = ["ČÁST PRVNÍ", "Změna zákona o daních z příjmů", "Čl. I", "V § 4 zákona č. 586/1992 Sb., o daních z příjmů, se číslo „3“ nahrazuje číslem „4“."];
  const effective = (text) => ["ČÁST DRUHÁ", "ÚČINNOST", "Čl. VIII", text];
  const proposedDate = "Tento zákon nabývá účinnosti dnem 16. dubna 2026, s výjimkou ustanovení čl. I bodů 106, 107, 109, 111 až 114 a 158 až 160, která nabývají účinnosti dnem 16. dubna 2027.";
  const approvedDate = "Tento zákon nabývá účinnosti prvním dnem druhého kalendářního měsíce následujícího po jeho vyhlášení, s výjimkou ustanovení čl. I bodů 107, 108, 110, 112 až 115 a 160 až 162, která nabývají účinnosti dnem 16. dubna 2027.";
  const changes = lawChangesOfPrint({ print, texts: {
    proposed: { document: doc, paragraphs: [...partOne, ...effective(proposedDate)] },
    approved: { document: doc, paragraphs: [...partOne, ...effective(approvedDate)] }
  } });
  assert.deepEqual(changes.map(({ changeId }) => changeId), ["43120-1"]);
  const [change] = changes;
  assert.equal(change.versions.proposed.effectiveCz, `Čl. VIII\n${proposedDate}`);
  // The text is the same, so it is stored once; the effective date is the
  // version's own.
  assert.equal(change.versions.approved.sameAs, "proposed");
  assert.equal(change.versions.approved.effectiveCz, `Čl. VIII\n${approvedDate}`);
  const text = lawChangeText(change);
  assert.ok(text.includes(`Version: text approved by the Chamber\nThe same text as the proposed text.\nEffective date of this text (účinnost):\nČl. VIII\n${approvedDate}`));
  assert.ok(text.includes(`Effective date of this text (účinnost):\nČl. VIII\n${proposedDate}`));
  assert.doesNotMatch(text, /Part: ČÁST DRUHÁ/);
  // An unchanged effective date is named, not repeated.
  const unchanged = lawChangeText(lawChangesOfPrint({ print, texts: {
    proposed: { document: doc, paragraphs: [...partOne, ...effective(proposedDate)] },
    approved: { document: doc, paragraphs: [...partOne, ...effective(proposedDate)] }
  } })[0]);
  assert.equal(unchanged.split(proposedDate).length, 2);
  assert.match(unchanged, /The same text as the proposed text\.\nEffective date of this text \(účinnost\): the same as in the proposed text\./);

  // A part after the effective-date part keeps its position in the change ID.
  const [later] = lawChangesOfPrint({ print, texts: { proposed: { document: doc, paragraphs: [...effective(proposedDate).map((paragraph) => paragraph === "ČÁST DRUHÁ" ? "ČÁST PRVNÍ" : paragraph), ...partOne.map((paragraph) => paragraph === "ČÁST PRVNÍ" ? "ČÁST DRUHÁ" : paragraph)] } } });
  assert.equal(later.changeId, "43120-2");
  assert.equal(later.versions.proposed.effectiveCz, `Čl. VIII\n${proposedDate}`);
});

test("a part heading after 100 starts with \"sto\"; other text is no heading", () => {
  const parts = splitProposalText(["ČÁST STO DVACÁTÁ", "Změna zákona o daních z příjmů", "Text.", "ČÁST STO DVACÁTÁ PRVNÍ", "Účinnost", "Část čtvrtá a pátá", "ČÁST I", "Text."]);
  assert.deepEqual(parts.map(({ heading }) => heading), ["ČÁST STO DVACÁTÁ", "ČÁST STO DVACÁTÁ PRVNÍ"]);
});

test("a text without a part heading is compared whole, so a changed first paragraph is a new version", () => {
  const print = { ...print85, title: "Návrh zákona o podpoře bydlení" };
  const proposed = ["Zákon o podpoře bydlení", "§ 1 Příspěvek činí 1 000 Kč.", "§ 2 Účinnost."];
  const approved = ["Zákon o podpoře bydlení a o změně souvisejících zákonů", "§ 1 Příspěvek činí 1 000 Kč.", "§ 2 Účinnost."];
  const [change] = lawChangesOfPrint({ print, texts: { proposed: { document, paragraphs: proposed }, approved: { document, paragraphs: approved } } });
  assert.equal(change.versions.approved.sameAs, undefined);
  assert.match(change.versions.approved.textCz, /o změně souvisejících zákonů/);
});

test("a state budget or a treaty is one law change, even with part headings", () => {
  const paragraphs = ["ČÁST PRVNÍ", "Příjmy", "Text.", "ČÁST DRUHÁ", "Výdaje", "Text."];
  for (const kindId of ["3", "4"]) {
    const changes = lawChangesOfPrint({ print: { ...print85, kindId }, texts: { proposed: { document, paragraphs } } });
    assert.equal(changes.length, 1, `print kind ${kindId}`);
    assert.equal(changes[0].heading, null);
  }
  const budget = lawChangesOfPrint({ print: { ...print85, kindId: "3" }, texts: { proposed: { document, paragraphs } } });
  assert.deepEqual(budget[0].identifiers, ["cz-print-kind-state-budget"]);
});

test("a change through a version keeps only those versions and the acts they amend", () => {
  const act = (number) => `Zákon č. ${number}/2000 Sb., o něčem, se mění takto:`;
  const proposed = ["ČÁST PRVNÍ", "Změna zákona A", act(1), "V § 1 se slovo zrušuje."];
  const approved = ["ČÁST PRVNÍ", "Změna zákona A", act(1), "V § 1 se slovo nahrazuje jiným.", "ČÁST DRUHÁ", "Změna zákona B", act(2), "V § 2 se slovo zrušuje."];
  const [first, added] = lawChangesOfPrint({ print: print85, texts: { proposed: { document, paragraphs: proposed }, approved: { document, paragraphs: approved } } });
  assert.deepEqual(Object.keys(changeThroughVersion(first, "proposed").versions), ["proposed"]);
  assert.deepEqual(changeThroughVersion(first, "proposed").identifiers, ["cz-act-1-2000"]);
  // A change added in the approved text did not exist in the proposal.
  assert.equal(changeThroughVersion(added, "proposed"), null);
  assert.deepEqual(changeThroughVersion(added, "approved").identifiers, ["cz-act-2-2000"]);
});

test("reads the act a bill became from the end of its history page", async () => {
  assert.deepEqual(promulgatedActOfHistory(await fixture("print-90-history-promulgated.html")), { act: "155/2026", promulgatedOn: "2026-08-28" });
  assert.equal(promulgatedActOfHistory("<p>Návrh zákona schválen.</p>"), null);
  assert.equal(promulgatedTextUrl("155/2026"), "https://e-sbirka.gov.cz/sb/2026/155/0000-00-00");
});

test("the promulgated act is the text of every voted version psp.cz does not publish, only where nothing could change it after", () => {
  const promulgation = { act: "155/2026", promulgatedOn: "2026-08-28" };
  const text = { document, paragraphs: ["x"] };
  const vote = (version, extra = {}) => ({ version, withSenateResolution: false, sameAsApproved: false, senateAmendmentsRejected: false, mark: null, ...extra });
  const of = (overrides) => promulgatedTextVersions({ texts: { proposed: text, approved: text }, concerned: [vote("approved")], promulgation, senateReturned: false, passedListed: false, ...overrides });
  // A vote after the President's return concerns the passed text.
  assert.deepEqual(of({ concerned: [vote("approved"), vote("passed")] }), ["passed"]);
  // Approval and a presidential return, neither text published: both are the act.
  assert.deepEqual(of({ texts: { proposed: text }, concerned: [vote("approved"), vote("passed")] }), ["approved", "passed"]);
  // Insisting on the approved text, which psp.cz publishes, needs none.
  assert.deepEqual(of({ concerned: [vote("passed", { sameAsApproved: true, withSenateResolution: true })], senateReturned: true }), []);
  assert.deepEqual(of({ texts: { proposed: text }, concerned: [vote("passed", { sameAsApproved: true, withSenateResolution: true })], senateReturned: true }), ["passed"]);
  // A state budget: approved, never returned.
  assert.deepEqual(of({ texts: { proposed: text } }), ["approved"]);
  // After a Senate return or with a passed text listed, the act may differ from the approved text.
  assert.deepEqual(of({ texts: { proposed: text }, senateReturned: true }), []);
  assert.deepEqual(of({ texts: { proposed: text }, passedListed: true }), []);
  // Rejecting the Senate's amendments concerned a text never promulgated.
  assert.deepEqual(of({ texts: { proposed: text }, concerned: [vote("passed", { withSenateResolution: true, senateAmendmentsRejected: true })], senateReturned: true }), []);
  // A bill that was not promulgated, or whose voted texts psp.cz publishes.
  assert.deepEqual(of({ texts: { proposed: text }, promulgation: null }), []);
  assert.deepEqual(of({}), []);
  assert.deepEqual(of({ concerned: [vote("proposed")] }), []);
});

test("an act as promulgated is split like a psp.cz text and says where it is from", async () => {
  const nodes = JSON.parse(await fixture("promulgated-nodes.json"));
  const paragraphs = promulgatedParagraphs(nodes["155/2026"], "155/2026");
  // Without the act's number at the top and the signatures.
  assert.deepEqual(paragraphs.slice(0, 2), ["ZÁKON", "ze dne 8. července 2026,"]);
  assert.equal(paragraphs.some((paragraph) => /v\. r\.$/.test(paragraph)), false);
  // The act's own annexes are left out.
  assert.deepEqual(promulgatedParagraphs([["dokument/prefix/frag_1", "38"], ["dokument/norma/par_1", "§ 1"], ["dokument/prilohy/priloha_1", "Příloha č. 1"]], "38/2026"), ["§ 1"]);
  // e-Sbírka holds only a notice that the act is being digitised.
  assert.equal(promulgatedParagraphs(nodes["166/2026"], "166/2026"), null);
  const approved = ["ČÁST PRVNÍ", "Změna zákona o Nejvyšším kontrolním úřadu", "Čl. I", "Zákon č. 166/1993 Sb., o Nejvyšším kontrolním úřadu, se mění takto:", "V § 5 odst. 2 se slova nahrazují.", "ČÁST DVANÁCTÁ", "ÚČINNOST", "Čl. XVIII", "Tento zákon nabývá účinnosti."];
  const promulgated = { document: { filename: "Zákon č. 155/2026 Sb. ve vyhlášeném znění (e-Sbírka)", url: promulgatedTextUrl("155/2026") }, paragraphs, promulgatedAct: "155/2026" };
  const [change, ...rest] = lawChangesOfPrint({ print: { ...print85, kindId: "1" }, texts: { proposed: { document, paragraphs: approved }, approved: { document, paragraphs: approved }, passed: promulgated } });
  assert.equal(rest.length, 0);
  assert.equal(change.versions.approved.sameAs, "proposed");
  assert.equal(change.versions.approved.promulgatedAct, undefined);
  assert.equal(change.versions.passed.promulgatedAct, "155/2026");
  assert.equal(change.versions.passed.document.url, "https://e-sbirka.gov.cz/sb/2026/155/0000-00-00");
  assert.match(change.versions.passed.textCz, /^ČÁST PRVNÍ\nZměna zákona o Nejvyšším kontrolním úřadu\nČl\. I\n/);
  // A vote that rejected the Senate's amendments is not judged by the act, which lacks them.
  const vote = (extra) => ({ version: "passed", withSenateResolution: true, sameAsApproved: false, senateAmendmentsRejected: false, mark: null, ...extra });
  assert.deepEqual(versionOfChange(change, vote({ senateAmendmentsRejected: true })), { version: "approved", removed: false, publishedVersionMissing: "passed", withSenateResolution: true, mark: null });
  assert.deepEqual(versionOfChange(change, vote({})), { version: "passed", removed: false, publishedVersionMissing: null, withSenateResolution: true, mark: null });
  // Also for a part the act no longer has: every part of the print falls back alike.
  const [kept, dropped] = lawChangesOfPrint({ print: { ...print85, kindId: "1" }, texts: { proposed: { document, paragraphs: [...approved.slice(0, 5), "ČÁST DRUHÁ", "Změna zákona o rozpočtových pravidlech", "Zákon č. 218/2000 Sb., o rozpočtových pravidlech, se mění takto:", "V § 1 se slovo zrušuje.", ...approved.slice(5)] }, passed: promulgated } });
  assert.deepEqual(dropped.versions.passed, { removed: true, promulgatedAct: "155/2026" });
  for (const part of [kept, dropped]) assert.equal(versionOfChange(part, vote({ senateAmendmentsRejected: true })).version, "proposed");
  assert.equal(versionOfChange(dropped, vote({})).removed, true);
  assert.match(lawChangeText(change), /Version: text passed by Parliament \(psp\.cz does not publish it; this is the act as promulgated in the Collection of Laws, zákon č\. 155\/2026 Sb\., without its annexes\)\n/);
});

test("a government opinion brings its bill into the prints, with its part and the bill's Senate resolutions", () => {
  const opinion = (printId, number, partNumber, senateResolutionPartNumbers = []) => ({ kind: "government-opinion", payload: { externalPrintId: printId, printKindId: "2", printNumber: number, partNumber, printTitleCz: `Návrh ${number}`, senateResolutionPartNumbers } });
  const step = (printId, number) => ({ kind: "legislative-step", payload: { externalPrintId: printId, printKindId: "2", printNumber: number, partNumber: 0, printTitleCz: `Návrh ${number}`, senateResolutionPartNumbers: [] } });
  const prints = collectPrints([opinion("701", 7, 1, [3]), opinion("702", 8, 2), step("702", 8), opinion("702", 8, 1)]);
  assert.deepEqual(prints.map(({ printId, number, partNumber, senateResolutionPartNumbers, governmentOpinionPartNumbers }) => ({ printId, number, partNumber, senateResolutionPartNumbers, governmentOpinionPartNumbers })), [
    // Only the opinion brings print 7: the bill itself is part 0.
    { printId: "701", number: 7, partNumber: 0, senateResolutionPartNumbers: [3], governmentOpinionPartNumbers: [1] },
    // A later record of the same print keeps its opinions.
    { printId: "702", number: 8, partNumber: 0, senateResolutionPartNumbers: [], governmentOpinionPartNumbers: [1, 2] }
  ]);
});

test("a treaty is divided at its part, chapter, annex, appendix, and protocol headings, and amends no act", () => {
  // The start of real paragraphs of print 331 (the EU–Mexico agreement): the
  // title, the preamble, a part whose heading carries a footnote mark, a
  // chapter, its next paragraph, an appendix, and the protocol.
  const paragraphs = [
    "EU/MX/MGA/cs DOHODA O STRATEGICKÉM PARTNERSTVÍ V OBLASTI POLITIKY, HOSPODÁŘSTVÍ A SPOLUPRÁCE MEZI EVROPSKOU UNIÍ A JEJÍMI ČLENSKÝMI STÁTY",
    "EU/MX/MGA/cs PREAMBULE BELGICKÉ KRÁLOVSTVÍ, BULHARSKÁ REPUBLIKA, ČESKÁ REPUBLIKA, DÁNSKÉ KRÁLOVSTVÍ, SPOLKOVÁ REPUBLIKA",
    "ČÁST II2 POLITICKÝ DIALOG A SPOLUPRÁCE KAPITOLA 1 POLITICKÝ DIALOG, MEZINÁRODNÍ MÍR A BEZPEČNOST ČLÁNEK 1.1 Politický dialog",
    "KAPITOLA 2 SPOLUPRÁCE V MEZINÁRODNÍCH A REGIONÁLNÍCH ORGANIZACÍCH ČLÁNEK 2.1 Mezinárodní organizace 1. Strany podporují",
    "ČLÁNEK 2.2 Regionální organizace 1. Strany spolupracují prostřednictvím výměny názorů v otázkách společného zájmu, změna zákona č. 111/1998 Sb., o vysokých školách, se mění",
    "EU/MX/MGA/cs Dodatek VI-A VÝHRADY TÝKAJÍCÍ SE FINANČNÍCH SLUŽEB SEZNAM EU (platné ve všech členských státech, není-li uvedeno jinak)",
    "EU/MX/MGA/cs PROTOKOL O PREVENCI A POTÍRÁNÍ KORUPCE ODDÍL A Obecná ustanovení ČLÁNEK 1 Cíle 1. Strany potvrzují"
  ];
  const parts = splitTreatyText(paragraphs);
  assert.deepEqual(parts.map(({ heading, titleCz, paragraphs: partParagraphs }) => [heading, titleCz, partParagraphs.length]), [
    [null, null, 1],
    ["PREAMBULE", "BELGICKÉ KRÁLOVSTVÍ, BULHARSKÁ REPUBLIKA, ČESKÁ REPUBLIKA, DÁNSKÉ KRÁLOVSTVÍ, SPOLKOVÁ REPUBLIKA", 1],
    ["ČÁST II", "POLITICKÝ DIALOG A SPOLUPRÁCE KAPITOLA 1 POLITICKÝ DIALOG, MEZINÁRODNÍ MÍR A BEZPEČNOST", 1],
    ["KAPITOLA 2", "SPOLUPRÁCE V MEZINÁRODNÍCH A REGIONÁLNÍCH ORGANIZACÍCH", 2],
    ["Dodatek VI-A", "VÝHRADY TÝKAJÍCÍ SE FINANČNÍCH SLUŽEB SEZNAM EU", 1],
    ["PROTOKOL", "O PREVENCI A POTÍRÁNÍ KORUPCE", 1]
  ]);
  // A footnote mark is told from the number only after a Roman numeral.
  assert.deepEqual(splitTreatyText(["KAPITOLA 12 OBCHOD SE ZBOŽÍM ČLÁNEK 12.1 Cíl"]).map(({ heading, titleCz }) => [heading, titleCz]), [["KAPITOLA 12", "OBCHOD SE ZBOŽÍM"]]);
  // A heading alone in its paragraph starts a part, and a title in mixed
  // case is not cut to a letter.
  assert.deepEqual(splitTreatyText(["Dohoda", "ČÁST II", "OBCHOD", "Dodatek I-B-2 Harmonogram Mexika"]).map(({ heading, titleCz, paragraphs: partParagraphs }) => [heading, titleCz, partParagraphs.length]), [[null, null, 1], ["ČÁST II", null, 2], ["Dodatek I-B-2", null, 1]]);
  // No text is lost or reordered.
  assert.deepEqual(parts.flatMap(({ paragraphs: partParagraphs }) => partParagraphs), paragraphs);
  const document = { filename: "331.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=1" };
  const print = { printId: "43453", kindId: "4", number: 331, title: "Vládní návrh, kterým se předkládá Parlamentu České republiky k vyslovení souhlasu s ratifikací Dohoda o strategickém partnerství", pageUrl: "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=331&CT1=0" };
  const changes = lawChangesOfPrint({ print, texts: { proposed: { document, paragraphs } } });
  assert.deepEqual(changes.map(({ changeId, heading }) => [changeId, heading]), [["43453-1", null], ["43453-2", "PREAMBULE"], ["43453-3", "ČÁST II"], ["43453-4", "KAPITOLA 2"], ["43453-5", "Dodatek VI-A"], ["43453-6", "PROTOKOL"]]);
  // A treaty amends no act, even when a paragraph reads like an amendment.
  assert.deepEqual(changes.flatMap(({ acts }) => acts), []);
  // A treaty without such headings is one law change.
  assert.deepEqual(lawChangesOfPrint({ print, texts: { proposed: { document, paragraphs: ["Smlouva mezi Českou republikou a Slovenskou republikou", "Článek 1", "Strany se dohodly."] } } }).map(({ changeId }) => changeId), ["43453-1"]);
});
