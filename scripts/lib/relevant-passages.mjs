import { invariantValidOutput } from "./model-output.mjs";
import { versionKeys } from "./print-parts.mjs";

/**
 * The passages of a law change or an amendment that concern one promise
 * (docs/evidence-pipeline.md, steps 6 and 7): the relevance checks read the
 * text with its paragraphs numbered and name the relevant ones; the package
 * then holds only those paragraphs, completed by the rules of step 7, and
 * the context of the provisions they amend.
 */

// The non-empty lines of a text, which are its paragraphs.
export function textParagraphs(textCz) {
  return (textCz ?? "").split("\n").filter((line) => line.trim() !== "");
}

/**
 * The paragraphs of every version of a law change with a text of its own,
 * numbered from 1 across the versions in their order: `[{ number, version,
 * textCz }]`. A removed version, one with the same text as an earlier
 * version, and one known only by its title have none.
 */
export function lawChangeParagraphs(change) {
  const paragraphs = [];
  for (const version of versionKeys) {
    const entry = change.versions[version];
    if (!entry || entry.removed || entry.sameAs || !entry.textCz) continue;
    for (const textCz of textParagraphs(entry.textCz)) paragraphs.push({ number: paragraphs.length + 1, version, textCz });
  }
  return paragraphs;
}

/** A text with each paragraph prefixed by its number, starting after `offset`. */
export function numberedText(textCz, offset = 0) {
  return textParagraphs(textCz).map((line, index) => `[${offset + index + 1}] ${line}`).join("\n");
}

/**
 * Validates a relevance check that names paragraphs (step 6). An answer kept
 * from an earlier prompt has no `paragraphs`: one that says not relevant is
 * read as naming none, one that says relevant is invalid, so it is asked for
 * again.
 */
export function validatePassageOutput(output, { paragraphCount, mayNameNone }) {
  invariantValidOutput(typeof output?.relevant === "boolean", "Relevance check must say whether the change is relevant");
  invariantValidOutput(typeof output.reasonCz === "string" && output.reasonCz.trim().length > 0, "Relevance check must give a reason");
  if (output.paragraphs === undefined && !output.relevant) return { ...output, paragraphs: [] };
  invariantValidOutput(Array.isArray(output.paragraphs), "Relevance check must list the relevant paragraphs");
  invariantValidOutput(output.paragraphs.every((number) => Number.isInteger(number) && number >= 1 && number <= paragraphCount), `Relevance check names a paragraph outside 1 to ${paragraphCount}`);
  invariantValidOutput(new Set(output.paragraphs).size === output.paragraphs.length, "Relevance check names a paragraph twice");
  invariantValidOutput(output.relevant || output.paragraphs.length === 0, "A check that finds the change not relevant names no paragraph");
  invariantValidOutput(!output.relevant || output.paragraphs.length > 0 || mayNameNone, "A check that finds the change relevant names its relevant paragraphs");
  return output;
}

/** Whether the third check is needed: the two do not both answer validly and agree. */
export function needsThirdCheck(a, b) {
  return !a || !b || a.relevant !== b.relevant;
}

/**
 * The decision of the checks of one pair (step 6): dropped only when at least
 * two valid answers say not relevant and they outnumber those that say
 * relevant; `paragraphs` are those named by the answers that say relevant, or
 * null for the whole text.
 */
export function relevanceDecision(a, b, c = null) {
  const votes = [a, b, ...(needsThirdCheck(a, b) ? [c] : [])].filter(Boolean);
  const relevant = votes.filter((vote) => vote.relevant);
  const notRelevant = votes.length - relevant.length;
  const kept = notRelevant < 2 || relevant.length >= notRelevant;
  const named = [...new Set(relevant.flatMap((vote) => vote.paragraphs ?? []))].sort((left, right) => left - right);
  return { kept, paragraphs: kept && named.length > 0 ? named : null };
}

function omissionLine(count) {
  return `[… ${count} ${count === 1 ? "paragraph" : "paragraphs"} not concerning this promise left out …]`;
}

/**
 * The selected paragraphs of a text, in order, each left-out run replaced by
 * one line that says how many paragraphs it held.
 */
export function excerptText(paragraphs, selected) {
  const lines = [];
  let omitted = 0;
  for (const [index, line] of paragraphs.entries()) {
    if (selected.has(index)) {
      if (omitted > 0) lines.push(omissionLine(omitted));
      omitted = 0;
      lines.push(line);
    } else omitted += 1;
  }
  if (omitted > 0) lines.push(omissionLine(omitted));
  return lines.join("\n");
}

// The longest text kept whole (step 7).
export const wholeTextMaxLength = 2_000;

/**
 * For each paragraph inside a quotation that spans paragraphs, the
 * paragraphs that introduce it: the one that opens the quotation and, when
 * that one starts with the quotation mark, the one before it (`… zní:`).
 * Quotation marks are counted as in scripts/lib/amending-instructions.mjs.
 */
function quotationIntroductions(paragraphs) {
  const introductions = paragraphs.map(() => []);
  let opening = null;
  for (const [index, raw] of paragraphs.entries()) {
    const line = raw.trim();
    const opened = (line.match(/„/gu) ?? []).length;
    const closed = (line.match(/“/gu) ?? []).length;
    if (opening !== null) {
      introductions[index] = opening;
      if (closed > opened) opening = null;
      continue;
    }
    if (line.startsWith("„")) {
      // A quotation right after another has the same introduction.
      introductions[index] = index === 0 ? [] : paragraphs[index - 1].trim().startsWith("„") ? [...introductions[index - 1]] : [index - 1];
      if (opened > closed) opening = [...introductions[index], index];
      continue;
    }
    if (opened > closed) opening = [index];
  }
  return introductions;
}

