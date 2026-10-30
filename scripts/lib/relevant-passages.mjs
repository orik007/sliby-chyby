import { invariantValidOutput } from "./model-output.mjs";
import { versionKeys } from "./print-parts.mjs";

/**
 * The passages of a law change or an amendment that concern one promise
 * (docs/evidence-pipeline.md, steps 6 and 7). The relevance checks read the
 * text with its paragraphs numbered and name the paragraphs that could
 * deliver or contradict the promise; the package then holds only those
 * paragraphs and the context of the provisions they amend.
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
 * Validates a relevance check that names paragraphs: `paragraphs` lists
 * distinct paragraph numbers from 1 to `paragraphCount`. A relevant answer
 * names at least one, unless `mayNameNone` (the text is not available, or
 * the change is relevant only through an amendment to it). A not relevant
 * answer names none; one kept from an earlier prompt that had no
 * `paragraphs` is read as naming none, and a relevant one without them is
 * invalid, so it is asked for again.
 */
export function validatePassageOutput(output, { paragraphCount, mayNameNone }) {
  invariantValidOutput(typeof output?.relevant === "boolean", "Relevance check must say whether the change is relevant");
  invariantValidOutput(typeof output.reasonCz === "string" && output.reasonCz.trim().length > 0, "Relevance check must give a reason");
  if (output.paragraphs === undefined && !output.relevant) return { ...output, paragraphs: [] };
  invariantValidOutput(Array.isArray(output.paragraphs), "Relevance check must list the relevant paragraphs");
  invariantValidOutput(output.paragraphs.every((number) => Number.isInteger(number) && number >= 1 && number <= paragraphCount), `Relevance check names a paragraph outside 1 to ${paragraphCount}`);
  invariantValidOutput(new Set(output.paragraphs).size === output.paragraphs.length, "Relevance check names a paragraph twice");
  invariantValidOutput(output.relevant || output.paragraphs.length === 0, "A check that finds the change not relevant names no paragraph");
  invariantValidOutput(!output.relevant || output.paragraphs.length > 0 || mayNameNone || paragraphCount === 0, "A check that finds the change relevant names its relevant paragraphs");
  return output;
}

/**
 * The decision of the relevance checks of one pair: the two independent
 * checks, and the third, `c`, called only when they do not both give a valid
 * answer and agree. The valid answers vote; the pair is kept when more say
 * relevant than not, and on a tie (no valid answer, or one each way) it is
 * kept, so an invalid output never drops it. The kept paragraphs are those
 * named by every valid answer that says relevant; `paragraphs` is null when
 * no such answer names one, and the whole text is then kept.
 */
export function needsThirdCheck(a, b) {
  return !a || !b || a.relevant !== b.relevant;
}

export function relevanceDecision(a, b, c = null) {
  const votes = [a, b, ...(needsThirdCheck(a, b) ? [c] : [])].filter(Boolean);
  const relevant = votes.filter((vote) => vote.relevant);
  const kept = relevant.length >= votes.length - relevant.length;
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

// A text of at most this many characters is kept whole: leaving part of it
// out saves little and can cut a table row from its header or a point from
// the instruction it belongs to.
export const wholeTextMaxLength = 2_000;

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
 * The paragraphs of each version of a law change kept for a promise, as
 * index sets per version, from the paragraphs `numbers` the relevance checks
 * named (numbered as `lawChangeParagraphs` numbers them on `numbered`, the
 * change as the checks read it, which can hold later versions):
 * - a paragraph with the text of a named one in another version is kept, so
 *   every version shows the same passages;
 * - a kept paragraph that is not an instruction (a quoted new wording, a
 *   list item) keeps the instruction before it, which says what it changes;
 * - a version of at most `wholeTextMaxLength` characters is kept whole;
 * - a version with none kept, when another has some, is kept whole, so the
 *   text a conduct concerns is never left out entirely.
 */
function keptParagraphs(change, numbers, context, numbered) {
  const named = new Set(numbers);
  const numberedParagraphs = lawChangeParagraphs(numbered);
  const namedTexts = new Set(numberedParagraphs.filter(({ number }) => named.has(number)).map(({ textCz }) => textCz.trim()));
  const kept = new Map();
  for (const version of versionKeys) {
    const entry = change.versions[version];
    if (!entry || entry.removed || entry.sameAs || !entry.textCz) continue;
    const paragraphs = textParagraphs(entry.textCz);
    const chosen = new Set();
    if (entry.textCz.length <= wholeTextMaxLength) paragraphs.forEach((_, index) => chosen.add(index));
    const ownNumbers = numberedParagraphs.filter((paragraph) => paragraph.version === version);
    paragraphs.forEach((line, index) => {
      if (named.has(ownNumbers[index]?.number) || namedTexts.has(line.trim())) chosen.add(index);
    });
    const instructions = context?.versions?.[version]?.instructions ?? [];
    const instructionAt = (index) => instructions.some(({ instructionCz }) => isInstruction(paragraphs[index], instructionCz));
    for (const index of [...chosen]) {
      if (instructionAt(index)) continue;
      for (let before = index - 1; before >= 0; before -= 1) {
        if (!instructionAt(before)) continue;
        chosen.add(before);
        break;
      }
    }
    kept.set(version, { paragraphs, chosen });
  }
  if ([...kept.values()].some(({ chosen }) => chosen.size > 0)) {
    for (const { paragraphs, chosen } of kept.values()) if (chosen.size === 0) paragraphs.forEach((_, index) => chosen.add(index));
  }
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
  const kept = keptParagraphs(change, numbers, context, numbered);
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
 * An amendment's text reduced to its paragraphs `numbers` (from 1), or whole
 * when it has at most `wholeTextMaxLength` characters.
 */
export function excerptAmendmentText(textCz, numbers) {
  const paragraphs = textParagraphs(textCz);
  const selected = new Set(textCz.length <= wholeTextMaxLength ? paragraphs.keys() : numbers.map((number) => number - 1));
  return { textCz: excerptText(paragraphs, selected), excerpt: { paragraphCount: paragraphs.length, selectedCount: selected.size } };
}
