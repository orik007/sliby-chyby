import { createHash } from "node:crypto";

export const assessmentStatuses = ["fulfilled", "moving-towards", "no-progress", "moving-against", "acting-against"];

export const assessmentOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["promiseId", "status", "evidenceSufficient", "citedEvidenceIds", "explanationCz", "confidence", "uncertainties"],
  properties: {
    promiseId: { type: "string" },
    status: { type: "string", enum: assessmentStatuses },
    evidenceSufficient: { type: "boolean" },
    citedEvidenceIds: { type: "array", items: { type: "string" } },
    explanationCz: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    uncertainties: { type: "array", items: { type: "string" } }
  }
};

export const arbiterOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["choice", "citedEvidenceIds", "explanationCz"],
  properties: {
    choice: { type: "string", enum: ["assessor-a", "assessor-b", "cannot-decide"] },
    citedEvidenceIds: { type: "array", items: { type: "string" } },
    explanationCz: { type: "string" }
  }
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashEvidencePackage(evidencePackage) {
  return createHash("sha256").update(canonicalize(evidencePackage)).digest("hex");
}

export function validateEvidencePackage(evidencePackage) {
  invariant(evidencePackage && typeof evidencePackage === "object", "Evidence package must be an object");
  invariant(evidencePackage.schemaVersion === "1.0.0", "Unsupported evidence package schemaVersion");
  invariant(typeof evidencePackage.packageId === "string" && evidencePackage.packageId.length > 0, "Missing packageId");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(evidencePackage.asOf), "Invalid asOf date");
  invariant(evidencePackage.promise && typeof evidencePackage.promise.id === "string", "Missing promise");
  invariant(typeof evidencePackage.promise.originalTextCz === "string" && evidencePackage.promise.originalTextCz.length > 0, "Missing original promise text");
  invariant(typeof evidencePackage.promise.fulfillmentTest === "string" && evidencePackage.promise.fulfillmentTest.length > 0, "Missing fulfillment test");
  invariant(typeof evidencePackage.promise.contradictionTest === "string" && evidencePackage.promise.contradictionTest.length > 0, "Missing contradiction test");
  invariant(Array.isArray(evidencePackage.evidence) && evidencePackage.evidence.length > 0, "Evidence package must contain evidence");

  const ids = new Set();
  for (const evidence of evidencePackage.evidence) {
    invariant(typeof evidence.id === "string" && evidence.id.length > 0, "Evidence item is missing an ID");
    invariant(!ids.has(evidence.id), `Duplicate evidence ID: ${evidence.id}`);
    ids.add(evidence.id);
    invariant(typeof evidence.url === "string" && /^https:\/\//.test(evidence.url), `Evidence ${evidence.id} must use an HTTPS URL`);
    invariant(typeof evidence.factSummary === "string" && evidence.factSummary.length > 0, `Evidence ${evidence.id} is missing factSummary`);
    invariant(typeof evidence.locator === "string" && evidence.locator.length > 0, `Evidence ${evidence.id} is missing a locator`);
    invariant(/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(evidence.publishedAt), `Evidence ${evidence.id} has an invalid publication date`);
    invariant(evidence.primary === true, `Golden evidence ${evidence.id} must be a primary source`);
    invariant(evidence.publishedAt <= evidencePackage.asOf, `Evidence ${evidence.id} is newer than the package cutoff`);
  }

  invariant(evidencePackage.evidence.some(({ role }) => role === "promise-source"), "Missing promise source");
  invariant(evidencePackage.evidence.some(({ role }) => role === "conduct-evidence"), "Missing conduct evidence");
  return evidencePackage;
}

export function validateAssessmentOutput(output, evidencePackage) {
  validateEvidencePackage(evidencePackage);
  invariant(output && typeof output === "object", "Assessment output must be an object");
  invariant(output.promiseId === evidencePackage.promise.id, "Assessment promiseId does not match the package");
  invariant(assessmentStatuses.includes(output.status), `Unknown assessment status: ${output.status}`);
  invariant(typeof output.evidenceSufficient === "boolean", "Assessment is missing evidenceSufficient");
  invariant(["low", "medium", "high"].includes(output.confidence), "Assessment confidence is invalid");
  invariant(typeof output.explanationCz === "string" && output.explanationCz.length > 0, "Assessment explanation is missing");
  invariant(Array.isArray(output.uncertainties), "Assessment uncertainties must be an array");
  invariant(Array.isArray(output.citedEvidenceIds) && output.citedEvidenceIds.length > 0, "Assessment must cite evidence");

  const allowedIds = new Set(evidencePackage.evidence.map(({ id }) => id));
  for (const evidenceId of output.citedEvidenceIds) invariant(allowedIds.has(evidenceId), `Assessment invented evidence ID: ${evidenceId}`);
  invariant(new Set(output.citedEvidenceIds).size === output.citedEvidenceIds.length, "Assessment cites duplicate evidence IDs");
  return output;
}

export function validateArbiterOutput(output, evidencePackage) {
  invariant(output && typeof output === "object", "Arbiter output must be an object");
  invariant(["assessor-a", "assessor-b", "cannot-decide"].includes(output.choice), "Arbiter choice is invalid");
  invariant(typeof output.explanationCz === "string" && output.explanationCz.length > 0, "Arbiter explanation is missing");
  invariant(Array.isArray(output.citedEvidenceIds), "Arbiter citedEvidenceIds must be an array");
  const allowedIds = new Set(evidencePackage.evidence.map(({ id }) => id));
  for (const evidenceId of output.citedEvidenceIds) invariant(allowedIds.has(evidenceId), `Arbiter invented evidence ID: ${evidenceId}`);
  return output;
}

export function resolveAssessmentReviews(reviewA, reviewB, evidencePackage, arbiter = null) {
  validateAssessmentOutput(reviewA, evidencePackage);
  validateAssessmentOutput(reviewB, evidencePackage);

  if (!reviewA.evidenceSufficient || !reviewB.evidenceSufficient) {
    return { state: "human-review-required", reason: "insufficient-evidence", status: null, selectedReview: null };
  }

  if (reviewA.status === reviewB.status) {
    return { state: "candidate", reason: "assessor-consensus", status: reviewA.status, selectedReview: "consensus" };
  }

  if (!arbiter) return { state: "arbitration-required", reason: "assessor-disagreement", status: null, selectedReview: null };
  validateArbiterOutput(arbiter, evidencePackage);
  if (arbiter.choice === "cannot-decide") return { state: "human-review-required", reason: "arbiter-cannot-decide", status: null, selectedReview: null };
  const selected = arbiter.choice === "assessor-a" ? reviewA : reviewB;
  return { state: "candidate", reason: "arbiter-selection", status: selected.status, selectedReview: arbiter.choice };
}