// The kept paragraphs with those that introduce each kept quotation.
function withIntroductions(paragraphs, chosen) {
  const introductions = quotationIntroductions(paragraphs);
  for (const index of [...chosen]) for (const before of introductions[index]) chosen.add(before);
  return chosen;
}

// Whether a paragraph is the instruction a context names. An instruction is
// a paragraph of the text, shortened to 300 characters
// (scripts/lib/amending-instructions.mjs).
function isInstruction(line, instructionCz) {
  const shortened = instructionCz.endsWith("…") ? instructionCz.slice(0, -1) : null;
  return shortened === null ? line.trim() === instructionCz.trim() : line.trim().startsWith(shortened.trim());
}

/**
 * The context of one version reduced to the instructions in the selected
 * paragraphs and the provisions they name.
 */
export function contextOfParagraphs(context, keptParagraphs) {
  if (!context) return context;
  const instructions = context.instructions.filter(({ instructionCz }) => keptParagraphs.some((line) => isInstruction(line, instructionCz)));
  const ids = new Set(instructions.flatMap(({ targets }) => targets.flatMap(({ provisionIds }) => provisionIds ?? [])));
  return { ...context, instructions, provisions: Object.fromEntries(Object.entries(context.provisions).filter(([id]) => ids.has(id))) };
}

/**
 * The paragraphs kept of each version of a law change, as index sets per
 * version, from the paragraphs `numbers` the checks named, numbered on
 * `numbered`, the change as the checks read it (it can hold later versions),
 * completed by the rules of step 7.
 */
function keptParagraphs(change, numbers, numbered) {
  const named = new Set(numbers);
  const numberedParagraphs = lawChangeParagraphs(numbered);
  const namedTexts = new Map();
  for (const { number, version, textCz } of numberedParagraphs) {
    if (!named.has(number)) continue;
    const key = textCz.trim();
    namedTexts.set(key, new Set([...(namedTexts.get(key) ?? []), version]));
  }
  // Named in another version than `version`.
  const namedElsewhere = (line, version) => [...(namedTexts.get(line.trim()) ?? [])].some((other) => other !== version);
  const kept = new Map();
  for (const version of versionKeys) {
    const entry = change.versions[version];
    if (!entry || entry.removed || entry.sameAs || !entry.textCz) continue;
    const paragraphs = textParagraphs(entry.textCz);
    const ownNumbers = numberedParagraphs.filter((paragraph) => paragraph.version === version);
    const chosen = new Set();
    paragraphs.forEach((line, index) => {
      if (entry.textCz.length <= wholeTextMaxLength || named.has(ownNumbers[index]?.number) || namedElsewhere(line, version)) chosen.add(index);
    });
    kept.set(version, { paragraphs, chosen: withIntroductions(paragraphs, chosen) });
  }
  for (const { paragraphs, chosen } of kept.values()) if (chosen.size === 0) paragraphs.forEach((_, index) => chosen.add(index));
  return kept;
}

/**
 * A law change reduced to the paragraphs `keptParagraphs` keeps: each
 * version's `textCz` holds only those paragraphs, and `excerpt` says how many
 * of how many it holds. `context`, the structured context of the change, is
 * reduced to the provisions those paragraphs amend and returned with it.
 * A version with the same text as an earlier one is reduced like it.
 */
export function excerptLawChange(change, numbers, context = null, numbered = change) {
  const kept = keptParagraphs(change, numbers, numbered);
  const versions = {};
  const contextVersions = {};
  for (const version of versionKeys) {
    const entry = change.versions[version];
    if (!entry) continue;
    const source = kept.get(entry.sameAs ?? version);
    if (!source || entry.removed) {
      versions[version] = entry;
      if (context?.versions?.[version]) contextVersions[version] = context.versions[version];
      continue;
    }
    const { paragraphs, chosen } = source;
    const lines = paragraphs.filter((_, index) => chosen.has(index));
    // The context text is written again from the reduced context
    // (scripts/lib/law-context.mjs, withContext).
    const { contextCz, ...rest } = entry;
    versions[version] = entry.sameAs ? rest : { ...rest, textCz: excerptText(paragraphs, chosen), excerpt: { paragraphCount: paragraphs.length, selectedCount: chosen.size } };
    const reduced = contextOfParagraphs(context?.versions?.[version], lines);
    if (reduced?.instructions.length > 0) contextVersions[version] = reduced;
  }
  return { change: { ...change, versions }, context: context ? { ...context, versions: contextVersions } : null };
}

/**
 * An amendment's text reduced to its paragraphs `numbers` (from 1) and those
 * that introduce a kept quotation, or whole when it is short (step 7).
 */
export function excerptAmendmentText(textCz, numbers) {
  const paragraphs = textParagraphs(textCz);
  const selected = textCz.length <= wholeTextMaxLength ? new Set(paragraphs.keys()) : withIntroductions(paragraphs, new Set(numbers.map((number) => number - 1)));
  return { textCz: excerptText(paragraphs, selected), excerpt: { paragraphCount: paragraphs.length, selectedCount: selected.size } };
}
