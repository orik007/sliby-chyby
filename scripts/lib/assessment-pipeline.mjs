import { createHash } from "node:crypto";

export const assessmentStatuses = ["fulfilled", "moving-towards", "no-progress", "moving-against", "acting-against"];

export const assessmentOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["promiseId", "changeRelevance", "status", "evidenceSufficient", "citedEvidenceIds", "explanationCz", "confidence", "uncertainties"],
  properties: {
    promiseId: { type: "string" },
    changeRelevance: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["evidenceId", "relevant", "reasonCz", "effectCz"],
        properties: { evidenceId: { type: "string" }, relevant: { type: "boolean" }, reasonCz: { type: "string" }, effectCz: { type: "string" } }
      }
    },
    status: { type: "string", enum: assessmentStatuses },
    evidenceSufficient: { type: "boolean" },
    citedEvidenceIds: { type: "array", minItems: 1, items: { type: "string" } },
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

const forbiddenReaderFacingPatterns = [
  /\b(?:fulfilled|moving-towards|no-progress|moving-against|acting-against)\b/i,
  /\b(?:verified-party-vote|verified-party-no-majority|verified-member-bill|verified-government-proposal|assessmentContext|matchBasis)\b/i,
  /\bevidence package\b/i,
  /sponzorsk\p{L}*\s+propojen\p{L}*/iu,
  /\btisk\s+\d+\b/iu
];

export function validateReaderFacingCzech(text, fieldName = "Reader-facing Czech text") {
  invariant(typeof text === "string" && text.trim().length > 0, `${fieldName} is missing`);
  for (const pattern of forbiddenReaderFacingPatterns) {
    invariant(!pattern.test(text), `${fieldName} contains internal or unexplained language: ${pattern.source}`);
  }
  return text;
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

export function hashAssessmentContent(evidencePackage) {
  validateEvidencePackage(evidencePackage);
  const assessableContent = {
    schemaVersion: evidencePackage.schemaVersion,
    methodologyVersion: evidencePackage.methodologyVersion,
    assessmentContext: evidencePackage.assessmentContext,
    promise: evidencePackage.promise,
    // Only a package that leaves out a law change carries the list.
    ...(evidencePackage.excludedLawChanges ? { excludedLawChanges: evidencePackage.excludedLawChanges } : {}),
    evidence: evidencePackage.evidence
  };
  return createHash("sha256").update(canonicalize(assessableContent)).digest("hex");
}

export function hashAssessmentFingerprint({ assessmentContentHash, prompts, runtime }) {
  invariant(/^[a-f0-9]{64}$/.test(assessmentContentHash), "Invalid assessment content hash");
  invariant(prompts?.assessor?.version && /^[a-f0-9]{64}$/.test(prompts.assessor.contentHash), "Invalid assessor prompt identity");
  invariant(prompts?.arbiter?.version && /^[a-f0-9]{64}$/.test(prompts.arbiter.contentHash), "Invalid arbiter prompt identity");
  const runtimeIdentity = {};
  for (const field of ["assessorProviderA", "assessorProviderB", "arbiterProvider", "assessorModelA", "assessorModelB", "arbiterModel"]) {
    invariant(typeof runtime?.[field] === "string" && runtime[field].length > 0, `Missing assessment runtime field: ${field}`);
    runtimeIdentity[field] = runtime[field];
  }
  return createHash("sha256").update(canonicalize({
    fingerprintVersion: "assessment-fingerprint-v1",
    assessmentContentHash,
    prompts: {
      assessor: { version: prompts.assessor.version, contentHash: prompts.assessor.contentHash },
      arbiter: { version: prompts.arbiter.version, contentHash: prompts.arbiter.contentHash }
    },
    runtime: runtimeIdentity
  })).digest("hex");
}

export function validateEvidencePackage(evidencePackage) {
  invariant(evidencePackage && typeof evidencePackage === "object", "Evidence package must be an object");
  invariant(evidencePackage.schemaVersion === "1.0.0", "Unsupported evidence package schemaVersion");
  invariant(typeof evidencePackage.packageId === "string" && evidencePackage.packageId.length > 0, "Missing packageId");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(evidencePackage.asOf), "Invalid asOf date");
  invariant(["live", "closing-audit"].includes(evidencePackage.assessmentContext?.mode), "Evidence package is missing a valid assessmentContext mode");
  invariant(evidencePackage.assessmentContext?.ruleVersion === "period-timing-v2", "Evidence package has an unsupported period timing rule");
  const maintenanceBaseline = evidencePackage.assessmentContext?.maintenanceBaseline;
  invariant(maintenanceBaseline === null || (maintenanceBaseline && typeof maintenanceBaseline === "object"), "Evidence package has an invalid maintenance baseline");
  if (maintenanceBaseline) {
    invariant(typeof maintenanceBaseline.preservedStateCz === "string" && maintenanceBaseline.preservedStateCz.length > 0, "Maintenance baseline is missing the preserved state");
    invariant(typeof maintenanceBaseline.evidenceId === "string" && maintenanceBaseline.evidenceId.length > 0, "Maintenance baseline is missing evidence ID");
  }
  invariant(evidencePackage.promise && typeof evidencePackage.promise.id === "string", "Missing promise");
  invariant(typeof evidencePackage.promise.originalTextCz === "string" && evidencePackage.promise.originalTextCz.length > 0, "Missing original promise text");
  invariant(typeof evidencePackage.promise.titleCz === "string" && evidencePackage.promise.titleCz.length > 0, "Missing promise title");
  invariant(Array.isArray(evidencePackage.evidence) && evidencePackage.evidence.length > 0, "Evidence package must contain evidence");
  // Law changes left out because both assessors of an earlier assessment
  // found them not relevant (scripts/lib/irrelevance-verdicts.mjs).
  if (evidencePackage.excludedLawChanges !== undefined) {
    invariant(Array.isArray(evidencePackage.excludedLawChanges) && evidencePackage.excludedLawChanges.length > 0, "excludedLawChanges must be a non-empty array when present");
    for (const entry of evidencePackage.excludedLawChanges) {
      invariant(typeof entry.evidenceId === "string" && typeof entry.title === "string" && typeof entry.proposalId === "string", "An excluded law change needs its evidence ID, title, and proposal");
      invariant(Array.isArray(entry.reasonsCz) && entry.reasonsCz.length === 2 && entry.reasonsCz.every((reason) => typeof reason === "string"), `Excluded law change ${entry.evidenceId} needs both assessors' reasons`);
      invariant(!evidencePackage.evidence.some(({ id }) => id === entry.evidenceId), `Excluded law change ${entry.evidenceId} is also in the evidence`);
    }
  }

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
  invariant(evidencePackage.evidence.some(({ role }) => role === "law-change"), "Missing law change");
  invariant(evidencePackage.evidence.some(({ role }) => role === "conduct-evidence"), "Missing conduct evidence");
  if (maintenanceBaseline) {
    invariant(evidencePackage.evidence.some(({ id, role }) => id === maintenanceBaseline.evidenceId && role === "maintenance-baseline"), "Maintenance baseline evidence is missing");
  }
  return evidencePackage;
}

