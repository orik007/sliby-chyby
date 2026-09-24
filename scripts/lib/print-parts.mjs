import { cleanText, invariant } from "./collector-core.mjs";

/**
 * Splits a Chamber print's official proposal text into law changes, the unit
 * the pipeline screens, routes, packages, and assesses
 * (docs/evidence-pipeline.md, Chamber data rules).
 */
export const printPartsSplitterVersion = "print-parts-v1";

// A state budget (druh_tisku 3) amends no act; its direct identifier is the
// print kind itself.
export const stateBudgetIdentifier = "cz-print-kind-state-budget";

// The labelled section of a print page whose DOCX file is the proposal text:
// the bill (or state budget) with its explanatory memorandum, or the text of
// a treaty or another print. Other sections (RIA, the consolidated text with
// marked changes, EU compatibility, annexes) are never read.
const proposalSectionLabels = [
  /^Návrh zákona včetně důvodové zprávy$/i,
  /^Návrh, důvodová zpráva, obsah zákona$/i,
  /^Text v českém jazyce$/i,
  /^Text$/i
];

export function actIdentifier(act) {
  const match = /^(\d+)\/(\d{4})$/.exec(act);
  invariant(match, `Invalid act reference: ${act}`);
  return `cz-act-${match[1]}-${match[2]}`;
}

function sortedActs(acts) {
  return [...new Set(acts)].sort((left, right) => {
    const [leftNumber, leftYear] = left.split("/").map(Number);
    const [rightNumber, rightYear] = right.split("/").map(Number);
    return leftYear - rightYear || leftNumber - rightNumber;
  });
}

