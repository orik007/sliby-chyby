import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import {
  arbiterOutputJsonSchema,
  assessmentOutputJsonSchema,
  hashEvidencePackage,
  resolveAssessmentReviews,
  validateAssessmentOutput,
  validateArbiterOutput,
  validateEvidencePackage
} from "./lib/assessment-pipeline.mjs";
import { createStructuredModelResponse } from "./lib/model-provider.mjs";

const envPath = resolve(".env");
if (existsSync(envPath)) loadEnvFile(envPath);

const packagePath = resolve(process.argv[2] ?? "automation/golden-cases/ano-eet-2/evidence-package.json");
const validateOnly = process.argv.includes("--validate-only");
const evidencePackage = validateEvidencePackage(JSON.parse(await readFile(packagePath, "utf8")));
const packageHash = hashEvidencePackage(evidencePackage);

if (validateOnly) {
  console.log(JSON.stringify({ valid: true, packageId: evidencePackage.packageId, packageHash }, null, 2));
  process.exit(0);
}

const assessorProviderA = process.env.SLIBY_ASSESSOR_PROVIDER_A ?? "openai";
const assessorProviderB = process.env.SLIBY_ASSESSOR_PROVIDER_B ?? "openai";
const arbiterProvider = process.env.SLIBY_ARBITER_PROVIDER ?? "openai";
const assessorModelA = process.env.SLIBY_ASSESSOR_MODEL_A ?? "gpt-5.6-terra";
const assessorModelB = process.env.SLIBY_ASSESSOR_MODEL_B ?? "gpt-5.6-terra";
const arbiterModel = process.env.SLIBY_ARBITER_MODEL ?? "gpt-5.6-sol";

function apiKeyFor(provider) {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  throw new Error(`No API-key mapping is configured for provider: ${provider}`);
}

const assessorInstructions = await readFile(resolve("automation/prompts/assessor-v1.md"), "utf8");
const arbiterInstructions = await readFile(resolve("automation/prompts/arbiter-v1.md"), "utf8");

async function createStructuredResponse({ provider, model, instructions, input, name, schema }) {
  return createStructuredModelResponse({
    provider,
    apiKey: apiKeyFor(provider),
    model,
    instructions,
    input,
    name,
    schema,
    metadata: { project: "sliby-chyby", package_id: evidencePackage.packageId }
  });
}

const assessorInput = { packageHash, evidencePackage };
const [rawA, rawB] = await Promise.all([
  createStructuredResponse({ provider: assessorProviderA, model: assessorModelA, instructions: assessorInstructions, input: assessorInput, name: "slava_assessment", schema: assessmentOutputJsonSchema }),
  createStructuredResponse({ provider: assessorProviderB, model: assessorModelB, instructions: assessorInstructions, input: assessorInput, name: "slava_assessment", schema: assessmentOutputJsonSchema })
]);

const reviewA = validateAssessmentOutput(rawA.output, evidencePackage);
const reviewB = validateAssessmentOutput(rawB.output, evidencePackage);
let resolution = resolveAssessmentReviews(reviewA, reviewB, evidencePackage);
let rawArbiter = null;

if (resolution.state === "arbitration-required") {
  if (!arbiterModel) throw new Error("SLIBY_ARBITER_MODEL is required because the assessors disagreed");
  rawArbiter = await createStructuredResponse({
    provider: arbiterProvider,
    model: arbiterModel,
    instructions: arbiterInstructions,
    input: { packageHash, evidencePackage, reviews: { "assessor-a": reviewA, "assessor-b": reviewB } },
    name: "slava_arbitration",
    schema: arbiterOutputJsonSchema
  });
  validateArbiterOutput(rawArbiter.output, evidencePackage);
  resolution = resolveAssessmentReviews(reviewA, reviewB, evidencePackage, rawArbiter.output);
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
  methodologyVersion: evidencePackage.methodologyVersion,
  publicationApproved: false,
  independence: {
    statelessParallelCalls: true,
    assessorProviders: [rawA.provider, rawB.provider],
    assessorModels: [rawA.model, rawB.model],
    sameProvider: rawA.provider === rawB.provider,
    sameModelId: rawA.model === rawB.model
  },
  assessorA: rawA,
  assessorB: rawB,
  arbiter: rawArbiter,
  resolution
};

await writeFile(join(outputDirectory, "assessment-run.json"), `${JSON.stringify(auditRecord, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ runId, outputDirectory, resolution, publicationApproved: false }, null, 2));
