import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const assessorPromptVersion = "assessor-v17";
export const arbiterPromptVersion = "arbiter-v9";
export const scoringRulePath = "docs/scoring.md";

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

// The assessors and the arbiter each get their own prompt followed by the
// canonical scoring rule, unchanged. The content hash covers both, so a
// change to the rule changes every assessment fingerprint.
export async function loadAssessmentPrompts(root = process.cwd()) {
  const scoringRule = await readFile(resolve(root, scoringRulePath), "utf8");
  const withScoringRule = (prompt) => `${prompt}\n${scoringRule}`;
  const assessorInstructions = withScoringRule(await readFile(resolve(root, `automation/prompts/${assessorPromptVersion}.md`), "utf8"));
  const arbiterInstructions = withScoringRule(await readFile(resolve(root, `automation/prompts/${arbiterPromptVersion}.md`), "utf8"));
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