export function validateAssessmentOutput(output, evidencePackage) {
  validateEvidencePackage(evidencePackage);
  invariant(output && typeof output === "object", "Assessment output must be an object");
  invariant(output.promiseId === evidencePackage.promise.id, "Assessment promiseId does not match the package");
  invariant(assessmentStatuses.includes(output.status), `Unknown assessment status: ${output.status}`);
  invariant(typeof output.evidenceSufficient === "boolean", "Assessment is missing evidenceSufficient");
  invariant(["low", "medium", "high"].includes(output.confidence), "Assessment confidence is invalid");
  validateReaderFacingCzech(output.explanationCz, "Assessment explanation");
  invariant(Array.isArray(output.uncertainties), "Assessment uncertainties must be an array");
  for (const uncertainty of output.uncertainties) validateReaderFacingCzech(uncertainty, "Assessment uncertainty");
  invariant(Array.isArray(output.citedEvidenceIds) && output.citedEvidenceIds.length > 0, "Assessment must cite evidence");

  const allowedIds = new Set(evidencePackage.evidence.map(({ id }) => id));
  for (const evidenceId of output.citedEvidenceIds) invariant(allowedIds.has(evidenceId), `Assessment invented evidence ID: ${evidenceId}`);
  invariant(new Set(output.citedEvidenceIds).size === output.citedEvidenceIds.length, "Assessment cites duplicate evidence IDs");

  // Every law change in the package gets exactly one relevance verdict.
  const lawChangeIds = evidencePackage.evidence.filter(({ role }) => role === "law-change").map(({ id }) => id);
  invariant(Array.isArray(output.changeRelevance), "Assessment must give a relevance verdict for every law change");
  const verdictIds = output.changeRelevance.map(({ evidenceId }) => evidenceId);
  for (const verdict of output.changeRelevance) {
    invariant(lawChangeIds.includes(verdict.evidenceId), `Relevance verdict names something other than a law change in the package: ${verdict.evidenceId}`);
    invariant(typeof verdict.relevant === "boolean", `Relevance verdict for ${verdict.evidenceId} must say relevant or not`);
    invariant(typeof verdict.reasonCz === "string" && verdict.reasonCz.trim().length > 0, `Relevance verdict for ${verdict.evidenceId} needs a reason`);
    invariant(typeof verdict.effectCz === "string" && (!verdict.relevant || verdict.effectCz.trim().length > 0), `Relevant law change ${verdict.evidenceId} needs its effect, before and after`);
  }
  invariant(new Set(verdictIds).size === verdictIds.length, "Assessment gives a law change more than one relevance verdict");
  for (const evidenceId of lawChangeIds) invariant(verdictIds.includes(evidenceId), `Assessment omits the relevance verdict for law change ${evidenceId}`);
  // Only a relevant law change may support the proposed score.
  const irrelevant = new Set(output.changeRelevance.filter(({ relevant }) => !relevant).map(({ evidenceId }) => evidenceId));
  if (output.evidenceSufficient) {
    for (const evidenceId of output.citedEvidenceIds) invariant(!irrelevant.has(evidenceId), `Assessment cites law change ${evidenceId} it found not relevant`);
  }
  return output;
}

