import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const assessorPromptVersion = "assessor-v19";
export const arbiterPromptVersion = "arbiter-v12";
export const scoringRulePath = "docs/scoring.md";

// The assessor and arbiter models read at most 1,050,000 tokens, their
// answer of up to 128,000 tokens included (OpenAI model documentation,
// verified 26 September 2026), so a request can carry at most 922,000 input
// tokens, instructions and input together; a larger one cannot be sent, is
// reported for human review, and is never trimmed. A request above 272,000
// input tokens is sent at the long-context price
// (automation/model-prices.json).
export const maxRequestInputTokens = 922_000;

// Run 56's 1,110 screening requests had 2.78 to 4.17 characters per billed
// input token, the fewest in the largest legal texts, so a request is
// estimated at 2.5 characters per token to stay below the limit.
export const charactersPerToken = 2.5;

export function estimateTokens(text) {
  return Math.ceil(text.length / charactersPerToken);
}

// The input of a model call is sent as JSON text.
export function estimateRequestTokens(instructions, input) {
  return estimateTokens(instructions) + estimateTokens(JSON.stringify(input));
}

export function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function assessmentRuntimeConfig(env = process.env) {
  return {
    assessorProviderA: env.SLIBY_ASSESSOR_PROVIDER_A ?? "openai",
    assessorProviderB: env.SLIBY_ASSESSOR_PROVIDER_B ?? "openai",
    arbiterProvider: env.SLIBY_ARBITER_PROVIDER ?? "openai",
    assessorModelA: env.SLIBY_ASSESSOR_MODEL_A ?? "gpt-6-luna",
    assessorModelB: env.SLIBY_ASSESSOR_MODEL_B ?? "gpt-6-luna",
    arbiterModel: env.SLIBY_ARBITER_MODEL ?? "gpt-6.1-sol",
    concurrency: Number(env.SLIBY_ASSESSMENT_CONCURRENCY ?? "16")
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
