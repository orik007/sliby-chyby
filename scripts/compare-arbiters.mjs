import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";
import { arbiterOutputJsonSchema, hashEvidencePackage, resolveAssessmentReviews, validateArbiterOutput, validateEvidencePackage } from "./lib/assessment-pipeline.mjs";
import { assessmentRuntimeConfig, estimateRequestTokens, loadAssessmentPrompts, longContextInputTokens } from "./lib/assessment-config.mjs";
import { createStructuredModelResponse } from "./lib/model-provider.mjs";
import { estimateCallCost, log } from "./lib/run-log.mjs";

/**
 * Sends the arbitration of saved assessments, already decided by the
 * configured arbiter, again to other models, and reports where their choice
 * and resolution differ from the saved one. Nothing it writes is a proposal:
 * the report goes to a run artifact for the owner to read, and no saved
 * assessment changes.
 *
 * Usage: node scripts/compare-arbiters.mjs --proposals automation/review-proposals
 *   --models gpt-6.1-terra:max,gpt-6-luna:max --sample 10 --output <dir>
 */

const envPath = resolve(".env");
if (existsSync(envPath)) loadEnvFile(envPath);

const { values: args } = parseArgs({
  options: {
    proposals: { type: "string", default: "automation/review-proposals" },
    models: { type: "string" },
    sample: { type: "string", default: "10" },
    output: { type: "string" }
  }
});
if (!args.models || !args.output) throw new Error("--models and --output are required");
const sampleSize = Number(args.sample);
if (!Number.isInteger(sampleSize) || sampleSize < 1) throw new Error(`--sample must be a positive integer, not ${args.sample}`);
const candidates = args.models.split(",").map((entry) => {
  const [model, reasoningEffort = null] = entry.trim().split(":");
  return { model, reasoningEffort };
});

const runtime = assessmentRuntimeConfig();
const prompts = await loadAssessmentPrompts();
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is required");

