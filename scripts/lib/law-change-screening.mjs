import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashText } from "./assessment-config.mjs";
import { invariantValidOutput, requestValidatedOutput, tagAssignmentSchema, taxonomyDefinitionsText, validateTagAssignmentOutput } from "./model-output.mjs";
import { invariant } from "./collector-core.mjs";
import { treatyPrintKindId, versionKeys, versionLabels } from "./print-parts.mjs";
import { resolutionKind, resolutionPartName } from "./government-resolution-kind.mjs";
import { isRegulationKind } from "./regulations.mjs";
import { lawChangeParagraphs, numberedText, textParagraphs, validatePassageOutput } from "./relevant-passages.mjs";

/**
 * The two cheap-model checks on law changes (docs/evidence-pipeline.md):
 * screening every law change (substantive or technical, and its topic tags)
 * and checking whether a routed law change, or an amendment to it, is
 * relevant to one promise, and which of its paragraphs are.
 */
export const screeningPromptVersion = "law-change-screener-v6";
export const relevancePromptVersion = "relevance-check-v8";
export const amendmentRelevancePromptVersion = "amendment-relevance-v2";

// What each prompt keeps of the results of the prompt before it:
// null, or `{ contentHash, rerun }` (docs/evidence-pipeline.md, Audit and
// cost control).
export const screeningPromptKeeps = null;
// The relevance checks keep every pair their earlier prompt found not
// relevant: an answer that says relevant names no paragraphs, fails the
// current output rules, and is asked for again (relevant-passages.mjs).
export const relevancePromptKeeps = { contentHash: "f3b9fd8ce4240bab8d397fc2b1cf71876ae38451e047ec408c08b3b7bde09cb0", rerun: [] };
export const amendmentRelevancePromptKeeps = { contentHash: "7455bc726a4eba5bf53a1883e24c1abbf2abc714b0f71580e1a46bb5e46110a7", rerun: [] };

// The kinds of law change a prompt's `rerun` names.
export const lawChangeKinds = ["chamber-print", "treaty", "government-resolution", "government-regulation", "ministerial-decree"];

export function lawChangeKind(change) {
  if (change.printKindId === resolutionKind || isRegulationKind(change.printKindId)) return change.printKindId;
  return String(change.printKindId) === treatyPrintKindId ? "treaty" : "chamber-print";
}

export function validatePromptKeeps(keeps, contentHash) {
  if (keeps === null) return keeps;
  invariant(/^[0-9a-f]{64}$/u.test(keeps?.contentHash ?? "") && keeps.contentHash !== contentHash, "A prompt keeps the results of another prompt, named by its content hash");
  invariant(Array.isArray(keeps.rerun) && keeps.rerun.every((kind) => lawChangeKinds.includes(kind)) && new Set(keeps.rerun).size === keeps.rerun.length, `A prompt's rerun names kinds of law change: ${lawChangeKinds.join(", ")}`);
  return keeps;
}

async function loadPrompt(version, keeps, root) {
  const instructions = await readFile(resolve(root, `automation/prompts/${version}.md`), "utf8");
  const contentHash = hashText(instructions);
  return { version, contentHash, instructions, keeps: validatePromptKeeps(keeps, contentHash) };
}

export function loadScreeningPrompt(root = process.cwd(), keeps = screeningPromptKeeps) {
  return loadPrompt(screeningPromptVersion, keeps, root);
}

export function loadRelevancePrompt(root = process.cwd(), keeps = relevancePromptKeeps) {
  return loadPrompt(relevancePromptVersion, keeps, root);
}

export function loadAmendmentRelevancePrompt(root = process.cwd(), keeps = amendmentRelevancePromptKeeps) {
  return loadPrompt(amendmentRelevancePromptVersion, keeps, root);
}

/** The content hash of the earlier prompt whose result on this law change the prompt keeps, or null. */
export function keptPromptContentHash(prompt, change) {
  return prompt.keeps && !prompt.keeps.rerun.includes(lawChangeKind(change)) ? prompt.keeps.contentHash : null;
}

