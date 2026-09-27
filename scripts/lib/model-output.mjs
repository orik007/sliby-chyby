import { createStructuredModelResponse } from "./model-provider.mjs";
import { hasTag } from "./topic-taxonomy.mjs";

// Thrown only when a model output fails validation (an invented tag id, a
// missing reason), so a caller can isolate a single
// invalid *output* from a transport, authentication, or provider failure --
// those must never be silently swallowed the same way, or a missing API key
// or a full outage would look like a run that legitimately found nothing.
export class ModelOutputError extends Error {}

export function invariantValidOutput(condition, message) {
  if (!condition) throw new ModelOutputError(message);
}

// The cheap model pair that screens law changes and checks relevance
// (docs/evidence-pipeline.md).
export function pairedModelRuntimeConfig(env = process.env) {
  return {
    provider: env.SLIBY_TAGGING_PROVIDER ?? "openai",
    modelA: env.SLIBY_TAGGING_MODEL_A ?? "gpt-6-luna",
    modelB: env.SLIBY_TAGGING_MODEL_B ?? "gpt-6-luna",
    concurrency: Number(env.SLIBY_TAGGING_CONCURRENCY ?? "32")
  };
}

export function taxonomyDefinitionsText(taxonomy) {
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

export function tagAssignmentSchema(taxonomy) {
  const tagIds = [...taxonomy.tags.map((tag) => tag.id), "unknown"];
  return {
    type: "object",
    properties: {
      tags: { type: "array", items: { type: "string", enum: tagIds } },
      confidence: { type: "number" }
    },
    required: ["tags", "confidence"],
    additionalProperties: false
  };
}

export function validateTagAssignmentOutput(output, taxonomy) {
  invariantValidOutput(Array.isArray(output?.tags) && output.tags.length > 0, "Tag assignment must return at least one tag or \"unknown\"");
  for (const tagId of output.tags) {
    invariantValidOutput(tagId === "unknown" || hasTag(taxonomy, tagId), `Tag assignment referenced an unknown tag id: ${tagId}`);
  }
  if (output.tags.length > 1) {
    invariantValidOutput(!output.tags.includes("unknown"), "\"unknown\" cannot be combined with other tags");
  }
  invariantValidOutput(Number.isFinite(output.confidence) && output.confidence >= 0 && output.confidence <= 1, "Tag assignment confidence must be between 0 and 1");
  return output;
}

/**
 * One structured call to a cheap model whose output is then validated. The
 * call has already cost tokens when validation fails, so its provider,
 * model, and usage are attached to the ModelOutputError for the run's spend
 * report instead of the paid call vanishing from it.
 */
export async function requestValidatedOutput({ provider, apiKey, model, prompt, input, name, schema, metadata, logLabel, validate }) {
  const response = await createStructuredModelResponse({ provider, apiKey, model, instructions: prompt.instructions, input, name, schema, metadata, logLabel });
  try {
    return {
      provider: response.provider,
      model: response.model,
      promptVersion: prompt.version,
      promptContentHash: prompt.contentHash,
      usage: response.usage,
      output: validate(response.output)
    };
  } catch (error) {
    if (error instanceof ModelOutputError) {
      error.provider = response.provider;
      error.model = response.model;
      error.usage = response.usage;
    }
    throw error;
  }
}
