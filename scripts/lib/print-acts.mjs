import { invariant } from "./collector-core.mjs";

export const printActsExtractorVersion = "print-acts-v2";

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
  const name = String(rest ?? "")
    .split(/,\s*ve\s+znění|,?\s+se\s+(?:mění|doplňuje)|\s+a\s+(?:další|o\s+změně)|\s*\(|;|:/)[0]
    .replace(/[\s,]+$/, "")
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

/**
 * Acts named in an official print title ("…kterým se mění zákon
 * č. 245/2000 Sb., o státních svátcích…"), with their official names. A bill
 * title names only the acts the bill creates or amends.
 */
export function namedActsFromPrintTitle(title) {
  return uniqueNamedActs([...String(title ?? "").matchAll(/č\.\s*(\d+)\/(\d{4})\s*Sb\.(?:,\s*([^;]*))?/g)]
    .map((match) => ({ act: `${match[1]}/${match[2]}`, name: actName(match[3]) })));
}

/**
 * Acts amended by an official bill text: an amending article opens with
 * "Zákon č. X/YYYY Sb., <name>, …, se mění …" or "V zákoně č. X/YYYY Sb.,
 * <name>, …". References to other acts elsewhere in the text are ignored.
 */
export function namedActsFromBillParagraphs(paragraphs) {
  const namedActs = [];
  for (const paragraph of paragraphs) {
    const heading = /^Zákona?\s+č\.\s*(\d+)\/(\d{4})\s*Sb\.,([\s\S]*?)\bse\s+(?:mění|doplňuje)/i.exec(paragraph);
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