const regulationKindLabels = { "government-regulation": "government regulation (nařízení vlády) adopted by the government", "ministerial-decree": "decree (vyhláška) issued by a ministry" };
const printKindLabels = { 1: "government bill", 2: "bill submitted by members, the Senate, or a regional assembly", 3: "state budget bill", 4: "international treaty submitted by the government", 5: "other Chamber print" };


/**
 * The official text of one law change as a model reads it: its print, its
 * heading and title, the act it amends, and the full text, effective date,
 * and context (the wording of the provisions it amends, from e-Sbírka) of
 * every version, then the amendments to it presented in the second reading.
 * A print-wide Senate resolution is not part of one law change and goes
 * only into the evidence package. `numbered` prefixes each paragraph of the
 * versions' texts with its number, as `lawChangeParagraphs` numbers them,
 * for the relevance checks, which name the relevant paragraphs.
 */
export function lawChangeText(change, { numbered = false } = {}) {
  let paragraphCount = 0;
  const textOf = (textCz) => {
    if (!numbered) return textCz;
    const text = numberedText(textCz, paragraphCount);
    paragraphCount += textParagraphs(textCz).length;
    return text;
  };
  // An effective date equal to that of the version before is named, not
  // repeated.
  let previousEffective = null;
  let previousContext = null;
  const versions = versionKeys.filter((version) => change.versions[version]).map((version) => {
    const entry = change.versions[version];
    // A text psp.cz does not publish, read from the act as promulgated
    // (docs/evidence-pipeline.md, Text from the Collection of Laws), says so.
    const label = `Version: ${versionLabels[version]}${entry.promulgatedAct ? ` (psp.cz does not publish it; this is the act as promulgated in the Collection of Laws, zákon č. ${entry.promulgatedAct} Sb., without its annexes)` : ""}`;
    if (entry.removed) return `${label}\nThis part is not in this text: it was removed during the debate.`;
    const effective = !entry.effectiveCz ? ""
      : entry.effectiveCz === previousEffective?.text ? `\nEffective date of this text (účinnost): the same as in the ${versionLabels[previousEffective.version]}.`
      : `\nEffective date of this text (účinnost):\n${entry.effectiveCz}`;
    if (entry.effectiveCz) previousEffective = { version, text: entry.effectiveCz };
    // The context of each version follows its text; a version with the
    // same context as the one before names it instead of repeating it.
    const context = !entry.contextCz ? ""
      : entry.contextCz === previousContext?.text ? `\n\nContext: the same as for the ${versionLabels[previousContext.version]}.`
      : `\n\n${entry.contextCz}`;
    if (entry.contextCz) previousContext = { version, text: entry.contextCz };
    if (entry.sameAs) return `${label}\nThe same text as the ${versionLabels[entry.sameAs]}.${effective}${context}`;
    return entry.textCz === null ? `${label}\nNot available as a DOCX or DOC file; only the print title is known.` : `${label}\n${textOf(entry.textCz)}${effective}${context}`;
  });
  // A government resolution is one law change, the resolution and its
  // annexes as the government adopted them, or, for the plan of legislative
  // work, one of its parts.
  if (change.printKindId === resolutionKind) {
    return [
      `Government resolution (usnesení vlády) adopted by the government: ${change.printTitleCz}`,
      ...(change.heading ? [`Part of the resolution:${resolutionPartName(change).slice(2)}`] : []),
      ...versions
    ].join("\n\n");
  }
  // A government regulation or ministerial decree is one law change from the
  // Collection of Laws, linked to the acts it is issued under.
  if (regulationKindLabels[change.printKindId]) {
    return [
      `Collection of Laws, ${regulationKindLabels[change.printKindId]}: ${change.printTitleCz}`,
      ...(change.enablingActs ?? []).map((act) => `Issued under: zákon č. ${act} Sb.`),
      ...versions
    ].join("\n\n");
  }
  // The amendments MPs presented to the proposed text that concern this
  // part follow its versions (docs/evidence-pipeline.md, Amendment data
  // rules): each amends the bill's text, not the act.
  const amendments = (change.amendments ?? []).map((amendment) => `Amendment ${amendment.label} (parliamentary document ${amendment.documentNumber}), presented in the second reading on ${amendment.presentedOn} by ${amendment.presenterCz}; it amends the proposed text of the bill:\n${amendment.textCz}`);
  return [
    `Chamber print ${change.printNumber} (${printKindLabels[change.printKindId] ?? "Chamber print"}): ${change.printTitleCz}`,
    change.heading ? `Part: ${change.heading} – ${change.titleCz}` : `Law change: ${change.titleCz}`,
    // A group of a divided part (scripts/lib/amending-points.mjs).
    ...(change.section ? [change.section.rest
      ? "This law change is the part's further articles after its amending points; the points are other law changes."
      : "This law change is one group of the part's amending points, those on the provisions its name gives; the part's other points are other law changes."] : []),
    ...(change.addedIn !== "proposed" ? ["This part was added during the debate; it is not in the proposed text."] : []),
    ...change.acts.map(({ act, name }) => `Amended act: zákon č. ${act} Sb.${name ? `, ${name}` : ""}`),
    ...versions,
    ...amendments
  ].join("\n\n");
}