// The saved arbitrations of the configured arbiter under the current arbiter
// prompt, below the long-context threshold (above it, another arbiter
// already decides).
const root = resolve(args.proposals);
const saved = [];
for (const promiseId of (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map(({ name }) => name)) {
  for (const entry of await readdir(join(root, promiseId), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, promiseId, entry.name);
    const runPath = join(directory, "assessment-run.json");
    if (!existsSync(runPath)) continue;
    const run = JSON.parse(await readFile(runPath, "utf8"));
    if (run.arbiter?.model !== runtime.arbiterModel || run.prompts?.arbiter?.contentHash !== prompts.arbiter.contentHash) continue;
    saved.push({ promiseId, directory, run });
  }
}
// A stable sample spread over the saved arbitrations: ordered by a hash of
// the directory, so the same files always give the same sample.
const order = (directory) => createHash("sha256").update(directory.slice(root.length)).digest("hex");
const sample = saved.sort((left, right) => order(left.directory).localeCompare(order(right.directory))).slice(0, sampleSize);
log(`arbiter comparison: ${saved.length} saved arbitrations by ${runtime.arbiterModel} under ${prompts.arbiter.version}; ${sample.length} sent again to ${candidates.map(({ model, reasoningEffort }) => `${model}${reasoningEffort ? ` (${reasoningEffort})` : ""}`).join(", ")}`);

// Costs in the report are estimated at Flex prices; a call sent at standard
// processing during a Flex outage costs twice that, and the model-call log
// records each call at the price of the tier that answered it.
const summaryOf = (output, resolution) => ({ choice: output?.choice ?? null, state: resolution?.state ?? null, status: resolution?.status ?? null, reason: resolution?.reason ?? null, selectedReview: resolution?.selectedReview ?? null });
const comparisons = [];
let stoppedBy = null;
for (const { promiseId, directory, run } of sample) {
  if (stoppedBy) break;
  const evidencePackage = validateEvidencePackage(JSON.parse(await readFile(join(directory, "evidence-package.json"), "utf8")));
  const input = { packageHash: hashEvidencePackage(evidencePackage), evidencePackage, reviews: { "assessor-a": run.validatedAssessments["assessor-a"], "assessor-b": run.validatedAssessments["assessor-b"] } };
  const requestTokens = estimateRequestTokens(prompts.arbiter.instructions, input);
  if (requestTokens > longContextInputTokens) continue;
  const comparison = {
    promiseId,
    proposal: directory.slice(root.length + 1),
    requestTokens,
    saved: { model: run.arbiter.model, ...summaryOf(run.arbiter.output, run.resolution), explanationCz: run.arbiter.output?.explanationCz ?? null, estimatedCostUsd: estimateCallCost(run.arbiter.model, run.arbiter.usage, undefined, "flex") },
    candidates: []
  };
  for (const { model, reasoningEffort } of candidates) {
    if (stoppedBy) break;
    const label = `arbiter comparison ${promiseId} ${model}`;
    try {
      const response = await createStructuredModelResponse({ provider: "openai", apiKey, model, reasoningEffort, instructions: prompts.arbiter.instructions, input, name: "slava_arbitration", schema: arbiterOutputJsonSchema, metadata: { project: "sliby-chyby", package_id: evidencePackage.packageId, purpose: "arbiter-comparison" }, logLabel: label });
      if (response.incomplete) throw new Error(`The answer was cut off (${response.incomplete})`);
      validateArbiterOutput(response.output, evidencePackage);
      const resolution = resolveAssessmentReviews(input.reviews["assessor-a"], input.reviews["assessor-b"], evidencePackage, response.output);
      comparison.candidates.push({ model, reasoningEffort, ...summaryOf(response.output, resolution), explanationCz: response.output.explanationCz ?? null, usage: response.usage ?? null, estimatedCostUsd: estimateCallCost(response.model ?? model, response.usage, undefined, "flex"), error: null });
    } catch (error) {
      // A spending limit reached stops the comparison, which reports what it
      // has; any other failure is reported for its arbitration and the
      // comparison goes on.
      if (/reached its limit/.test(error.message)) stoppedBy = error.message;
      else comparison.candidates.push({ model, reasoningEffort, error: error.message });
    }
  }
  if (comparison.candidates.length > 0) comparisons.push(comparison);
}
if (stoppedBy) log(`arbiter comparison stopped: ${stoppedBy}`);

const outputDirectory = resolve(args.output);
await mkdir(outputDirectory, { recursive: true });
const report = { generatedAt: new Date().toISOString(), stoppedBy, savedArbiter: runtime.arbiterModel, arbiterPrompt: prompts.arbiter.version, savedArbitrationCount: saved.length, comparisons };
await writeFile(join(outputDirectory, "arbiter-comparison.json"), `${JSON.stringify(report, null, 2)}\n`);

const same = (left, right) => left.choice === right.choice && left.state === right.state && left.status === right.status;
const lines = [`## Arbiter comparison (${comparisons.length} saved arbitrations by ${runtime.arbiterModel}, ${prompts.arbiter.version})`, "", ...(stoppedBy ? [`Stopped early: ${stoppedBy}`, ""] : []), "| Model | Same choice and resolution | Different | Failed | Estimated USD |", "| --- | ---: | ---: | ---: | ---: |"];
for (const { model, reasoningEffort } of candidates) {
  const answers = comparisons.map((comparison) => ({ saved: comparison.saved, answer: comparison.candidates.find((candidate) => candidate.model === model && candidate.reasoningEffort === reasoningEffort) })).filter(({ answer }) => answer);
  const failed = answers.filter(({ answer }) => answer.error).length;
  const agreeing = answers.filter(({ saved: savedAnswer, answer }) => !answer.error && same(savedAnswer, answer)).length;
  const cost = answers.reduce((sum, { answer }) => sum + (answer.estimatedCostUsd ?? 0), 0);
  lines.push(`| ${model}${reasoningEffort ? ` (${reasoningEffort})` : ""} | ${agreeing} | ${answers.length - agreeing - failed} | ${failed} | ${cost.toFixed(4)} |`);
}
lines.push(`| ${runtime.arbiterModel} (saved) | | | | ${comparisons.reduce((sum, { saved: savedAnswer }) => sum + (savedAnswer.estimatedCostUsd ?? 0), 0).toFixed(4)} |`, "");
for (const comparison of comparisons) {
  const describe = (answer) => (answer.error ? `failed: ${answer.error}` : `${answer.choice} → ${answer.state}${answer.status ? ` (${answer.status})` : ""}${answer.reason ? ` [${answer.reason}]` : ""}`);
  lines.push(`- ${comparison.promiseId} (${comparison.requestTokens} tokens): saved ${describe(comparison.saved)}; ${comparison.candidates.map((candidate) => `${candidate.model}: ${describe(candidate)}`).join("; ")}`);
}
const markdown = `${lines.join("\n")}\n`;
await writeFile(join(outputDirectory, "arbiter-comparison.md"), markdown);
console.log(markdown);
