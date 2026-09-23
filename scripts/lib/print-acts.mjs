import { invariant } from "./collector-core.mjs";

export const printActsExtractorVersion = "print-acts-v1";

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

/**
 * Acts named in an official print title ("…kterým se mění zákon
 * č. 245/2000 Sb.…", "…a o změně zákona č. 526/1990 Sb.…"). A bill title
 * names only the acts the bill creates or amends.
 */
export function actsFromPrintTitle(title) {
  return sortedActs([...String(title ?? "").matchAll(/č\.\s*(\d+)\/(\d{4})\s*Sb\./g)].map((match) => `${match[1]}/${match[2]}`));
}

/**
 * Acts amended by an official bill text: an amending article opens with
 * "Zákon č. X/YYYY Sb., …, se mění …" or "V zákoně č. X/YYYY Sb. …".
 * References to other acts elsewhere in the text are ignored.
 */
export function actsFromBillParagraphs(paragraphs) {
  const acts = [];
  for (const paragraph of paragraphs) {
    const match = /^Zákona?\s+č\.\s*(\d+)\/(\d{4})\s*Sb\.,[\s\S]*?\bse\s+(?:mění|doplňuje)/i.exec(paragraph)
      ?? /^V\s+zákoně\s+č\.\s*(\d+)\/(\d{4})\s*Sb\./i.exec(paragraph);
    if (match) acts.push(`${match[1]}/${match[2]}`);
  }
  return sortedActs(acts);
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
    invariant(Array.isArray(entry.textActs) && entry.textActs.every((act) => /^\d+\/\d{4}$/.test(act)), `Print-acts cache entry ${printId} has invalid textActs`);
  }
  return cache;
}