export function buildScreeningBrief(change, taxonomy) {
  return { changeId: change.changeId, text: lawChangeText(change), taxonomyDefinitions: taxonomyDefinitionsText(taxonomy) };
}

function screeningSchema(taxonomy) {
  const tagSchema = tagAssignmentSchema(taxonomy);
  return {
    type: "object",
    properties: {
      substantive: { type: "boolean" },
      reasonCz: { type: "string" },
      ...tagSchema.properties
    },
    required: ["substantive", "reasonCz", ...tagSchema.required],
    additionalProperties: false
  };
}

export function validateScreeningOutput(output, taxonomy) {
  invariantValidOutput(typeof output?.substantive === "boolean", "Screening must say whether the change is substantive");
  invariantValidOutput(typeof output.reasonCz === "string" && output.reasonCz.trim().length > 0, "Screening must give a reason");
  validateTagAssignmentOutput(output, taxonomy);
  return output;
}

// The model input of a screening, as input blocks: the taxonomy first, the
// same for every law change, so it is read from the provider's prompt cache
// after the first screening (docs/evidence-pipeline.md). Its cache
// fingerprint hashes the same blocks.
export function screeningInputBlocks(brief) {
  return [`Topic taxonomy:\n\n${brief.taxonomyDefinitions}`, `Law change ${brief.changeId}:\n\n${brief.text}`];
}

export async function requestScreening({ provider, apiKey, model, brief, taxonomy, prompt }) {
  return requestValidatedOutput({
    provider,
    apiKey,
    model,
    prompt,
    inputBlocks: screeningInputBlocks(brief),
    name: "law_change_screening",
    schema: screeningSchema(taxonomy),
    metadata: { subjectId: brief.changeId, promptVersion: prompt.version },
    logLabel: `screening law change ${brief.changeId}`,
    validate: (output) => validateScreeningOutput(output, taxonomy)
  });
}

/**
 * A law change is substantive when at least one screener says so, or when a
 * screener output is invalid: a single mistaken "technical" never drops it.
 */
export function isSubstantive(screenerA, screenerB) {
  return !screenerA || !screenerB || screenerA.substantive || screenerB.substantive;
}

export function promiseText(promise) {
  return [
    `Promise (the commitment assessed): ${promise.titleCz}`,
    `Exact source wording (Czech): ${promise.originalTextCz}`
  ].join("\n");
}