export function validateArbiterOutput(output, evidencePackage) {
  invariant(output && typeof output === "object", "Arbiter output must be an object");
  invariant(["assessor-a", "assessor-b", "cannot-decide"].includes(output.choice), "Arbiter choice is invalid");
  validateReaderFacingCzech(output.explanationCz, "Arbiter explanation");
  invariant(Array.isArray(output.citedEvidenceIds), "Arbiter citedEvidenceIds must be an array");
  const allowedIds = new Set(evidencePackage.evidence.map(({ id }) => id));
  for (const evidenceId of output.citedEvidenceIds) invariant(allowedIds.has(evidenceId), `Arbiter invented evidence ID: ${evidenceId}`);
  return output;
}

/** The validation error of an assessor output, or null when it is valid. */
export function assessmentOutputError(output, evidencePackage) {
  return validateAssessmentAttempt(output, evidencePackage).error;
}

function validateAssessmentAttempt(output, evidencePackage) {
  try {
    return { review: validateAssessmentOutput(output, evidencePackage), error: null };
  } catch (error) {
    return { review: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function resolveAvailableAssessmentReviews(outputA, outputB, evidencePackage) {
  const attemptA = validateAssessmentAttempt(outputA, evidencePackage);
  const attemptB = validateAssessmentAttempt(outputB, evidencePackage);
  const validationErrors = { "assessor-a": attemptA.error, "assessor-b": attemptB.error };

  if (!attemptA.review && !attemptB.review) {
    return { reviewA: null, reviewB: null, validationErrors, resolution: { state: "assessment-failed", reason: "both-assessors-invalid", status: null, selectedReview: null } };
  }

  return {
    reviewA: attemptA.review,
    reviewB: attemptB.review,
    validationErrors,
    resolution: resolveAssessmentReviews(attemptA.review, attemptB.review, evidencePackage)
  };
}

export function resolveAssessmentReviews(reviewA, reviewB, evidencePackage, arbiter = null) {
  if (!reviewA || !reviewB) {
    invariant(reviewA || reviewB, "At least one assessment review is required");
    const availableReview = reviewA ? "assessor-a" : "assessor-b";
    const selected = reviewA ?? reviewB;
    validateAssessmentOutput(selected, evidencePackage);
    if (!arbiter) return { state: "arbitration-required", reason: "single-valid-assessor", status: null, selectedReview: null };
    validateArbiterOutput(arbiter, evidencePackage);
    if (arbiter.choice === "cannot-decide") return { state: "human-review-required", reason: "arbiter-cannot-decide", status: null, selectedReview: null };
    if (arbiter.choice !== availableReview) return { state: "human-review-required", reason: "arbiter-cannot-decide", status: null, selectedReview: null };
    if (!selected.evidenceSufficient) return { state: "human-review-required", reason: "arbiter-selected-insufficient-evidence", status: null, selectedReview: arbiter.choice };
    return { state: "candidate", reason: "arbiter-confirmed-single-assessor", status: selected.status, selectedReview: arbiter.choice };
  }

  validateAssessmentOutput(reviewA, evidencePackage);
  validateAssessmentOutput(reviewB, evidencePackage);
  // Only a different score goes to the arbiter. With the same score, the
  // assessment that finds the evidence sufficient carries the candidate;
  // when neither does, a person reviews it.
  if (reviewA.status === reviewB.status) {
    if (reviewA.evidenceSufficient && reviewB.evidenceSufficient) return { state: "candidate", reason: "assessor-consensus", status: reviewA.status, selectedReview: "consensus" };
    if (!reviewA.evidenceSufficient && !reviewB.evidenceSufficient) return { state: "human-review-required", reason: "insufficient-evidence", status: null, selectedReview: null };
    return { state: "candidate", reason: "assessor-consensus-one-sufficient", status: reviewA.status, selectedReview: reviewA.evidenceSufficient ? "assessor-a" : "assessor-b" };
  }
  if (!arbiter) return { state: "arbitration-required", reason: "assessor-disagreement", status: null, selectedReview: null };
  validateArbiterOutput(arbiter, evidencePackage);
  if (arbiter.choice === "cannot-decide") return { state: "human-review-required", reason: "arbiter-cannot-decide", status: null, selectedReview: null };
  const selected = arbiter.choice === "assessor-a" ? reviewA : reviewB;
  if (!selected.evidenceSufficient) return { state: "human-review-required", reason: "arbiter-selected-insufficient-evidence", status: null, selectedReview: arbiter.choice };
  return { state: "candidate", reason: "arbiter-selection", status: selected.status, selectedReview: arbiter.choice };
}
