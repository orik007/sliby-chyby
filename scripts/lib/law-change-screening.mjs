import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashText } from "./assessment-config.mjs";
import { invariantValidOutput, requestValidatedOutput, tagAssignmentSchema, taxonomyDefinitionsText, validateTagAssignmentOutput } from "./model-output.mjs";
import { versionKeys, versionLabels } from "./print-parts.mjs";

/**
 * The two cheap-model checks on law changes (docs/evidence-pipeline.md):
 * screening every law change (substantive or technical, and its topic tags)
 * and checking whether a routed law change is relevant to one promise.
 */
export const screeningPromptVersion = "law-change-screener-v5";
export const relevancePromptVersion = "relevance-check-v6";

async function loadPrompt(version, root) {
  const instructions = await readFile(resolve(root, `automation/prompts/${version}.md`), "utf8");
  return { version, contentHash: hashText(instructions), instructions };
}

export function loadScreeningPrompt(root = process.cwd()) {
  return loadPrompt(screeningPromptVersion, root);
}

export function loadRelevancePrompt(root = process.cwd()) {
  return loadPrompt(relevancePromptVersion, root);
}

const regulationKindLabels = { "government-regulation": "government regulation (nařízení vlády) adopted by the government", "ministerial-decree": "decree (vyhláška) issued by a ministry" };
const printKindLabels = { 1: "government bill", 2: "bill submitted by members, the Senate, or a regional assembly", 3: "state budget bill", 4: "international treaty submitted by the government", 5: "other Chamber print" };


/**
 * The official text of one law change as a model reads it: its print, its
 * heading and title, the act it amends, and the full text, effective date,
 * and context (the wording of the provisions it amends, from e-Sbírka) of
 * every version.
 * A print-wide Senate resolution is not part of one law change and goes
 * only into the evidence package.
 */
export function lawChangeText(change) {
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
    return entry.textCz === null ? `${label}\nNot available as a DOCX or DOC file; only the print title is known.` : `${label}\n${entry.textCz}${effective}${context}`;
  });
  // A government resolution is one law change: the resolution and its
  // annexes, as the government adopted them.
  if (change.printKindId === "government-resolution") {
    return [`Government resolution (usnesení vlády) adopted by the government: ${change.printTitleCz}`, ...versions].join("\n\n");
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
  return [
    `Chamber print ${change.printNumber} (${printKindLabels[change.printKindId] ?? "Chamber print"}): ${change.printTitleCz}`,
    change.heading ? `Part: ${change.heading} – ${change.titleCz}` : `Law change: ${change.titleCz}`,
    ...(change.addedIn !== "proposed" ? ["This part was added during the debate; it is not in the proposed text."] : []),
    ...change.acts.map(({ act, name }) => `Amended act: zákon č. ${act} Sb.${name ? `, ${name}` : ""}`),
    ...versions
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

export function buildRelevanceBrief(promise, change) {
  return { pairId: `${promise.id}--${change.changeId}`, promise: promiseText(promise), lawChange: lawChangeText(change) };
}

// The model input of a relevance check, as input blocks: the law change
// first, the same for every promise it is checked against, so it is read
// from the provider's prompt cache after the first check
// (docs/evidence-pipeline.md). Its cache fingerprint hashes the same blocks.
export function relevanceInputBlocks(brief) {
  return [`Law change:\n\n${brief.lawChange}`, brief.promise];
}

const relevanceSchema = {
  type: "object",
  properties: { relevant: { type: "boolean" }, reasonCz: { type: "string" } },
  required: ["relevant", "reasonCz"],
  additionalProperties: false
};

export function validateRelevanceOutput(output) {
  invariantValidOutput(typeof output?.relevant === "boolean", "Relevance check must say whether the change is relevant");
  invariantValidOutput(typeof output.reasonCz === "string" && output.reasonCz.trim().length > 0, "Relevance check must give a reason");
  return output;
}

export async function requestRelevance({ provider, apiKey, model, brief, prompt }) {
  return requestValidatedOutput({
    provider,
    apiKey,
    model,
    prompt,
    inputBlocks: relevanceInputBlocks(brief),
    name: "law_change_relevance",
    schema: relevanceSchema,
    metadata: { subjectId: brief.pairId.slice(0, 64), promptVersion: prompt.version },
    logLabel: `relevance ${brief.pairId}`,
    validate: validateRelevanceOutput
  });
}

/**
 * A promise and law change are kept when at least one check says relevant,
 * or when a check output is invalid; both must say "not relevant" to drop it.
 */
export function isKeptByRelevance(checkA, checkB) {
  return !checkA || !checkB || checkA.relevant || checkB.relevant;
}
