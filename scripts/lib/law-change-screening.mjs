import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashText } from "./assessment-config.mjs";
import { invariantValidOutput, requestValidatedOutput, tagAssignmentSchema, taxonomyDefinitionsText, validateTagAssignmentOutput } from "./topic-tagger.mjs";
import { versionKeys, versionLabels } from "./print-parts.mjs";

/**
 * The two cheap-model checks on law changes (docs/evidence-pipeline.md):
 * screening every law change (substantive or technical, and its topic tags)
 * and checking whether a routed law change is relevant to one promise.
 */
export const screeningPromptVersion = "law-change-screener-v1";
export const relevancePromptVersion = "relevance-check-v1";

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

const printKindLabels = { 1: "government bill", 2: "member bill", 3: "state budget bill", 4: "international treaty submitted by the government", 5: "other Chamber print" };


/**
 * The official text of one law change as a model reads it: its print, its
 * heading and title, the act it amends, and the full text of every version.
 * A print-wide Senate resolution is not part of one law change and goes
 * only into the evidence package.
 */
export function lawChangeText(change) {
  const versions = versionKeys.filter((version) => change.versions[version]).map((version) => {
    const entry = change.versions[version];
    const label = `Version: ${versionLabels[version]}`;
    if (entry.removed) return `${label}\nThis part is not in this text: it was removed during the debate.`;
    if (entry.sameAs) return `${label}\nThe same text as the ${versionLabels[entry.sameAs]}.`;
    return entry.textCz === null ? `${label}\nNot available as a DOCX file; only the print title is known.` : `${label}\n${entry.textCz}`;
  });
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

export function validateScreeningOutput(output, taxonomy, briefText) {
  invariantValidOutput(typeof output?.substantive === "boolean", "Screening must say whether the change is substantive");
  invariantValidOutput(typeof output.reasonCz === "string" && output.reasonCz.trim().length > 0, "Screening must give a reason");
  validateTagAssignmentOutput(output, taxonomy, briefText);
  return output;
}

export async function requestScreening({ provider, apiKey, model, brief, taxonomy, prompt }) {
  // The taxonomy comes first so the provider can reuse it as a cached
  // prompt prefix across law changes.
  return requestValidatedOutput({
    provider,
    apiKey,
    model,
    prompt,
    input: { taxonomyDefinitions: brief.taxonomyDefinitions, changeId: brief.changeId, text: brief.text },
    name: "law_change_screening",
    schema: screeningSchema(taxonomy),
    metadata: { subjectId: brief.changeId, promptVersion: prompt.version },
    logLabel: `screening law change ${brief.changeId}`,
    validate: (output) => validateScreeningOutput(output, taxonomy, brief.text)
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
    `Promise (Czech, exact wording): ${promise.originalTextCz}`,
    promise.atomicClaimCz ? `Atomic claim: ${promise.atomicClaimCz}` : null,
    `Fulfillment test: ${promise.fulfillmentTest}`,
    `Contradiction test: ${promise.contradictionTest}`
  ].filter(Boolean).join("\n");
}

export function buildRelevanceBrief(promise, change) {
  return { pairId: `${promise.id}--${change.changeId}`, promise: promiseText(promise), lawChange: lawChangeText(change) };
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
    input: { promise: brief.promise, lawChange: brief.lawChange },
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
