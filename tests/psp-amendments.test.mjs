import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { extractDocxNumberedParagraphs } from "../scripts/lib/psp-print-documents.mjs";
import { listedFiles } from "../scripts/lib/print-parts.mjs";
import { budgetAmendmentItems, linkVoteToAmendment, partsNamedInAmendment, proposersOfHeading, stenoAnnouncements, stenoTurnUrl, summaryOfAmendments, voteReference } from "../scripts/lib/psp-amendments.mjs";

// A DOCX file whose amendment headings are numbered by their style, as in
// the summaries psp.cz publishes (numbering.xml, style "Oznaenpozmn").
function summaryDocx(paragraphs) {
  const body = paragraphs.map(({ style, text }) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join("");
  return zipSync({
    "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`),
    "word/styles.xml": strToU8(`<w:styles><w:style w:type="paragraph" w:styleId="Oznaenpozmn"><w:pPr><w:numPr><w:numId w:val="2"/></w:numPr></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Podnavrh"><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="2"/></w:numPr></w:pPr></w:style></w:styles>`),
    "word/numbering.xml": strToU8(`<w:numbering><w:abstractNum w:abstractNumId="11"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:pStyle w:val="Oznaenpozmn"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1%2."/></w:lvl></w:abstractNum><w:num w:numId="2"><w:abstractNumId w:val="11"/></w:num></w:numbering>`)
  });
}

test("reads Word's list numbers, which the summary's labels are", () => {
  const paragraphs = extractDocxNumberedParagraphs(summaryDocx([
    { style: "Oznaenpozmn", text: "Poslanec Aleš Juchelka" },
    { text: "SD 443" },
    { style: "Oznaenpozmn", text: "Poslankyně Vendula Svobodová" },
    { text: "SD 505" },
    { style: "Podnavrh", text: "" },
    { text: "SD 589" },
    { style: "Podnavrh", text: "" },
    { style: "Oznaenpozmn", text: "Poslanec Jan Papajanovský" }
  ]));
  assert.deepEqual(paragraphs.map(({ label }) => label), ["A.", "", "B.", "", "B1.", "", "B2.", "C."]);
});

test("lists each amendment of a summary with who presented it, when, and its documents and parts", () => {
  const items = summaryOfAmendments([
    { label: "", text: "Pozměňovací a jiné návrhy" },
    { label: "A.", text: "Komplexní a další pozměňovací návrhy obsažené v usnesení garančního hospodářského výboru č. 55 (tisk 67/11)" },
    { label: "", text: "Pozměňovací návrhy přednesené ve druhém čtení dne 11. června 2026." },
    { label: "C.", text: "Poslanec Oto Klempíř" },
    { label: "", text: "(SD 1334)" },
    { label: "", text: "1. V části první čl. I se bod 4 zrušuje." },
    { label: "D.", text: "Poslanec Boris Šťastný" },
    { label: "", text: "D.1(SD 1306)" },
    { label: "", text: "D.2(SD 1308)" },
    { label: "", text: "Aa.Poslanec Matěj Gregor" },
    { label: "", text: "Aa.1(SD 1236)" },
    { label: "B.", text: "Poslankyně Vendula Svobodová" },
    { label: "", text: "SD 505" },
    { label: "B1.", text: "" },
    { label: "", text: "SD 589" },
    { label: "B2.", text: "" }
  ]);
  assert.deepEqual(items.map(({ label, committee, presentedOn }) => [label, committee, presentedOn]), [["A", true, null], ["C", false, "2026-06-11"], ["D", false, "2026-06-11"], ["Aa", false, "2026-06-11"], ["B", false, "2026-06-11"]]);
  assert.deepEqual(items[1].documentNumbers, ["1334"]);
  assert.equal(items[1].presenterCz, "Poslanec Oto Klempíř");
  assert.deepEqual(items[2].parts, { D1: "1306", D2: "1308" });
  assert.deepEqual(items[3].parts, { Aa1: "1236" });
  // A part's document precedes its label here.
  assert.deepEqual(items[4].parts, { B1: "505", B2: "589" });
});

test("reads a state budget's amendments from the rows of its table", () => {
  const items = budgetAmendmentItems([
    "I. PŘÍJMY (v Kč)",
    "Poř. č. |  | čís. kap. | kapitola | Titul a ukazatel státního rozpočtu | Zvýšení SR 2026 |  |  | Snížení SR 2026 |  |  | Přihlásil se k PN/předkládající poslanci | Poznámka zpravodaje | číslo sněmovního dokumentu",
    "1 |  | 313 | Min. práce a sociálních věcí | zvýšit výdaje … | 1500000000 |  | 1500000000 |  |  | 0 | O. Richterová, L. Martínková Španihelová |  | 516",
    "17 |  | 315 | Min. životního prostředí | přesun … | 60000000 |  | 60000000 |  |  | 0 | P. Hladík, B. Niemiec |  | 493"
  ]);
  assert.deepEqual(items.map(({ label, presenterCz, documentNumbers }) => [label, presenterCz, documentNumbers]), [["1", "O. Richterová, L. Martínková Španihelová", ["516"]], ["17", "P. Hladík, B. Niemiec", ["493"]]]);
});

const candidates = [
  { personId: "6763", givenName: "Michaela", surname: "Šebelová" },
  { personId: "6700", givenName: "Barbora", surname: "Pipášová" },
  { personId: "6701", givenName: "Tom", surname: "Philipp" },
  { personId: "6702", givenName: "Věra", surname: "Kovářová" },
  { personId: "6703", givenName: "Veronika", surname: "Kovářová" }
];

test("matches the proposers its heading names in the genitive to the MPs in a club", () => {
  const found = proposersOfHeading([
    "PARLAMENT ČESKÉ REPUBLIKY",
    "Pozměňovací návrh poslankyně Michaely Šebelové, Barbory Pipášové, Mgr. Toma Philippa a Veroniky Kovářové",
    "k vládnímu návrhu zákona, kterým se mění zákon č. 167/1998 Sb."
  ], candidates);
  assert.deepEqual(found.personIds, ["6700", "6701", "6703", "6763"]);
  assert.deepEqual(found.unmatched, []);
  // The heading can be split over paragraphs; a name nobody matches is
  // reported.
  const split = proposersOfHeading(["Pozměňovací návrh", "poslance Jana Neznámého", "k návrhu zákona"], candidates);
  assert.deepEqual(split, { personIds: [], unmatched: ["Jana Neznámého"], heading: "Pozměňovací návrh poslance Jana Neznámého" });
});

test("tells MPs with similar names apart and stops at what the amendment is to", () => {
  const mps = [
    { personId: "6214", givenName: "Věra", surname: "Kovářová" },
    { personId: "7013", givenName: "Veronika", surname: "Kovářová" },
    { personId: "6538", givenName: "Martin", surname: "Kupka" },
    { personId: "7021", givenName: "Martin", surname: "Kupec" },
    { personId: "7030", givenName: "Marian", surname: "Jurečka" },
    { personId: "7040", givenName: "Zdenka", surname: "Němečková Crkvenjaš" },
    { personId: "7050", givenName: "Radek", surname: "Vondráček" }
  ];
  const heading = (text) => proposersOfHeading(["Pozměňovací návrh", text, "k návrhu zákona"], mps);
  assert.deepEqual(heading("poslanců Věry Kovářové, Martina Kupky a dalších").personIds, ["6214", "6538"]);
  assert.deepEqual(heading("poslanců M. Jurečky; Zdenky Crkvenjaš Němečkové").personIds, ["7030", "7040"]);
  // The proposers of the bill after "k návrhu poslanců" are not the
  // amendment's.
  assert.deepEqual(proposersOfHeading(["Pozměňovací návrh k pozměňovacímu návrhu výboru", "[k návrhu poslanců Radka Vondráčka na vydání zákona]"], mps).personIds, []);
  // A heading that runs on into the text ends at its first word in lower case.
  assert.deepEqual(heading("poslankyně Veroniky Kovářové Odstranění závazného stanoviska").personIds, ["7013"]);
});

test("names the bill's parts an amendment amends as their headings write them", () => {
  assert.deepEqual(partsNamedInAmendment(["1. V části první čl. I se bod 4 zrušuje.", "2. V části dvacáté druhé se doplňuje bod 3.", "Za část třetí se vkládá …", "Část pátá zní:"]), ["ČÁST DVACÁTÁ DRUHÁ", "ČÁST PRVNÍ", "ČÁST PÁTÁ", "ČÁST TŘETÍ"]);
  assert.deepEqual(partsNamedInAmendment(["V čl. I bodu 3 se slova …"]), []);
});

// A turn of the stenographic record as psp.cz publishes it (s027017.htm,
// shortened): two announced results and a later remark that links to one of
// them.
const stenoHtml = `<div id="main-content"><p align="justify"><b><a href="/sqw/detail.sqw?id=6474">Poslankyně Zuzana Ožanová</a></b>: Bod sedmdesát čtyři, (návrh) R3, (dokument) 1216, Filip Turek, zvláštní úprava vodoprávního povolení. Výbor doporučuje.</p>
<p align="justify"><b><a href="/sqw/detail.sqw?id=6487">Místopředseda PSP Patrik Nacher</a></b>: Paní ministryně? (Ministryně: Souhlas.) Zahajuji hlasování. Kdo je pro? Kdo je proti?</p>
<p align="justify"><a href="/sqw/hlasy.sqw?G=88220" id="h85">hlasování číslo&nbsp;85</a> bylo přihlášeno 172&nbsp;poslanců, pro&nbsp;120, proti&nbsp;30. Návrh byl přijat.</p>
<p align="justify"><b><a href="/sqw/detail.sqw?id=6474">Poslankyně Zuzana Ožanová</a></b>: Pozměňovací návrh E3 (správně: F3), Karel Haas, nedoporučuje.</p>
<p align="justify"><b><a href="/sqw/detail.sqw?id=6487">Místopředseda PSP Patrik Nacher</a></b>: Zahajuji hlasování.</p>
<p align="justify"><a href="/sqw/hlasy.sqw?G=88221" id="h86">Hlasování&nbsp;86</a>, přihlášeno 172&nbsp;poslanců, pro&nbsp;40, proti&nbsp;100. Návrh byl zamítnut.</p>
<p align="justify"><b><a href="/sqw/detail.sqw?id=1">Poslanec Radek Vondráček</a></b>: U <a href="/sqw/hlasy.sqw?G=88220" id="h85">hlasování 85</a> jsem hlasoval ne.</p></div><div>Související odkazy</div>`;

test("splits a turn of the stenographic record at each announced result, never at a later remark", () => {
  const announcements = stenoAnnouncements(stenoHtml);
  assert.deepEqual(announcements.map(({ voteId }) => voteId), ["88220", "88221"]);
  assert.match(announcements[0].textCz, /\(návrh\) R3, \(dokument\) 1216, Filip Turek/);
  assert.doesNotMatch(announcements[1].textCz, /R3/);
  assert.equal(stenoTurnUrl(2025, 27, 17), "https://www.psp.cz/eknih/2025ps/stenprot/027schuz/s027017.htm");
});

const items = [
  { label: "A", presenterCz: "Komplexní pozměňovací návrh obsažený v usnesení výboru", committee: true, documentNumbers: [], parts: {} },
  { label: "F", presenterCz: "Poslanec Karel Haas", committee: false, documentNumbers: ["1414", "1415"], parts: { F3: "1415" } },
  { label: "R", presenterCz: "Poslanec Filip Turek", committee: false, documentNumbers: ["1214", "1216"], parts: { R3: "1216" } }
];

test("links a vote to its amendment only when the label resolves and the presenter is named", () => {
  const [first, second] = stenoAnnouncements(stenoHtml);
  assert.deepEqual(linkVoteToAmendment(voteReference(first.textCz), items), { linked: true, label: "R3", variant: null, documentNumbers: ["1216"], presenterCz: "Poslanec Filip Turek" });
  // The record's correction of a misspoken label decides.
  assert.deepEqual(linkVoteToAmendment(voteReference(second.textCz), items).documentNumbers, ["1415"]);
  const reference = (text) => voteReference(`Poslankyně Zuzana Ožanová : ${text} Místopředseda PSP Patrik Nacher : Zahajuji hlasování. Kdo je pro? Kdo je proti?`);
  assert.deepEqual(linkVoteToAmendment(reference("Pozměňovací návrh R3, týká se vodního zákona."), items), { linked: false, reason: "presenter-not-named" });
  assert.deepEqual(linkVoteToAmendment(reference("Nyní pozměňovací návrh A, komplexní pozměňovací návrh výboru."), items), { linked: false, reason: "committee-amendment" });
  assert.deepEqual(linkVoteToAmendment(reference("Pozměňovací návrh R, kolega Turek."), items), { linked: false, reason: "amendment-of-several-documents" });
  assert.deepEqual(linkVoteToAmendment(reference("Pozměňovací návrh Z1, kolega Turek."), items), { linked: false, reason: "label-not-in-summary" });
  assert.deepEqual(linkVoteToAmendment(reference("Budeme hlasovat o proceduře, jak ji přednesla zpravodajka."), items), { linked: false, reason: "procedural" });
  assert.deepEqual(linkVoteToAmendment(reference("Následuje sněmovní dokument 1214, kolega Turek."), items), { linked: true, label: "R", variant: null, documentNumbers: ["1214"], presenterCz: "Poslanec Filip Turek" });
  // A word after "návrh" is never a label.
  assert.equal(voteReference("Poslanec X : hlasujeme návrh na zamítnutí. Zahajuji hlasování.").label, null);
  // A budget item is named by its number.
  const budget = [{ label: "17", presenterCz: "P. Hladík, B. Niemiec", committee: false, documentNumbers: ["493"], parts: {} }];
  assert.deepEqual(linkVoteToAmendment(voteReference("Poslanec Vladimír Pikora : Pořadové číslo 17, předkládá poslanec Petr Hladík. Zahajuji hlasování."), budget, { budget: true }).documentNumbers, ["493"]);
});

test("lists the files of a parliamentary document's page", () => {
  const html = `<h2 class="section-title"><span>Soubory sněmovního dokumentu</span></h2></a><table><tbody><tr><th colspan=2 class="lightblue">Text&nbsp;&nbsp;</th></tr><tr><td><span class="file pdf"><a href="/sqw/text/orig2.sqw?idd=281266">31012-47100.pdf</a></span></td><td><span class="file docx"><a href="/sqw/text/orig2.sqw?idd=281265">31012-47100.docx</a></span></td></tr></tbody></table>`;
  assert.deepEqual(listedFiles(html, "https://www.psp.cz/sqw/sd.sqw?cd=2012&o=10"), [
    { section: "Text", filename: "31012-47100.pdf", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=281266", format: "pdf" },
    { section: "Text", filename: "31012-47100.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=281265", format: "docx" }
  ]);
});

test("never links a vote to more than the record names (review findings)", () => {
  const reference = (text) => voteReference(`Poslankyně Zuzana Ožanová : ${text} Místopředseda PSP Patrik Nacher : Zahajuji hlasování. Kdo je pro? Kdo je proti?`);
  const single = [{ label: "D", presenterCz: "Poslanec Boris Šťastný", committee: false, documentNumbers: ["1306"], parts: { D1: "1306", D12: "1399" } }];
  // A point of a part keeps its dot and is never linked.
  assert.deepEqual(linkVoteToAmendment(reference("Pozměňovací návrh D1.2, kolega Šťastný."), single), { linked: false, reason: "point-of-amendment" });
  assert.equal(voteReference("Poslanec X : pozměňovací návrh D.1, kolega Šťastný. Zahajuji hlasování.").label, "D1");
  // A part the summary does not list is not the whole amendment.
  assert.deepEqual(linkVoteToAmendment(reference("Pozměňovací návrh D7, kolega Šťastný."), single), { linked: false, reason: "part-not-in-summary" });
  // The budget item named last decides.
  const budget = [{ label: "16", presenterCz: "P. Hladík", committee: false, documentNumbers: ["492"], parts: {} }, { label: "17", presenterCz: "B. Niemiec", committee: false, documentNumbers: ["493"], parts: {} }];
  assert.deepEqual(linkVoteToAmendment(voteReference("Poslanec Vladimír Pikora : Pořadové číslo 16 jsme odhlasovali, pan Hladík. Nyní pořadové číslo 17, pan Niemiec. Zahajuji hlasování."), budget, { budget: true }).documentNumbers, ["493"]);
});

test("reads the names before \"k\" in the same paragraph, and a passage across turns", () => {
  assert.deepEqual(proposersOfHeading(["Pozměňovací návrh", "poslankyně Michaely Šebelové k vládnímu návrhu zákona o daních"], candidates).personIds, ["6763"]);
  const turn = (body) => `<div id="main-content">${body}</div><div>Související odkazy</div>`;
  const [announcement] = stenoAnnouncements([
    { url: "https://www.psp.cz/eknih/2025ps/stenprot/027schuz/s027016.htm", html: turn("<p>Poslankyně Zuzana Ožanová : Bod sedmdesát čtyři, (návrh) R3, (dokument) 1216, Filip Turek.</p>") },
    { url: "https://www.psp.cz/eknih/2025ps/stenprot/027schuz/s027017.htm", html: turn('<p>Místopředseda PSP Patrik Nacher : Zahajuji hlasování.</p><p><a href="/sqw/hlasy.sqw?G=88220" id="h85">Hlasování číslo&nbsp;85</a>, přihlášeno 172&nbsp;poslanců.</p>') }
  ]);
  assert.match(announcement.textCz, /\(návrh\) R3, \(dokument\) 1216, Filip Turek/);
  assert.equal(announcement.url, "https://www.psp.cz/eknih/2025ps/stenprot/027schuz/s027017.htm");
});
