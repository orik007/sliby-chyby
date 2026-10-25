import { cleanText, czechMonths, invariant } from "./collector-core.mjs";
import { normalizeSearchText } from "./attribution.mjs";
import { listedFiles } from "./print-parts.mjs";
import { extractDocParagraphs, extractDocxNumberedParagraphs, extractDocxParagraphs, officialPrintDocumentPageUrl } from "./psp-print-documents.mjs";
import { pspDocumentExtractions, pspDocumentFileOptions } from "./psp-document-cache.mjs";
import { readPspPage } from "./psp-page-cache.mjs";
import { annexSectionKey, sectionKeysNamed } from "./amending-points.mjs";
import { extractXlsxRows } from "./xlsx-rows.mjs";

/**
 * Amendments to bills submitted by MPs and the Chamber's votes on them
 * (docs/evidence-pipeline.md, Amendment data rules). This module only reads
 * official documents; which amendments and votes are conduct is decided in
 * attribution.mjs by docs/scoring.md.
 */

// sd_dokument.typ of a written amendment ("Písemné pozměňovací návrhy",
// psp.cz k=1309).
export const amendmentDocumentType = "13";

// tisky_za.id_druh of the summary of the amendments presented in the second
// reading ("Pozměňovací a jiné návrhy", druh_tisku.unl).
export const amendmentSummaryKindId = "10";

/** The official page of a parliamentary document of the term. */
export function amendmentDocumentPageUrl(termNumber, documentNumber) {
  return `https://www.psp.cz/sqw/sd.sqw?cd=${documentNumber}&o=${termNumber}`;
}

/** One turn of the stenographic record of a Chamber session of the term. */
export function stenoTurnUrl(termYear, sessionNumber, turnNumber) {
  const session = String(sessionNumber).padStart(3, "0");
  return `https://www.psp.cz/eknih/${termYear}ps/stenprot/${session}schuz/s${session}${String(turnNumber).padStart(3, "0")}.htm`;
}

const namedDatePattern = new RegExp(`(\\d{1,2})\\.\\s*(${Object.keys(czechMonths).join("|")})\\s+(\\d{4})`, "u");