// The official name that follows an act reference ("…Sb., o pravidlech
// rozpočtové odpovědnosti, ve znění…"), up to the amendment history.
function actName(rest) {
  const text = String(rest ?? "").replace(/^[\s,]+/, "");
  // An amending act's own name begins "kterým se mění …"; elsewhere
  // "… se mění" ends the name.
  const end = /^kterým\s+se\b/.test(text)
    ? /,\s*ve\s+znění|,?\s+a\s+kterým\s+se|;|:/
    : /,\s*ve\s+znění|,?\s+se\s+(?:mění|doplňuje)|,?\s+a\s+kterým\s+se|\s+a\s+(?:další|o\s+změně)|\s*\(|;|:/;
  const name = text
    .split(end)[0]
    .replace(/(?:[\s,]+a)?[\s,]+$/, "")
    .trim();
  return name.length > 0 ? name.slice(0, 200) : null;
}

function uniqueNamedActs(namedActs) {
  const byAct = new Map();
  for (const { act, name } of namedActs) {
    if (!byAct.has(act) || (!byAct.get(act) && name)) byAct.set(act, name ?? null);
  }
  return sortedActs([...byAct.keys()]).map((act) => ({ act, name: byAct.get(act) }));
}

const titleReferencePattern = /(\S+)(?:\s+České\s+národní\s+rady)?\s+č\.\s*(\d+)\/(\d{4})\s*Sb\./g;

/**
 * Acts an official print title amends or repeals, with their official names.
 * A title lists them as "zákon č. X/YYYY Sb., <name>, ve znění …" joined by
 * commas and "a", or as "o změně zákona č. X/YYYY Sb." A reference inside
 * another act's name ("o změně a doplnění zákona č. …", "kterým se mění
 * zákon č. …") or its amendment history ("ve znění zákona č. …") is not an
 * act the print amends.
 */
export function namedActsFromPrintTitle(title) {
  const text = String(title ?? "");
  const references = [...text.matchAll(titleReferencePattern)];
  const amended = [];
  let previousEnd = null;
  for (const match of references) {
    const between = previousEnd === null ? "" : text.slice(previousEnd, match.index);
    const previousNameEnded = previousEnd === null || /ve\s+znění/.test(between);
    const amendedInList = /^zákon$/i.test(match[1]) && !/kterým\s+se\s+mění/.test(between);
    const amendedByChange = /^zákona$/i.test(match[1]) && /o\s+změně\s+$/.test(text.slice(0, match.index)) && previousNameEnded;
    if (!amendedInList && !amendedByChange) continue;
    amended.push(match);
    previousEnd = match.index + match[0].length;
  }
  // An act's name runs to the next amended act.
  return uniqueNamedActs(amended.map((match, index) => ({
    act: `${match[2]}/${match[3]}`,
    name: actName(text.slice(match.index + match[0].length, amended[index + 1]?.index ?? text.length))
  })));
}

const amendingVerbPattern = /(?:mění|doplňuj\p{L}*|vklád\p{L}*|nahrazuj\p{L}*|zrušuj\p{L}*|zní:)/u;
const actReferencePattern = /zákon(?:a|ě|u)?\s+č\.\s*(\d+)\/(\d{4})\s*Sb\.,?/iu;

/**
 * The act one law change amends: the first act reference in its first
 * amending sentence, the first paragraph that names an act ("Zákon č.
 * X/YYYY Sb., …", "V § … zákona č. X/YYYY Sb., …", "Příloha k zákonu č. …")
 * and states an amendment ("mění", "doplňuje", "vkládá", "nahrazuje",
 * "zrušuje", "zní:"). A part that only creates new provisions has none.
 */
export function amendedActOfPart(paragraphs) {
  for (const paragraph of paragraphs) {
    const match = actReferencePattern.exec(paragraph);
    if (!match || !amendingVerbPattern.test(paragraph)) continue;
    return { act: `${match[1]}/${match[2]}`, name: actName(paragraph.slice(match.index + match[0].length)) };
  }
  return null;
}

/**
 * The proposal-text DOCX of a print page: the first DOCX file listed under
 * one of the proposal sections. Returns null when the page has none (for
 * example, only a legacy .doc file).
 */
export function proposalDocumentLink(html, pageUrl) {
  const files = String(html).split("Soubory sněmovního tisku")[1]?.split("</table>")[0] ?? "";
  let section = null;
  const pattern = /<th\b[^>]*>([\s\S]*?)<\/th>|<a\b[^>]*href=["']([^"']*orig2\.sqw[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
  for (const match of files.matchAll(pattern)) {
    if (match[1] !== undefined) {
      section = cleanText(match[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " "), 200);
      continue;
    }
    const filename = cleanText(match[3], 200);
    if (!section || !/\.docx$/i.test(filename) || !proposalSectionLabels.some((label) => label.test(section))) continue;
    const url = new URL(match[2].replace(/&amp;/g, "&"), pageUrl);
    invariant(url.protocol === "https:" && url.hostname === "www.psp.cz", `Official print document redirected outside the PSP allowlist: ${url}`);
    return { filename, url: url.href, sectionLabel: section };
  }
  return null;
}

// "ČÁST PRVNÍ", "ČÁST DVACÁTÁ TŘETÍ", "Část druhá": one or two ordinal
// words, which end in -á or -í.
const partHeadingPattern = /^ČÁST\s+\p{L}+[áí](?:\s+\p{L}+[áí])?$/iu;
const memorandumHeadingPattern = /^důvodová\s+zpráva$/iu;

/**
 * A proposal text without its explanatory memorandum: the text ends at the
 * heading "Důvodová zpráva".
 */
export function proposalBody(paragraphs) {
  invariant(Array.isArray(paragraphs) && paragraphs.length > 0, "A proposal text needs paragraphs");
  const memorandumAt = paragraphs.findIndex((paragraph) => memorandumHeadingPattern.test(paragraph.trim()));
  return memorandumAt > 0 ? paragraphs.slice(0, memorandumAt) : paragraphs;
}

/**
 * Divides a proposal text into its parts. Each "ČÁST …" heading starts a
 * part whose title is the next paragraph; a text without part headings is
 * one part.
 */
export function splitProposalText(paragraphs) {
  const body = proposalBody(paragraphs);
  const starts = body.map((paragraph, index) => (partHeadingPattern.test(paragraph.trim()) ? index : -1)).filter((index) => index >= 0);
  if (starts.length === 0) return [{ heading: null, titleCz: null, paragraphs: body }];
  return starts.map((start, index) => ({
    heading: body[start].trim(),
    titleCz: body[start + 1]?.trim() ?? null,
    paragraphs: body.slice(start, starts[index + 1] ?? body.length)
  }));
}

/**
 * The law changes of one print. With a readable proposal text, each part is
 * one change; a print that is a single change also takes its title's acts.
 * Without a text, the print is one change carrying only its official title.
 */
export function lawChangesOfPrint({ print, document = null, paragraphs = null }) {
  const parts = paragraphs ? splitProposalText(paragraphs) : [{ heading: null, titleCz: null, paragraphs: null }];
  const single = parts.length === 1;
  return parts.map((part, index) => {
    const amended = part.paragraphs ? amendedActOfPart(part.paragraphs) : null;
    const acts = uniqueNamedActs([
      ...(amended ? [amended] : []),
      ...(single ? namedActsFromPrintTitle(print.title) : [])
    ]);
    const identifiers = acts.map(({ act }) => actIdentifier(act));
    if (print.kindId === "3") identifiers.push(stateBudgetIdentifier);
    return {
      changeId: `${print.printId}-${index + 1}`,
      printId: print.printId,
      printNumber: print.number,
      printKindId: print.kindId,
      printTitleCz: print.title,
      printPageUrl: print.pageUrl,
      index: index + 1,
      heading: part.heading,
      titleCz: part.titleCz ?? print.title,
      acts,
      identifiers,
      document: document ? { filename: document.filename, url: document.url, sectionLabel: document.sectionLabel } : null,
      textCz: part.paragraphs ? part.paragraphs.join("\n") : null
    };
  });
}