// A law change may be relevant without naming a paragraph of its own text
// only when it has none; one relevant through an amendment names the
// paragraphs the amendment changes.
export function buildRelevanceBrief(promise, change) {
  const paragraphCount = lawChangeParagraphs(change).length;
  return {
    pairId: `${promise.id}--${change.changeId}`,
    promise: promiseText(promise),
    lawChange: lawChangeText(change),
    numberedLawChange: lawChangeText(change, { numbered: true }),
    paragraphCount,
    mayNameNone: paragraphCount === 0
  };
}

// The model input of a relevance check, as input blocks: the law change
// first, the same for every promise it is checked against, so it is read
// from the provider's prompt cache after the first check
// (docs/evidence-pipeline.md). Its cache fingerprint hashes the blocks
// without the paragraph numbers, which follow from the text by the
// numbering of relevant-passages.mjs; a cached answer names paragraphs by
// that numbering, so changing it needs a new prompt version.
export function relevanceInputBlocks(brief) {
  return [`Law change:\n\n${brief.lawChange}`, brief.promise];
}

export function relevanceRequestBlocks(brief) {
  return [`Law change:\n\n${brief.numberedLawChange}`, brief.promise];
}

const relevanceSchema = {
  type: "object",
  properties: { relevant: { type: "boolean" }, paragraphs: { type: "array", items: { type: "integer" } }, reasonCz: { type: "string" } },
  required: ["relevant", "paragraphs", "reasonCz"],
  additionalProperties: false
};

/** The output rules of the relevance checks of one brief. */
export function relevanceValidator(brief) {
  return (output) => validatePassageOutput(output, brief);
}

// `label` names the call in the run log: the third check says so.
export async function requestRelevance({ provider, apiKey, model, brief, prompt, label = "relevance" }) {
  return requestValidatedOutput({
    provider,
    apiKey,
    model,
    prompt,
    inputBlocks: relevanceRequestBlocks(brief),
    name: "law_change_relevance",
    schema: relevanceSchema,
    metadata: { subjectId: brief.pairId.slice(0, 64), promptVersion: prompt.version },
    logLabel: `${label} ${brief.pairId}`,
    validate: relevanceValidator(brief)
  });
}

/**
 * The check of one promise and one amendment its package would hold
 * (docs/evidence-pipeline.md, step 6): the amendment's text first, the same
 * for every promise, so it is read from the provider's prompt cache after
 * the first promise, then the promise.
 */
export function buildAmendmentRelevanceBrief(promise, { documentNumber, amendment, printNumber, printTitleCz }) {
  const heading = `Amendment ${amendment.label} (parliamentary document ${documentNumber}) to Chamber print ${printNumber}: ${printTitleCz}, presented in the second reading on ${amendment.presentedOn} by ${amendment.presenterCz}; it amends the proposed text of the bill:`;
  const paragraphCount = textParagraphs(amendment.textCz).length;
  return {
    pairId: `${promise.id}--amendment-${documentNumber}`,
    promise: promiseText(promise),
    amendment: `${heading}\n${amendment.textCz}`,
    numberedAmendment: `${heading}\n${numberedText(amendment.textCz)}`,
    paragraphCount,
    mayNameNone: paragraphCount === 0
  };
}

// Hashed for the cache fingerprint; the request carries the numbered text.
export function amendmentRelevanceInputBlocks(brief) {
  return [brief.amendment, brief.promise];
}

export function amendmentRelevanceRequestBlocks(brief) {
  return [brief.numberedAmendment, brief.promise];
}

export async function requestAmendmentRelevance({ provider, apiKey, model, brief, prompt, label = "amendment relevance" }) {
  return requestValidatedOutput({
    provider,
    apiKey,
    model,
    prompt,
    inputBlocks: amendmentRelevanceRequestBlocks(brief),
    name: "amendment_relevance",
    schema: relevanceSchema,
    metadata: { subjectId: brief.pairId.slice(0, 64), promptVersion: prompt.version },
    logLabel: `${label} ${brief.pairId}`,
    validate: relevanceValidator(brief)
  });
}