// "4. března 2026" or "4. 3. 2026" as an ISO date, or null.
function czechDate(text) {
  const named = namedDatePattern.exec(text);
  if (named) return `${named[3]}-${String(czechMonths[named[2]]).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
  const numeric = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(text);
  return numeric ? `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}` : null;
}

// The heading of an amendment in a summary: its label ("A", "Gg"), then who
// presented it or the committee resolution that holds it.
const itemHeadingPattern = /^([A-Z][a-z]?)\.\s*(.*)$/u;
const itemHeadingStartPattern = /^(?:Poslan|Komplexní|Pozměňovací|Návrh|Další|Usnesení)/u;
// A part of an amendment with its own label ("D.1", "B1.", "Gg.2").
const subLabelPattern = /^([A-Z][a-z]?)\.?\s?(\d+)\.?(?=\s|\(|$)/u;
const documentReferencePattern = /\bSD\s*(\d+)/gu;
// "Pozměňovací návrhy přednesené ve druhém čtení dne 4. března 2026"
const presentationPattern = /přednesen\p{L}*\s[^.]*?\bdne\s/u;

/**
 * The amendments a summary of the second reading lists (`paragraphs` as
 * extractDocxNumberedParagraphs returns them): per label, who presented it
 * (an MP, or a committee resolution, which is no MP's amendment), the date
 * the summary names for its presentation, the parliamentary documents (SD)
 * that hold its text, and its labelled parts with the document of each.
 */
export function summaryOfAmendments(paragraphs) {
  const items = [];
  let current = null;
  let lastDocument = null;
  let presentedOn = null;
  for (const { label, text } of paragraphs) {
    const line = `${label ? `${label} ` : ""}${text}`.replace(/\s+/g, " ").trim();
    const heading = itemHeadingPattern.exec(line);
    if (!heading && presentationPattern.test(line)) presentedOn = czechDate(line) ?? presentedOn;
    // A labelled part ("D.1 SD 1306 … výboru") is never a heading.
    if (heading && (itemHeadingStartPattern.test(heading[2]) || (/výbor/u.test(heading[2]) && !/^\d/u.test(heading[2])))) {
      const presenterCz = heading[2].replace(/\s*[–-]\s*SD\s*\d+.*$/u, "").trim();
      const committee = !/^Poslan/u.test(presenterCz) && /výbor|usnesení/iu.test(presenterCz);
      current = {
        label: heading[1],
        presenterCz: cleanText(presenterCz, 300),
        committee,
        presentedOn,
        documentNumbers: [],
        parts: {}
      };
      items.push(current);
      lastDocument = null;
      for (const [, number] of line.matchAll(documentReferencePattern)) {
        current.documentNumbers.push(number);
        lastDocument = number;
      }
      continue;
    }
    if (!current) continue;
    const documents = [...line.matchAll(documentReferencePattern)].map(([, number]) => number);
    const part = subLabelPattern.exec(line);
    if (part && part[1] === current.label) {
      current.parts[`${part[1]}${part[2]}`] = documents[0] ?? lastDocument;
      for (const number of documents) current.documentNumbers.push(number);
      if (documents.length > 0) lastDocument = documents.at(-1);
      continue;
    }
    // A document reference stands on a short line of its own.
    if (documents.length > 0 && line.length < 40) {
      current.documentNumbers.push(...documents);
      lastDocument = documents.at(-1);
    }
  }
  for (const item of items) item.documentNumbers = [...new Set(item.documentNumbers)].sort((left, right) => Number(left) - Number(right));
  return items;
}

/**
 * The amendments of a state budget, listed in the XLSX workbook annexed to
 * its summary (rows as extractXlsxRows returns them): each numbered row
 * ("Poř. č.") with the MPs who presented it and its parliamentary document.
 */
export function budgetAmendmentItems(rows) {
  const cellsOf = (row) => row.split(" | ").map((cell) => cell.trim());
  const header = rows.map(cellsOf).find((cells) => cells[0] === "Poř. č.");
  invariant(header, "The budget amendments table has no header row");
  const presenters = header.findIndex((cell) => /předkládající poslanci/u.test(cell));
  const document = header.findIndex((cell) => /číslo sněmovního dokumentu/u.test(cell));
  invariant(presenters > 0 && document > 0, "The budget amendments table has no presenters or document column");
  const items = new Map();
  for (const cells of rows.map(cellsOf)) {
    if (!/^\d+$/.test(cells[0])) continue;
    const item = items.get(cells[0]) ?? { label: cells[0], presenterCz: "", committee: false, presentedOn: null, documentNumbers: [], parts: {} };
    if (cells[presenters]) item.presenterCz = cleanText([item.presenterCz, cells[presenters]].filter(Boolean).join(", "), 1000);
    item.documentNumbers.push(...(cells[document]?.match(/\d+/g) ?? []));
    items.set(cells[0], item);
  }
  return [...items.values()].map((item) => ({ ...item, documentNumbers: [...new Set(item.documentNumbers)] }));
}

// Lower case without diacritics.
function fold(value) {
  return normalizeSearchText(value);
}

// The start of a surname that every Czech case form of it shares
// ("Šebelová", "Šebelové": "sebel").
function surnameStem(surname) {
  const folded = fold(surname);
  return folded.length > 5 ? folded.slice(0, Math.max(3, folded.length - 3)) : folded.slice(0, Math.max(3, folded.length - 2));
}

const academicTitles = /\b(?:Ph\.\s?D\.|LL\.M\.|MBA|CSc\.|DiS\.|Mgr\.|Ing\.|Bc\.|JUDr\.|MUDr\.|PhDr\.|RNDr\.|doc\.|prof\.|PaedDr\.|MVDr\.|ThLic\.|MgA\.|PharmDr\.|ThDr\.|ICDr\.|Dr\.)/gu;

/**
 * The MPs who submitted an amendment, from the heading of its text
 * ("Pozměňovací návrh poslanců Michaely Šebelové, Barbory Pipášové a Toma
 * Philippa k vládnímu návrhu zákona …"), which names them in the genitive.
 * `candidates` are the MPs in a club on the submission date (`personId`,
 * `givenName`, `surname`). A name matches the one candidate whose surname
 * shares its case-independent start; among several, the given name decides.
 * Returns the matched person IDs, the names matched despite a misspelt
 * surname (`misspelt`), and the names no candidate matched.
 */
export function proposersOfHeading(paragraphs, candidates) {
  const start = paragraphs.findIndex((paragraph) => /^\s*Pozměňovací\s*návrh/iu.test(paragraph));
  if (start < 0 || start > 20) return { personIds: [], unmatched: [], misspelt: [], heading: null };
  const sharedStart = (left, right) => {
    let length = 0;
    while (length < left.length && left[length] === right[length]) length += 1;
    return length;
  };
  // "Michaely Šebelové", "M. Jurečky", "Zdenky Crkvenjaš Němečkové": a given
  // name or its initial, then the surname, of one or two words. A name ends at
  // the first word in lower case, where a heading that runs on into the text
  // continues. Returns the MP it matches (`personId`, null for none or a tie),
  // or null when the part is no such name.
  const exactMatch = (part) => {
    const words = part.split(/\s+(?=\p{Ll})/u)[0].match(/\p{Lu}[\p{L}-]*\.?/gu) ?? [];
    if (words.length < 2 || words.length > 4) return null;
    const initial = /\.$/u.test(words[0]);
    const given = fold(words[0].replace(/\.$/u, ""));
    const surnames = words.slice(1).map(fold);
    // Every MP whose surname's case-independent start this form has, best
    // first: the longer shared start of the surname, then of the given name,
    // then the given name of the closer length ("Věry" is Věra, not
    // Veronika); a tie matches nobody.
    const hits = candidates
      .map((candidate) => {
        const candidateSurnames = String(candidate.surname).split(/\s+/u).map(fold);
        const candidateGiven = fold(candidate.givenName);
        const pairs = surnames.flatMap((surname) => candidateSurnames.filter((candidateSurname) => surname.startsWith(surnameStem(candidateSurname))).map((candidateSurname) => sharedStart(surname, candidateSurname)));
        const givenShared = initial ? (candidateGiven.startsWith(given) ? 2 : 0) : sharedStart(given, candidateGiven);
        return { candidate, matches: pairs.length > 0, score: [Math.max(0, ...pairs), givenShared, initial ? 0 : -Math.abs(given.length - candidateGiven.length)] };
      })
      .filter(({ matches, score }) => matches && score[1] >= (initial ? 1 : 2))
      .sort((left, right) => right.score[0] - left.score[0] || right.score[1] - left.score[1] || right.score[2] - left.score[2]);
    const same = (left, right) => left.score.every((value, index) => value === right.score[index]);
    const personId = hits.length > 0 && (hits.length === 1 || !same(hits[0], hits[1])) ? hits[0].candidate.personId : null;
    return { personId, anyHit: hits.length > 0, initial, given, surnames };
  };
  // The heading ends where it names what the amendment is to ("k vládnímu
  // návrhu", "K návrhu", "[k návrhu poslanců …]"), also within a paragraph,
  // or at a paragraph with the bill's title; a name never holds the word "k"
  // or "zákon".
  const namesOf = (text) => text
    .replace(academicTitles, " ")
    .replace(/(?<!\p{L})(?:pozměňovací\s*návrhy?|poslan\p{L}*|skupiny|paní|pana|kolegyň\p{L}*|kolegů)(?!\p{L})|[():]/giu, " ");
  const partsOf = (text) => namesOf(text).split(/[,;]\s*|\s+a\s+/u).map((part) => part.trim()).filter(Boolean);
  // A heading that already names someone, also in lower case, and does not
  // end with a separator (", ", " a"), is complete at the end of its
  // paragraph. The next paragraph still continues the list when it starts
  // with "a" or ",", names an MP, or holds only names of two to four words
  // that all start with a capital followed by lower case ("Karla Haase", not
  // "ČÁST PRVNÍ" or "Čl. I") or are all in lower case, and does not end with
  // a colon ("nově zní:"). Otherwise it is the amendment's own title or text
  // ("Odstranění závazného stanoviska…"), which starts with a capital and
  // goes on in lower case.
  const complete = (text) => {
    const names = namesOf(text).trim();
    return /\p{L}{2,}/u.test(names) && !/(?:[,;]|\sa)$/u.test(names);
  };
  const onlyNames = (text) => !/:\s*$/u.test(text) && partsOf(text).every((part) => /^(?:(?:\p{Lu}\.|\p{Lu}[\p{Ll}-]+\.?)\s*){2,4}$/u.test(part) || /^(?:\p{Ll}[\p{Ll}-]*\s*){2,4}$/u.test(part));
  const namesAnMp = (text) => partsOf(text).some((part) => exactMatch(part)?.personId);
  let heading = "";
  for (const paragraph of paragraphs.slice(start, start + 6)) {
    const before = paragraph.split(/(?:^|\s)\[?[Kk]e?\s/u)[0];
    if (heading && /zákon|tisk|^\s*(?:Vládní|Návrh|ST)\b/iu.test(before)) break;
    if (heading && !before.trim()) break;
    // Names that go on in a paragraph of their own are one more of the list.
    let separator = " ";
    if (heading && complete(heading) && !/^\s*(?:a\s|[,;])/u.test(before)) {
      if (!onlyNames(before) && !namesAnMp(before)) break;
      separator = ", ";
    }
    heading += `${separator}${before}`;
    if (before !== paragraph) break;
  }
  // A template's placeholder ("Poslance …xxx……") names nobody.
  const parts = partsOf(heading).filter((part) => part.length > 3 && !/^dalších$/u.test(part) && !/^[\s….]*x{3,}[\s….]*$/iu.test(part));
  const personIds = new Set();
  const unmatched = [];
  const misspelt = [];
  for (const part of parts) {
    const match = exactMatch(part);
    if (!match) {
      unmatched.push(part);
      continue;
    }
    if (match.personId) {
      personIds.add(match.personId);
      continue;
    }
    // A misspelt surname ("Andrey Hoffmanové" for Andrea Hoffmannová,
    // "Karla Hasse" for Karel Haas): the one MP whose given name has the same
    // start (all but its last letter, at least two and at most three: "Evy"
    // is Eva) and whose surname has the same first two letters and is at most
    // two letters from the form, which a case ending alone already takes. It
    // is reported, so every such match can be checked.
    const { initial, given, surnames } = match;
    const givenMatches = (candidateGiven) => sharedStart(given, candidateGiven) >= Math.max(2, Math.min(3, Math.min(given.length, candidateGiven.length) - 1));
    const near = match.anyHit || initial || surnames.length !== 1 || surnames[0].length < 4 ? [] : candidates
      .filter((candidate) => givenMatches(fold(candidate.givenName)))
      .filter((candidate) => String(candidate.surname).split(/\s+/u).map(fold).some((surname) => surname.slice(0, 2) === surnames[0].slice(0, 2) && editDistance(surnames[0], surname) <= 2));
    if (near.length === 1) {
      personIds.add(near[0].personId);
      misspelt.push({ name: part, personId: near[0].personId, givenName: near[0].givenName, surname: near[0].surname });
    } else unmatched.push(part);
  }
  return { personIds: [...personIds].sort(), unmatched, misspelt, heading: cleanText(heading, 1000) };
}

// The fewest letters inserted, deleted, or replaced to turn one word into
// the other.
function editDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length];
}

// "V části první", "části dvacáté druhé", "Část třetí zní", "za část
// druhou": the parts of the bill an amendment names, as the bill's part
// headings write them ("ČÁST PRVNÍ"). The ordinal is feminine; its case
// ending -é (genitive) or -ou (accusative) is -á in a heading. A unit ordinal
// follows only a tens ordinal ("dvacáté druhé"), so a verb after the ordinal
// ("části třetí zní") is never taken for one.
const unitOrdinal = "(?:první|druh(?:[éáý]|ou)|třetí|čtvrt(?:[éáý]|ou)|pát(?:[éáý]|ou)|šest(?:[éáý]|ou)|sedm(?:[éáý]|ou)|osm(?:[éáý]|ou)|devát(?:[éáý]|ou))";
const tensOrdinal = "(?:dvacát|třicát|čtyřicát|padesát|šedesát|sedmdesát|osmdesát|devadesát)(?:[éáý]|ou)";
const partReferencePattern = new RegExp(`(?<!\\p{L})[Čč]ást(?:i|í)?\\s+((?:sto\\s+)?(?:${tensOrdinal}(?:\\s+${unitOrdinal})?|\\p{Ll}+(?:[éíá]|ou)))(?!\\p{L})`, "gu");

export function partsNamedInAmendment(paragraphs) {
  const parts = new Set();
  for (const paragraph of paragraphs) {
    for (const [, ordinal] of paragraph.matchAll(partReferencePattern)) {
      parts.add(`ČÁST ${ordinal.split(/\s+/).map((word) => word.replace(/(?:é|ou)$/u, "á")).join(" ").toLocaleUpperCase("cs-CZ")}`);
    }
  }
  return [...parts].sort();
}

// "V části první čl. I …", "1) Za část druhou …", "Část třetí zní:".
const partInstructionPattern = /^(?:[\p{Lu}\d]{1,4}[.)]\s*)*(?:(?:V|Ve|Za|Před|K)\s+část(?:i|í|ou)?|Část\p{L}*)\s/u;
const articlePattern = /(?<!\p{L})čl\.\s*([IVXLC]+[a-z]?)(?!\p{L})/giu;

/**
 * The sections and articles ("Čl. II") an amendment's instructions on one
 * part of the bill name (`heading`, "ČÁST PRVNÍ", or null for a bill
 * without parts), by which it is matched to the groups of a divided part
 * (scripts/lib/amending-points.mjs, sectionGroupHolds).
 */
export function sectionsNamedInAmendment(paragraphs, heading) {
  const sections = new Set();
  const articles = new Set();
  let inPart = heading === null;
  for (const paragraph of paragraphs) {
    if (/^Odůvodnění(?!\p{L})/u.test(paragraph.trim())) break;
    if (heading !== null && partInstructionPattern.test(paragraph)) inPart = partsNamedInAmendment([paragraph]).includes(heading);
    if (!inPart) continue;
    for (const key of sectionKeysNamed(paragraph)) sections.add(key);
    if (/(?<!\p{L})přílo[hz]/iu.test(paragraph)) sections.add(annexSectionKey);
    for (const [, article] of paragraph.matchAll(articlePattern)) articles.add(`Čl. ${article.replace(/^[ivxlc]+/, (numeral) => numeral.toUpperCase())}`);
  }
  return { sections: [...sections].sort((left, right) => left - right), articles: [...articles].sort() };
}

/**
 * The results the stenographic record announces in consecutive turns of one
 * day (`pages`: `{ url, html }` in order, or the HTML of one turn): each vote
 * ID with the text spoken since the previous announcement, also in an
 * earlier turn, and the URL of the turn that announces it. A result is
 * announced as a link to the vote ("Hlasování číslo 85, přihlášeno …"); a
 * later link to the same vote, in a remark about it, is no announcement.
 */
export function stenoAnnouncements(pages) {
  const turns = (typeof pages === "string" ? [{ url: null, html: pages }] : pages).map(({ url, html }) => {
    const start = html.indexOf("main-content");
    const end = html.indexOf("Související odkazy", start);
    return { url, body: html.slice(start >= 0 ? start : 0, end > start ? end : undefined) };
  });
  const body = turns.map(({ body: text }) => text).join("\n");
  // Where each turn's text begins in the joined text.
  const starts = turns.map((_, index) => turns.slice(0, index).reduce((sum, { body: text }) => sum + text.length + 1, 0));
  const urlAt = (position) => turns[starts.findLastIndex((start) => start <= position)]?.url ?? null;
  const announcements = [];
  let previous = 0;
  for (const match of body.matchAll(/<a href="\/sqw\/hlasy\.sqw\?G=(\d+)"[^>]*>\s*[Hh]lasování(?:\s|&nbsp;)+(?:číslo(?:\s|&nbsp;)+)?\d+<\/a>[^<]{0,40}?přihlášen/gu)) {
    let before = body.slice(previous, match.index);
    if (previous > 0) {
      const paragraphEnd = before.indexOf("</p>");
      if (paragraphEnd >= 0) before = before.slice(paragraphEnd + 4);
    }
    announcements.push({ voteId: match[1], textCz: plainText(before), url: urlAt(match.index) });
    previous = match.index + match[0].length;
  }
  return announcements;
}

function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[⁠​]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

// One utterance starts with its speaker and " : ".
const speakerPattern = /(?=(?:Poslan(?:ec|kyně)|Místopředsed\p{L}*(?: PSP)?|Předsed\p{L}*(?: PSP)?|Ministr\p{L}*|Místopředsedkyně vlády)[^:]{2,90} : )/u;
// A label after a word that introduces it: "pozměňovací návrh H1, varianta
// 3", "(návrh) R3", "s označením M2", "pod písmenem C3", "hlasovat A2".
// Only the introducing word may be capitalised; the label itself is matched
// case-sensitively, so a word such as "na" is never a label.
const labelPattern = /(?:(?<![\p{L}\d])(?:[Nn]ávrh\p{L}*|[Oo]značením|[Bb]od\p{L}*|[Pp]ísmen\p{L}*|[Hh]lasovat|[Hh]lasujeme|[Hh]lasuje)\s+(?:\(návrh\)\s*)?|\(návrh\)\s*)([A-Z][a-z]?(?:[.-]?\s?\d+(?:\.\d+)*)?)(?![\p{L}\d])(?:,?\s*varianta\s*(\d+))?/gu;
const documentNumberPattern = /(?:sněmovní\p{L}*\s+dokument\p{L}*|\(dokument\p{L}*\)|dokument\p{L}*|SD)\s*(?:číslo\s*)?(\d{2,4})\b/giu;
const budgetItemPattern = /[Pp]ořadov\p{L}+\s+čísl\p{L}+\s+(\d+)/gu;
// A vote on the procedure or a counter-proposal to it is no amendment vote.
// "procedura", "proceduře", "proceduru".
const procedurePattern = /procedu[rř]|o protinávrhu|zpochybnění hlasování/iu;

/**
 * What one announced vote was about, from the text spoken before it: the
 * label of the amendment the rapporteur named last (with its variant), the
 * parliamentary document named last, and, for a state budget, the number of
 * the item in its table; `procedural` when the chair put the procedure or an
 * objection to the vote.
 */
// A label as the summary keys it: the letter and the number of its part
// without a separator ("D.1", "D 1", "D-1" are "D1"); a point within a part
// keeps its dot ("A2.62", "D1.2").
function normalizedLabel(label) {
  const [, letter, rest] = /^([A-Z][a-z]?)[.\s-]*(.*)$/u.exec(label.trim()) ?? [];
  return `${letter}${rest.replace(/\s/gu, "")}`;
}

export function voteReference(textCz) {
  const tail = textCz.slice(-900);
  if (procedurePattern.test(tail.slice(-260))) return { procedural: true, label: null, variant: null, documentNumber: null, budgetItem: null, tail };
  let label = null;
  let variant = null;
  for (const utterance of tail.split(speakerPattern).filter((part) => part.trim()).reverse()) {
    const spoken = utterance.split(" : ").slice(1).join(" : ") || utterance;
    const found = [...spoken.matchAll(labelPattern)].filter(([, candidate]) => !/^(?:PSP|ČR|EU|SD)$/u.test(candidate));
    if (found.length > 0) {
      label = normalizedLabel(found.at(-1)[1]);
      variant = found.at(-1)[2] ?? null;
      // The record corrects a label the rapporteur misspoke: "E3 (správně: F3)".
      const corrected = /\(správně:\s*([A-Z][a-z]?[.-]?\s?\d*(?:\.\d+)*)\)/u.exec(spoken.slice(found.at(-1).index));
      if (corrected) label = normalizedLabel(corrected[1]);
      break;
    }
  }
  const documents = [...tail.slice(-700).matchAll(documentNumberPattern)];
  return {
    procedural: false,
    label,
    variant,
    documentNumber: documents.at(-1)?.[1] ?? null,
    budgetItem: [...tail.slice(-700).matchAll(budgetItemPattern)].at(-1)?.[1] ?? null,
    tail
  };
}

// Whether a word of a passage (folded) is a case form of a surname: it starts
// with the whole surname less its last letter ("Novák": "Nováka",
// "Novákovi"; "Malá": "Malé", "Malou"), or less its last two when the
// surname ends in a vowel and a consonant that the vowel drops from
// ("Havlíček": "Havlíčka"; "Kupec": "Kupce"; "Havel": "Havla"). A shorter
// shared start ("Nov…" of "Novotný") is another name.
function isFormOfSurname(word, surname) {
  const folded = fold(surname);
  const stem = folded.slice(0, Math.max(3, folded.length - (/e[ckln]$/u.test(folded) ? 2 : 1)));
  return word.startsWith(stem);
}

// The surnames of an item's presenters: "Poslanec Oto Klempíř" or, for a
// budget item, "P. Hladík, B. Niemiec".
function presenterSurnames(item) {
  return item.presenterCz
    .replace(/^Poslan\p{L}*\s+/u, "")
    .split(/,\s*/u)
    .map((name) => name.split(/\s+/u).at(-1))
    .filter((surname) => surname && surname.length > 2);
}

/**
 * The amendment one vote was on, or why none is linked
 * (docs/evidence-pipeline.md, Amendment data rules): the label or document
 * the rapporteur named must resolve in the print's summary, and a presenter
 * of that amendment must be named in the same passage. `items` are the
 * summary's amendments (summaryOfAmendments or budgetAmendmentItems).
 * Returns `{ linked: true, label, variant, documentNumbers, presenterCz }`
 * or `{ linked: false, reason }`.
 */
export function linkVoteToAmendment(reference, items, { budget = false } = {}) {
  if (reference.procedural) return { linked: false, reason: "procedural" };
  let item = null;
  let documentNumbers = [];
  let label = null;
  if (budget && reference.budgetItem) {
    item = items.find(({ label: itemLabel }) => itemLabel === reference.budgetItem) ?? null;
    if (!item) return { linked: false, reason: "label-not-in-summary" };
    label = item.label;
    documentNumbers = item.documentNumbers;
  } else if (reference.label) {
    const [, letter, number] = /^([A-Z][a-z]?)(\d+)?/u.exec(reference.label) ?? [];
    item = items.find(({ label: itemLabel }) => itemLabel === letter) ?? null;
    if (!item) return { linked: false, reason: "label-not-in-summary" };
    if (item.committee) return { linked: false, reason: "committee-amendment" };
    if (number && !/^[A-Z][a-z]?\d+$/u.test(reference.label)) return { linked: false, reason: "point-of-amendment" };
    // A labelled part must be one the summary lists with its document; a
    // letter alone stands for its amendment only when that is one document.
    const document = number ? item.parts[`${letter}${number}`] ?? null : item.documentNumbers.length === 1 ? item.documentNumbers[0] : null;
    if (!document) return { linked: false, reason: number ? "part-not-in-summary" : "amendment-of-several-documents" };
    label = reference.label;
    documentNumbers = [document];
  } else if (reference.documentNumber) {
    item = items.find(({ documentNumbers: numbers, committee }) => !committee && numbers.includes(reference.documentNumber)) ?? null;
    if (!item) return { linked: false, reason: "document-not-in-summary" };
    label = Object.entries(item.parts).find(([, number]) => number === reference.documentNumber)?.[0] ?? item.label;
    documentNumbers = [reference.documentNumber];
  } else {
    return { linked: false, reason: "no-label" };
  }
  const passage = fold(reference.tail.slice(-700));
  const words = passage.split(/[^a-z0-9]+/u);
  if (!presenterSurnames(item).some((surname) => words.some((word) => isFormOfSurname(word, surname)))) return { linked: false, reason: "presenter-not-named" };
  return { linked: true, label, variant: reference.variant, documentNumbers, presenterCz: item.presenterCz };
}


/**
 * Turns of the stenographic record (`{ session, date, turn }`) in runs of
 * consecutive turns of one day, in order: a passage may run on from one turn
 * of a run into the next, never across a turn not read.
 */
export function consecutiveTurns(turns) {
  const runs = [];
  const sorted = [...turns].sort((left, right) => left.session - right.session || left.date.localeCompare(right.date) || left.turn - right.turn);
  for (const turn of sorted) {
    const last = runs.at(-1)?.at(-1);
    if (last && last.session === turn.session && last.date === turn.date && last.turn + 1 === turn.turn) runs.at(-1).push(turn);
    else runs.push([turn]);
  }
  return runs;
}

// The minutes since midnight of a vote's "HH:MM".
function minutesOf(time) {
  const [hours, minutes] = String(time ?? "").split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : null;
}

/**
 * Reads the amendments of the term and links the votes on them
 * (docs/evidence-pipeline.md, Amendment data rules). `plan` comes from
 * normalizePspData (scripts/lib/psp-collector.mjs): the summaries of the
 * second reading, the parliamentary documents of sd.zip, the MPs in a club
 * on a date (`candidatesOn`), the votes on the agenda item of a bill after
 * its summary was distributed, and the turns of the stenographic record.
 * A page of a closed print is read once through `pageCache`, every other page
 * and every turn in every run; every file through `documentCache`.
 * Returns the amendments (one per presented document with a readable text),
 * the link of each vote to its amendment, warnings, and quality figures.
 */
export async function collectAmendments({ source, plan, fetchPsp, documentCache, pageCache, closedPrintIds }) {
  const warnings = [];
  const quality = { summaries: plan.summaries.length, summariesWithoutFile: 0, amendmentItems: 0, committeeItems: 0, itemsWithoutPresenter: 0, documentsListed: 0, documentsNotInOpenData: 0, documentsWithoutText: 0, amendments: 0, proposerNames: 0, proposerNamesUnmatched: 0, proposerNamesMisspelt: 0, documentsNotListed: 0, votes: plan.amendmentVotes.length, votesLinked: 0, votesNotLinked: {}, stenoTurnsRead: 0 };
  // A page read only for closed prints is read once and kept
  // (scripts/lib/psp-page-cache.mjs).
  const pages = { pageCache, closedPrintIds, fetchPsp, source };
  const readFile = (url, format, extraction, extract) => documentCache.read(url, extraction, extract, async () => (await fetchPsp(source, url, pspDocumentFileOptions[format === "xlsm" ? "xlsx" : format])).bytes);

  // 1. The amendments each summary lists.
  const itemsBySummary = new Map();
  for (const summary of plan.summaries) {
    const pageUrl = officialPrintDocumentPageUrl(source.term.number, summary.printNumber, summary.partNumber);
    const budget = summary.printKindId === "3";
    const summaryFile = (html) => {
      const files = listedFiles(html, pageUrl).filter(({ section }) => /^Text$/iu.test(section ?? ""));
      return budget ? files.find(({ format }) => format === "xlsx" || format === "xlsm") : files.find(({ format }) => format === "docx");
    };
    const file = summaryFile(await readPspPage(pages, pageUrl, [summary.printId], (content) => Boolean(summaryFile(content))));
    let items = [];
    if (file) {
      const { value, error } = await readFile(file.url, file.format, budget ? pspDocumentExtractions.xlsxRows : pspDocumentExtractions.docxNumberedParagraphs, budget ? extractXlsxRows : extractDocxNumberedParagraphs);
      if (error) warnings.push(`summary ${summary.printNumber}/${summary.partNumber}: ${file.filename} cannot be read (${error}); its amendments are not used`);
      else items = budget ? budgetAmendmentItems(value) : summaryOfAmendments(value);
    } else {
      quality.summariesWithoutFile += 1;
      warnings.push(`summary ${summary.printNumber}/${summary.partNumber}: no ${budget ? "XLSX" : "DOCX"} file; its amendments are not used`);
    }
    for (const item of items) item.presentedOn ??= summary.presentedOn;
    quality.amendmentItems += items.length;
    quality.committeeItems += items.filter(({ committee }) => committee).length;
    itemsBySummary.set(`${summary.printId}/${summary.partNumber}`, { summary, items, budget });
  }

  // 2. The text and proposers of each listed document.
  const amendments = [];
  // Keyed by print and document, so a document a summary of another print
  // names is still read for its own print.
  const listedNumbers = new Set();
  for (const { summary, items } of itemsBySummary.values()) {
    for (const item of items.filter(({ committee }) => !committee)) {
      // An amendment is presented by someone; a row that names nobody is no
      // presented amendment and is reported.
      if (!item.presenterCz) {
        quality.itemsWithoutPresenter += 1;
        warnings.push(`summary ${summary.printNumber}/${summary.partNumber}: amendment ${item.label} names no presenter; not used`);
        continue;
      }
      for (const number of item.documentNumbers) {
        if (listedNumbers.has(`${summary.printNumber}/${number}`)) continue;
        listedNumbers.add(`${summary.printNumber}/${number}`);
        quality.documentsListed += 1;
        const document = plan.documents.get(number);
        if (!document || document.printNumber !== summary.printNumber) {
          quality.documentsNotInOpenData += 1;
          warnings.push(`SD ${number}: listed in summary ${summary.printNumber}/${summary.partNumber} but not a written amendment to print ${summary.printNumber} in sd.zip; not used`);
          continue;
        }
        const pageUrl = amendmentDocumentPageUrl(source.term.number, number);
        const documentFile = (html) => {
          const files = listedFiles(html, pageUrl);
          return files.find(({ format }) => format === "docx") ?? files.find(({ format }) => format === "doc");
        };
        const file = documentFile(await readPspPage(pages, pageUrl, [summary.printId], (content) => Boolean(documentFile(content))));
        const read = file ? await readFile(file.url, file.format, file.format === "docx" ? pspDocumentExtractions.docxParagraphs : pspDocumentExtractions.docParagraphs, file.format === "docx" ? extractDocxParagraphs : extractDocParagraphs) : null;
        if (!read || read.error) {
          quality.documentsWithoutText += 1;
          warnings.push(`SD ${number}: ${file ? `${file.filename} cannot be read (${read.error})` : "no DOCX or DOC file"}; not used`);
          continue;
        }
        const presentedOn = item.presentedOn;
        const candidates = plan.candidatesOn(presentedOn);
        const heading = proposersOfHeading(read.value, candidates);
        const personIds = [...new Set([document.personId, ...heading.personIds])].sort();
        quality.proposerNames += heading.personIds.length + heading.unmatched.length;
        quality.proposerNamesMisspelt += heading.misspelt.length;
        quality.proposerNamesUnmatched += heading.unmatched.length;
        if (heading.unmatched.length > 0) warnings.push(`SD ${number}: proposer names not matched to an MP in a club on ${presentedOn}: ${heading.unmatched.join("; ")}`);
        if (heading.misspelt.length > 0) warnings.push(`SD ${number}: proposer names matched despite a misspelt surname: ${heading.misspelt.map(({ name, personId, givenName, surname }) => `${name} as ${givenName} ${surname} (${personId})`).join("; ")}`);
        const partyIds = [...new Set(personIds.flatMap((personId) => candidates.find((candidate) => candidate.personId === personId)?.partyIds ?? []))].sort();
        const label = Object.entries(item.parts).filter(([, part]) => part === number).map(([key]) => key)[0] ?? item.label;
        amendments.push({
          documentNumber: number,
          externalPrintId: summary.printId,
          printKindId: summary.printKindId,
          printNumber: summary.printNumber,
          printTitleCz: summary.printTitleCz,
          summaryPartNumber: summary.partNumber,
          label,
          presenterCz: item.presenterCz,
          presentedOn,
          submittedOn: document.submittedOn,
          proposerPersonIds: personIds,
          proposerPartyIds: partyIds,
          unmatchedProposerNames: heading.unmatched,
          parts: partsNamedInAmendment(read.value),
          document: { filename: file.filename, url: file.url },
          pageUrl,
          paragraphs: read.value
        });
      }
    }
  }
  quality.amendments = amendments.length;
  const printsWithSummary = new Set(plan.summaries.map(({ printId }) => printId));
  quality.documentsNotListed = [...plan.documents.values()].filter(({ number, printId, printNumber }) => printsWithSummary.has(printId) && !listedNumbers.has(`${printNumber}/${number}`)).length;
  const amendmentByNumber = new Map(amendments.map((amendment) => [amendment.documentNumber, amendment]));

  // 3. The amendment each vote was on, from the stenographic record.
  const turnsOfVote = (vote) => plan.stenoTurns.filter((turn) => turn.session === vote.sessionNumber && turn.date === vote.date && turn.from !== null && turn.to !== null && turn.from - 10 <= vote.minutes && vote.minutes <= turn.to + 10);
  const neededTurns = new Map();
  for (const vote of plan.amendmentVotes) {
    vote.minutes = minutesOf(vote.time);
    for (const turn of turnsOfVote(vote)) neededTurns.set(`${turn.session}:${turn.turn}`, turn);
  }
  // Consecutive turns of one day are read in order as one text, so a passage
  // that begins in one turn and is announced in the next stays whole; a gap
  // of turns not read starts a new text, so no passage spans it.
  const announcements = new Map();
  for (const turns of consecutiveTurns([...neededTurns.values()])) {
    const turnPages = [];
    for (const turn of turns) {
      const url = stenoTurnUrl(source.term.year, turn.session, turn.turn);
      quality.stenoTurnsRead += 1;
      // A turn is read in every run: whether psp.cz changes a published turn
      // (when it is authorised) is not known (docs/evidence-pipeline.md,
      // Chamber data rules, Closed prints).
      turnPages.push({ url, html: await readPspPage(pages, url, []) });
    }
    for (const announcement of stenoAnnouncements(turnPages)) {
      if (!announcements.has(announcement.voteId)) announcements.set(announcement.voteId, announcement);
    }
  }
  const voteLinks = new Map();
  for (const vote of plan.amendmentVotes) {
    const announcement = announcements.get(vote.voteId);
    const print = itemsBySummary.get(`${vote.printId}/${vote.summaryPartNumber}`);
    const link = !announcement ? { linked: false, reason: "no-steno" } : linkVoteToAmendment(voteReference(announcement.textCz), print?.items ?? [], { budget: print?.budget ?? false });
    const linkedAmendments = link.linked ? link.documentNumbers.map((number) => amendmentByNumber.get(number)) : [];
    if (link.linked && linkedAmendments.some((amendment) => !amendment)) {
      link.linked = false;
      link.reason = "document-without-text";
    }
    if (!link.linked) {
      quality.votesNotLinked[link.reason] = (quality.votesNotLinked[link.reason] ?? 0) + 1;
      continue;
    }
    quality.votesLinked += 1;
    voteLinks.set(vote.voteId, {
      externalPrintId: vote.printId,
      printNumber: print.summary.printNumber,
      documentNumbers: link.documentNumbers,
      label: link.label,
      variant: link.variant,
      presenterCz: link.presenterCz,
      parts: [...new Set(linkedAmendments.flatMap(({ parts }) => parts))].sort(),
      stenoUrl: announcement.url
    });
  }
  return { amendments, voteLinks, warnings, quality };
}
