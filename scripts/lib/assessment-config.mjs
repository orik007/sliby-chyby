import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const assessorPromptVersion = "assessor-v13";
export const arbiterPromptVersion = "arbiter-v5";

export function semanticRetrievalRuntimeConfig(env = process.env) {
  return {
    provider: env.SLIBY_SEMANTIC_PROVIDER ?? "openai",
    model: env.SLIBY_SEMANTIC_MODEL ?? "text-embedding-3-small",
    dimensions: Number(env.SLIBY_SEMANTIC_DIMENSIONS ?? "256"),
    candidateLimit: Number(env.SLIBY_SEMANTIC_CANDIDATE_LIMIT ?? "3"),
    minimumSimilarity: Number(env.SLIBY_SEMANTIC_MIN_SIMILARITY ?? "0.55")
  };
}

export function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function assessmentRuntimeConfig(env = process.env) {
  return {
    assessorProviderA: env.SLIBY_ASSESSOR_PROVIDER_A ?? "openai",
    assessorProviderB: env.SLIBY_ASSESSOR_PROVIDER_B ?? "openai",
    arbiterProvider: env.SLIBY_ARBITER_PROVIDER ?? "openai",
    assessorModelA: env.SLIBY_ASSESSOR_MODEL_A ?? "gpt-5.6-terra",
    assessorModelB: env.SLIBY_ASSESSOR_MODEL_B ?? "gpt-5.6-terra",
    arbiterModel: env.SLIBY_ARBITER_MODEL ?? "gpt-5.6-sol",
    concurrency: Number(env.SLIBY_ASSESSMENT_CONCURRENCY ?? "4")
  };
}

export async function loadAssessmentPrompts(root = process.cwd()) {
  const assessorInstructions = await readFile(resolve(root, `automation/prompts/${assessorPromptVersion}.md`), "utf8");
  const arbiterInstructions = await readFile(resolve(root, `automation/prompts/${arbiterPromptVersion}.md`), "utf8");
  return {
    assessor: {
      version: assessorPromptVersion,
      contentHash: hashText(assessorInstructions),
      instructions: assessorInstructions
    },
    arbiter: {
      version: arbiterPromptVersion,
      contentHash: hashText(arbiterInstructions),
      instructions: arbiterInstructions
    }
  };
}
