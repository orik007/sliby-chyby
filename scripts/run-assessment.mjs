import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import {
  arbiterOutputJsonSchema,
  assessmentOutputError,
  assessmentOutputJsonSchema,
  hashAssessmentContent,
  hashAssessmentFingerprint,
  hashEvidencePackage,
  resolveAssessmentReviews,
  resolveAvailableAssessmentReviews,
  validateArbiterOutput,
  validateEvidencePackage
} from "./lib/assessment-pipeline.mjs";
import { arbiterFor, assessmentRuntimeConfig, estimateRequestTokens, loadAssessmentPrompts, longContextInputTokens, maxRequestInputTokens } from "./lib/assessment-config.mjs";
import { createStructuredModelResponse } from "./lib/model-provider.mjs";
import { cachedModelResponse } from "./lib/response-cache.mjs";
import { log } from "./lib/run-log.mjs";

const envPath = resolve(".env");
if (existsSync(envPath)) loadEnvFile(envPath);

const requestedPackagePath = process.argv[2];
if (!requestedPackagePath || requestedPackagePath.startsWith("--")) {
  throw new Error("An evidence-package path is required");
}
const packagePath = resolve(requestedPackagePath);
const validateOnly = process.argv.includes("--validate-only");
const evidencePackage = validateEvidencePackage(JSON.parse(await readFile(packagePath, "utf8")));
const packageHash = hashEvidencePackage(evidencePackage);
const assessmentContentHash = hashAssessmentContent(evidencePackage);
const runtime = assessmentRuntimeConfig();
const prompts = await loadAssessmentPrompts();
const assessmentFingerprint = hashAssessmentFingerprint({ assessmentContentHash, prompts, runtime });

if (validateOnly) {
  console.log(JSON.stringify({ valid: true, packageId: evidencePackage.packageId, packageHash, assessmentContentHash, assessmentFingerprint }, null, 2));
  process.exit(0);
}

const {
  assessorProviderA,
  assessorProviderB,
  arbiterProvider,
  assessorModelA,
  assessorModelB,
  arbiterModel
} = runtime;

function apiKeyFor(provider) {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  throw new Error(`No API-key mapping is configured for provider: ${provider}`);
}

const assessorInstructions = prompts.assessor.instructions;
const arbiterInstructions = prompts.arbiter.instructions;

async function createStructuredResponse({ provider, model, reasoningEffort = null, instructions, input, name, schema }, logLabel = null) {
  return createStructuredModelResponse({
    provider,
    apiKey: apiKeyFor(provider),
    model,
    reasoningEffort,
    instructions,
    input,
    name,
    schema,
    metadata: { project: "sliby-chyby", package_id: evidencePackage.packageId },
    logLabel
  });
}

// SLIBY_RESPONSE_CACHE (set by run-assessment-batch.mjs) keeps every paid
// response of this assessment until the assessment is saved.
const responseCache = process.env.SLIBY_RESPONSE_CACHE || null;
function cachedResponse(role, request, keep) {
  const label = `${role} ${evidencePackage.promise.id}`;
  return cachedModelResponse({ directory: responseCache, role, keyInput: { assessmentFingerprint, role, request }, request: () => createStructuredResponse(request, label), keep, onReuse: () => log(`${label}: reused the saved response, no new call`) });
}

// An invalid assessor output is never saved for reuse and is asked for
// again from the same assessor, at most `assessorRetries` times in all,
// before the arbiter or a later run takes it (docs/evidence-pipeline.md,
// Assess). Each invalid attempt is written next to the saved responses as
// soon as it arrives, so a resumed run keeps it in the audit record and
// counts it against the retries.
const assessorRetries = 2;
async function invalidAttemptsSaved(role) {
  if (!responseCache) return [];
  const path = join(responseCache, `${role}.invalid.json`);
  return existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : [];
}
async function saveInvalidAttempts(role, attempts) {
  if (!responseCache) return;
  await mkdir(responseCache, { recursive: true });
  await writeFile(join(responseCache, `${role}.invalid.json`), `${JSON.stringify(attempts, null, 2)}\n`);
}
async function validAssessorResponse(role, request) {
  // An answer cut off at the output cap is an invalid output too.
  const outputError = (response) => (response.incomplete ? `The answer was cut off (${response.incomplete})` : assessmentOutputError(response.output, evidencePackage));
  const isValid = (response) => outputError(response) === null;
  const invalidAttempts = await invalidAttemptsSaved(role);
  // Every attempt was used before the run stopped: the last one stands.
  if (invalidAttempts.length > assessorRetries) return { response: invalidAttempts.at(-1).response, invalidAttempts: invalidAttempts.slice(0, -1) };
  let response = await cachedResponse(role, request, isValid);
  while (!isValid(response)) {
    const error = outputError(response);
    invalidAttempts.push({ error, response });
    await saveInvalidAttempts(role, invalidAttempts);
    if (invalidAttempts.length > assessorRetries) break;
    log(`${role} ${evidencePackage.promise.id}: invalid output (${error}); asking again, retry ${invalidAttempts.length} of ${assessorRetries}`);
    response = await cachedResponse(role, request, isValid);
  }
  // The last invalid response is the assessor's answer, not a retried attempt.
  if (!isValid(response)) invalidAttempts.pop();
  return { response, invalidAttempts };
}

