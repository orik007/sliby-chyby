import { invariant } from "./collector-core.mjs";

export const printActsExtractorVersion = "print-acts-v3";

// Official print kinds (tisky.zip druh_tisku.unl) whose text can amend acts:
// government bills and member bills.
export const billPrintKindIds = new Set(["1", "2"]);

// A state budget (druh_tisku 3) amends no act; its direct identifier is the
// print kind itself.
export const stateBudgetIdentifier = "cz-print-kind-state-budget";

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

/**
 * Acts amended by an official bill text: an amending article opens with
 * "Zákon č. X/YYYY Sb., <name>, …, se mění …" or "V zákoně č. X/YYYY Sb.,
 * <name>, …". References to other acts elsewhere in the text are ignored.
 */
export function namedActsFromBillParagraphs(paragraphs) {
  const namedActs = [];
  for (const paragraph of paragraphs) {
    const heading = /^Zákona?\s+č\.\s*(\d+)\/(\d{4})\s*Sb\.,([\s\S]*)\bse\s+(?:mění|doplňuje)/i.exec(paragraph);
    const inline = heading ? null : /^V\s+zákoně\s+č\.\s*(\d+)\/(\d{4})\s*Sb\.,?([^;]*)/i.exec(paragraph);
    const match = heading ?? inline;
    if (match) namedActs.push({ act: `${match[1]}/${match[2]}`, name: actName(match[3]) });
  }
  return uniqueNamedActs(namedActs);
}

export function actsFromPrintTitle(title) {
  return namedActsFromPrintTitle(title).map(({ act }) => act);
}

export function actsFromBillParagraphs(paragraphs) {
  return namedActsFromBillParagraphs(paragraphs).map(({ act }) => act);
}

/**
 * One line per amended act with its official name, for a tagging brief.
 */
export function amendedActsExcerpt(namedActs) {
  if (namedActs.length === 0) return null;
  return `Acts amended by the concerned parliamentary print: ${namedActs.map(({ act, name }) => `zákon č. ${act} Sb.${name ? `, ${name}` : ""}`).join("; ")}`;
}

export function printIdentifiers({ kindId, titleActs = [], textActs = [] }) {
  const identifiers = sortedActs([...titleActs, ...textActs]).map(actIdentifier);
  if (kindId === "3") identifiers.push(stateBudgetIdentifier);
  return identifiers;
}

export function emptyPrintActsCache() {
  return { schemaVersion: "1.0.0", extractorVersion: printActsExtractorVersion, prints: {} };
}

export function validatePrintActsCache(cache) {
  invariant(cache?.schemaVersion === "1.0.0", "Unsupported print-acts cache schemaVersion");
  invariant(typeof cache.extractorVersion === "string", "Print-acts cache is missing extractorVersion");
  invariant(cache.prints && typeof cache.prints === "object" && !Array.isArray(cache.prints), "Print-acts cache must contain prints");
  for (const [printId, entry] of Object.entries(cache.prints)) {
    invariant(Number.isInteger(entry.printNumber), `Print-acts cache entry ${printId} needs printNumber`);
    invariant(Array.isArray(entry.documents), `Print-acts cache entry ${printId} needs documents`);
    for (const document of entry.documents) {
      invariant(typeof document.filename === "string" && /^[a-f0-9]{64}$/.test(document.contentHash), `Print-acts cache entry ${printId} has an invalid document`);
    }
    invariant(Array.isArray(entry.textActs) && entry.textActs.every(({ act, name }) => /^\d+\/\d{4}$/.test(act) && (name === null || typeof name === "string")), `Print-acts cache entry ${printId} has invalid textActs`);
  }
  return cache;
}
