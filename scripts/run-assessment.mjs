import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import {
  arbiterOutputJsonSchema,
  assessmentOutputJsonSchema,
  hashAssessmentContent,
  hashAssessmentFingerprint,
  hashEvidencePackage,
  resolveAssessmentReviews,
  resolveAvailableAssessmentReviews,
  validateArbiterOutput,
  validateEvidencePackage
} from "./lib/assessment-pipeline.mjs";
import { assessmentRuntimeConfig, estimateRequestTokens, loadAssessmentPrompts, maxRequestInputTokens } from "./lib/assessment-config.mjs";
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

async function createStructuredResponse({ provider, model, instructions, input, name, schema }, logLabel = null) {
  return createStructuredModelResponse({
    provider,
    apiKey: apiKeyFor(provider),
    model,
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
function cachedResponse(role, request) {
  const label = `${role} ${evidencePackage.promise.id}`;
  return cachedModelResponse({ directory: responseCache, role, keyInput: { assessmentFingerprint, role, request }, request: () => createStructuredResponse(request, label), onReuse: () => log(`${label}: reused the saved response, no new call`) });
}

const assessorInput = { packageHash, evidencePackage };
// Assessor B is called only after A has answered: with the same model both
// send the same request, so B reads the provider's prompt cache and pays a
// tenth for the input they share. Each response is saved as soon as it
// arrives, so a failure of B never loses A.
const rawA = await cachedResponse("assessor-a", { provider: assessorProviderA, model: assessorModelA, instructions: assessorInstructions, input: assessorInput, name: "slava_assessment", schema: assessmentOutputJsonSchema });
const rawB = await cachedResponse("assessor-b", { provider: assessorProviderB, model: assessorModelB, instructions: assessorInstructions, input: assessorInput, name: "slava_assessment", schema: assessmentOutputJsonSchema });

const assessmentPair = resolveAvailableAssessmentReviews(rawA.output, rawB.output, evidencePackage);
const { reviewA, reviewB, validationErrors } = assessmentPair;
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
    rawArbiter = await cachedResponse("arbiter", {
      provider: arbiterProvider,
      model: arbiterModel,
      instructions: arbiterInstructions,
      input: arbiterInput,
      name: "slava_arbitration",
      schema: arbiterOutputJsonSchema
    });
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
    statelessParallelCalls: true,
    assessorProviders: [rawA.provider, rawB.provider],
    assessorModels: [rawA.model, rawB.model],
    sameProvider: rawA.provider === rawB.provider,
    sameModelId: rawA.model === rawB.model
  },
  assessorValidationErrors: validationErrors,
  validatedAssessments: { "assessor-a": reviewA, "assessor-b": reviewB },
  assessorA: rawA,
  assessorB: rawB,
  arbiter: rawArbiter,
  resolution
};

await writeFile(join(outputDirectory, "assessment-run.json"), `${JSON.stringify(auditRecord, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ runId, outputDirectory, assessmentContentHash, assessmentFingerprint, resolution, publicationApproved: false }, null, 2));