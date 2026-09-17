import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashText } from "./assessment-config.mjs";
import { createStructuredModelResponse } from "./model-provider.mjs";
import { hasTag } from "./topic-taxonomy.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export const taggingPromptVersion = "tagger-v1";

export function taggingRuntimeConfig(env = process.env) {
  return {
    provider: env.SLIBY_TAGGING_PROVIDER ?? "openai",
    modelA: env.SLIBY_TAGGING_MODEL_A ?? "gpt-5.6-terra",
    modelB: env.SLIBY_TAGGING_MODEL_B ?? "gpt-5.6-terra",
    concurrency: Number(env.SLIBY_TAGGING_CONCURRENCY ?? "4")
  };
}

export async function loadTaggingPrompt(root = process.cwd()) {
  const instructions = await readFile(resolve(root, `automation/prompts/${taggingPromptVersion}.md`), "utf8");
  return { version: taggingPromptVersion, contentHash: hashText(instructions), instructions };
}

function taxonomyDefinitionsText(taxonomy) {
  return taxonomy.tags
    .map((tag) => [
      `- id: ${tag.id}`,
      `  parent: ${tag.parent ?? "(none)"}`,
      `  label: ${tag.labelEn}`,
      `  assessmentEligible: ${tag.assessmentEligible}`,
      `  czechAliases: ${tag.czechAliases.join(", ")}`,
      `  inclusionExamples: ${tag.inclusionExamples.join(" | ")}`,
      `  exclusionExamples: ${tag.exclusionExamples.join(" | ")}`
    ].join("\n"))
    .join("\n\n");
}

export function buildPromiseTaggingBrief(promise, taxonomy) {
  invariant(typeof promise.id === "string" && promise.id.length > 0, "Promise brief requires an id");
  invariant(typeof promise.originalTextCz === "string" && promise.originalTextCz.length > 0, "Promise brief requires originalTextCz");
  return {
    subjectType: "promise",
    subjectId: promise.id,
    text: [
      `Promise (Czech, exact wording): ${promise.originalTextCz}`,
      promise.atomicClaimCz ? `Atomic claim: ${promise.atomicClaimCz}` : null,
      promise.fulfillmentTest ? `Fulfillment test: ${promise.fulfillmentTest}` : null,
      promise.contradictionTest ? `Contradiction test: ${promise.contradictionTest}` : null
    ].filter(Boolean).join("\n"),
    taxonomyDefinitions: taxonomyDefinitionsText(taxonomy)
  };
}

export function buildSourceTaggingBrief(record, officialDocumentExcerpts, taxonomy) {
  invariant(typeof record.id === "string" && record.id.length > 0, "Source brief requires a record id");
  invariant(typeof record.title === "string" && record.title.length > 0, "Source brief requires a record title");
  return {
    subjectType: "source",
    subjectId: record.id,
    text: [
      `Source title: ${record.title}`,
      `Publisher: ${record.publisher}`,
      `Kind: ${record.kind}`,
      ...(officialDocumentExcerpts ?? []).map((excerpt, index) => `Official document excerpt ${index + 1}: ${excerpt}`)
    ].join("\n"),
    taxonomyDefinitions: taxonomyDefinitionsText(taxonomy)
  };
}

function tagAssignmentSchema(taxonomy) {
  const tagIds = [...taxonomy.tags.map((tag) => tag.id), "unknown"];
  return {
    type: "object",
    properties: {
      tags: { type: "array", items: { type: "string", enum: tagIds } },
      confidence: { type: "number" },
      supportingExcerpts: { type: "array", items: { type: "string" } }
    },
    required: ["tags", "confidence", "supportingExcerpts"],
    additionalProperties: false
  };
}

export function validateTagAssignmentOutput(output, taxonomy) {
  invariant(Array.isArray(output?.tags) && output.tags.length > 0, "Tag assignment must return at least one tag or \"unknown\"");
  for (const tagId of output.tags) {
    invariant(tagId === "unknown" || hasTag(taxonomy, tagId), `Tag assignment referenced an unknown tag id: ${tagId}`);
  }
  if (output.tags.length > 1) {
    invariant(!output.tags.includes("unknown"), "\"unknown\" cannot be combined with other tags");
  }
  invariant(Number.isFinite(output.confidence) && output.confidence >= 0 && output.confidence <= 1, "Tag assignment confidence must be between 0 and 1");
  invariant(Array.isArray(output.supportingExcerpts), "Tag assignment must return supportingExcerpts");
  return output;
}

export async function requestTagAssignment({ provider, apiKey, model, brief, taxonomy, prompt }) {
  const response = await createStructuredModelResponse({
    provider,
    apiKey,
    model,
    instructions: prompt.instructions,
    input: { subjectType: brief.subjectType, subjectId: brief.subjectId, text: brief.text, taxonomyDefinitions: brief.taxonomyDefinitions },
    name: "topic_tag_assignment",
    schema: tagAssignmentSchema(taxonomy),
    metadata: { subjectId: brief.subjectId, promptVersion: prompt.version }
  });
  return {
    subjectId: brief.subjectId,
    provider: response.provider,
    model: response.model,
    promptVersion: prompt.version,
    promptContentHash: prompt.contentHash,
    usage: response.usage,
    output: validateTagAssignmentOutput(response.output, taxonomy)
  };
}
