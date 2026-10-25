import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const assessorPromptVersion = "assessor-v25";
export const arbiterPromptVersion = "arbiter-v18";
export const scoringRulePath = "docs/scoring.md";

// The models read at most 1,050,000 tokens, their answer included (OpenAI
// model documentation, verified 26 September 2026). Every answer is capped
// at 48,000 tokens, its reasoning included: the longest of the 1,456
// assessor answers of runs 72 to 75 took 20,194. A request can therefore
// carry at most 1,002,000 input tokens, instructions and input together. A
// larger evidence package is fitted by leaving out part of its context,
// never its text, and only one still too large without any context is
// reported for human review (docs/evidence-pipeline.md, Package). A request
// above 272,000 input tokens is sent at the long-context price
// (automation/model-prices.json).
export const contextWindowTokens = 1_050_000;
export const maxOutputTokens = 48_000;
export const maxRequestInputTokens = contextWindowTokens - maxOutputTokens;
export const longContextInputTokens = 272_000;

// The arbiter reads the package with both reviews, so a package is fitted
// with room left for them: both reviews of run 75 took at most 11,840 tokens
// (38 law changes), and its largest packages have 58.
export const arbiterReviewReserveTokens = 32_000;
export const maxPackageRequestTokens = maxRequestInputTokens - arbiterReviewReserveTokens;

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

// The reasoning efforts the OpenAI Responses API accepts; which ones a model
// supports is on its model page. Unset, a model uses its default.
const reasoningEfforts = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
function reasoningEffortOf(value) {
  if (!value) return null;
  if (!reasoningEfforts.includes(value)) throw new Error(`Unknown reasoning effort: ${value}`);
  return value;
}

export function assessmentRuntimeConfig(env = process.env) {
  return {
    assessorProviderA: env.SLIBY_ASSESSOR_PROVIDER_A ?? "openai",
    assessorProviderB: env.SLIBY_ASSESSOR_PROVIDER_B ?? "openai",
    arbiterProvider: env.SLIBY_ARBITER_PROVIDER ?? "openai",
    assessorModelA: env.SLIBY_ASSESSOR_MODEL_A ?? "gpt-6-luna",
    assessorModelB: env.SLIBY_ASSESSOR_MODEL_B ?? "gpt-6-luna",
    arbiterModel: env.SLIBY_ARBITER_MODEL ?? "gpt-6.1-sol",
    longContextArbiterModel: env.SLIBY_LONG_CONTEXT_ARBITER_MODEL || null,
    longContextArbiterReasoningEffort: reasoningEffortOf(env.SLIBY_LONG_CONTEXT_ARBITER_REASONING_EFFORT),
    concurrency: Number(env.SLIBY_ASSESSMENT_CONCURRENCY ?? "16")
  };
}

// The arbiter of a request above the long-context threshold is
// `longContextArbiterModel`, with `longContextArbiterReasoningEffort`, when
// one is set (docs/evidence-pipeline.md, Assess). Neither is part of the
// assessment fingerprint, so setting them never reassesses a package; the
// audit record keeps the model that answered and its reasoning effort.
export function arbiterFor(runtime, requestTokens) {
  return requestTokens > longContextInputTokens && runtime.longContextArbiterModel
    ? { model: runtime.longContextArbiterModel, reasoningEffort: runtime.longContextArbiterReasoningEffort }
    : { model: runtime.arbiterModel, reasoningEffort: null };
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