const assessorInput = { packageHash, evidencePackage };
// Assessor B is called only after A has answered: with the same model both
// send the same request, so B reads the provider's prompt cache and pays a
// tenth for the input they share. Each valid response is saved as soon as
// it arrives, so a failure of B never loses A.
const assessorA = await validAssessorResponse("assessor-a", { provider: assessorProviderA, model: assessorModelA, instructions: assessorInstructions, input: assessorInput, name: "slava_assessment", schema: assessmentOutputJsonSchema });
const assessorB = await validAssessorResponse("assessor-b", { provider: assessorProviderB, model: assessorModelB, instructions: assessorInstructions, input: assessorInput, name: "slava_assessment", schema: assessmentOutputJsonSchema });
const rawA = assessorA.response;
const rawB = assessorB.response;

const assessmentPair = resolveAvailableAssessmentReviews(rawA.output, rawB.output, evidencePackage);
const { reviewA, reviewB, validationErrors } = assessmentPair;
// A cut-off answer has no output to validate; its error names the cut-off.
for (const [role, raw] of [["assessor-a", rawA], ["assessor-b", rawB]]) if (raw.incomplete) validationErrors[role] = `The answer was cut off (${raw.incomplete})`;
let resolution = assessmentPair.resolution;
let rawArbiter = null;

if (resolution.state === "arbitration-required") {
  if (!arbiterModel) throw new Error("SLIBY_ARBITER_MODEL is required because the assessors disagreed");
  const arbiterInput = { packageHash, evidencePackage, reviews: { "assessor-a": reviewA, "assessor-b": reviewB } };
  // The arbiter also reads both reviews, so its request is checked against
  // the input limit only now; a larger one goes to human review uncalled.
  const arbiterRequestTokens = estimateRequestTokens(arbiterInstructions, arbiterInput);
  if (arbiterRequestTokens > maxRequestInputTokens) {
    log(`arbiter ${evidencePackage.promise.id}: request of about ${arbiterRequestTokens} tokens exceeds ${maxRequestInputTokens}; not called, human review`);
    resolution = { state: "human-review-required", reason: "arbiter-input-too-large", status: null, selectedReview: null };
  } else {
    const { model, reasoningEffort } = arbiterFor(runtime, arbiterRequestTokens);
    if (model !== arbiterModel) log(`arbiter ${evidencePackage.promise.id}: request of about ${arbiterRequestTokens} tokens is above ${longContextInputTokens}; calling ${model}${reasoningEffort ? ` with ${reasoningEffort} reasoning effort` : ""}`);
    rawArbiter = await cachedResponse("arbiter", {
      provider: arbiterProvider,
      model,
      ...(reasoningEffort ? { reasoningEffort } : {}),
      instructions: arbiterInstructions,
      input: arbiterInput,
      name: "slava_arbitration",
      schema: arbiterOutputJsonSchema
    }, (response) => {
      try {
        validateArbiterOutput(response.output, evidencePackage);
        return true;
      } catch {
        return false;
      }
    });
    if (rawArbiter.incomplete) throw new Error(`The arbiter's answer was cut off (${rawArbiter.incomplete})`);
    validateArbiterOutput(rawArbiter.output, evidencePackage);
    resolution = resolveAssessmentReviews(reviewA, reviewB, evidencePackage, rawArbiter.output);
  }
}

const now = new Date();
const runId = `${now.toISOString().replaceAll(":", "-").replace(".", "-")}--${packageHash.slice(0, 12)}`;
const requestedOutputRoot = process.argv[3] && !process.argv[3].startsWith("--") ? resolve(process.argv[3]) : resolve("automation/runs", basename(dirname(packagePath)));
const outputDirectory = join(requestedOutputRoot, runId);
await mkdir(outputDirectory, { recursive: true });

const auditRecord = {
  schemaVersion: "1.0.0",
  runId,
  evaluatedAt: now.toISOString(),
  packagePath: relative(process.cwd(), packagePath).replaceAll("\\", "/"),
  packageHash,
  assessmentContentHash,
  assessmentFingerprint,
  methodologyVersion: evidencePackage.methodologyVersion,
  promiseId: evidencePackage.promise.id,
  prompts: {
    assessor: { version: prompts.assessor.version, contentHash: prompts.assessor.contentHash },
    arbiter: { version: prompts.arbiter.version, contentHash: prompts.arbiter.contentHash }
  },
  publicationApproved: false,
  independence: {
    // Each call is stateless (nothing is stored at the provider); B is
    // called after A has answered, with the same request.
    statelessCalls: true,
    callOrder: ["assessor-a", "assessor-b"],
    assessorProviders: [rawA.provider, rawB.provider],
    assessorModels: [rawA.model, rawB.model],
    sameProvider: rawA.provider === rawB.provider,
    sameModelId: rawA.model === rawB.model
  },
  assessorValidationErrors: validationErrors,
  // The invalid outputs that were asked for again, each with its error.
  invalidAssessorAttempts: { "assessor-a": assessorA.invalidAttempts, "assessor-b": assessorB.invalidAttempts },
  validatedAssessments: { "assessor-a": reviewA, "assessor-b": reviewB },
  assessorA: rawA,
  assessorB: rawB,
  arbiter: rawArbiter,
  resolution
};

await writeFile(join(outputDirectory, "assessment-run.json"), `${JSON.stringify(auditRecord, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ runId, outputDirectory, assessmentContentHash, assessmentFingerprint, resolution, publicationApproved: false }, null, 2));