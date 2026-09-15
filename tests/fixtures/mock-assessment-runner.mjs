import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { assessmentRuntimeConfig, loadAssessmentPrompts } from "../../scripts/lib/assessment-config.mjs";
import { hashAssessmentContent, hashAssessmentFingerprint, hashEvidencePackage, validateEvidencePackage } from "../../scripts/lib/assessment-pipeline.mjs";

const [packagePath, outputRoot] = process.argv.slice(2);
const evidencePackage = validateEvidencePackage(JSON.parse(await readFile(resolve(packagePath), "utf8")));
const prompts = await loadAssessmentPrompts();
const runtime = assessmentRuntimeConfig();
const packageHash = hashEvidencePackage(evidencePackage);
const assessmentContentHash = hashAssessmentContent(evidencePackage);
const assessmentFingerprint = hashAssessmentFingerprint({ assessmentContentHash, prompts, runtime });
const failed = evidencePackage.promise.id === "failed-promise" && evidencePackage.asOf === "2026-09-10";
const evaluatedAt = `${evidencePackage.asOf}T12:00:00.000Z`;
const outputDirectory = join(resolve(outputRoot), `${evidencePackage.promise.id}-${evidencePackage.asOf}`);
await mkdir(outputDirectory, { recursive: true });

const review = {
  promiseId: evidencePackage.promise.id,
  status: "moving-towards",
  evidenceSufficient: true,
  citedEvidenceIds: evidencePackage.evidence.map(({ id }) => id),
  explanationCz: "Strana provedla ověřený krok související s tímto slibem.",
  confidence: "high",
  uncertainties: []
};
const auditRecord = {
  schemaVersion: "1.0.0",
  runId: `mock-${evidencePackage.asOf}-${packageHash.slice(0, 12)}`,
  evaluatedAt,
  packageHash,
  assessmentContentHash,
  assessmentFingerprint,
  promiseId: evidencePackage.promise.id,
  publicationApproved: false,
  assessorValidationErrors: failed ? { "assessor-a": "invalid", "assessor-b": "invalid" } : {},
  validatedAssessments: failed ? { "assessor-a": null, "assessor-b": null } : { "assessor-a": review, "assessor-b": review },
  arbiter: null,
  resolution: failed
    ? { state: "assessment-failed", reason: "both-assessors-invalid", status: null, selectedReview: null }
    : { state: "candidate", reason: "assessor-consensus", status: "moving-towards", selectedReview: "consensus" }
};
await writeFile(join(outputDirectory, "assessment-run.json"), `${JSON.stringify(auditRecord, null, 2)}\n`);
console.log(JSON.stringify({ outputDirectory, assessmentContentHash, assessmentFingerprint }));
