import { assessmentStatuses, hashAssessmentContent, hashAssessmentFingerprint, hashEvidencePackage, validateEvidencePackage } from "./assessment-pipeline.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export const reviewManifestSchemaVersion = "1.0.0";
export const assessmentFingerprintVersion = "assessment-fingerprint-v1";

export function emptyReviewManifest() {
  return {
    schemaVersion: reviewManifestSchemaVersion,
    fingerprintVersion: assessmentFingerprintVersion,
    publicationApproved: false,
    proposals: []
  };
}

export function validateReviewManifest(manifest) {
  invariant(manifest && typeof manifest === "object", "Review manifest must be an object");
  invariant(manifest.schemaVersion === reviewManifestSchemaVersion, "Unsupported review manifest schemaVersion");
  invariant(manifest.fingerprintVersion === assessmentFingerprintVersion, "Unsupported assessment fingerprint version");
  invariant(manifest.publicationApproved === false, "Review manifest must remain unpublished");
  invariant(Array.isArray(manifest.proposals), "Review manifest proposals must be an array");
  const proposalIds = new Set();
  const fingerprints = new Set();
  for (const proposal of manifest.proposals) {
    invariant(typeof proposal.proposalId === "string" && proposal.proposalId.length > 0, "Review proposal is missing proposalId");
    invariant(!proposalIds.has(proposal.proposalId), `Duplicate review proposal ID: ${proposal.proposalId}`);
    proposalIds.add(proposal.proposalId);
    invariant(typeof proposal.promiseId === "string" && proposal.promiseId.length > 0, `Review proposal ${proposal.proposalId} is missing promiseId`);
    invariant(/^[a-f0-9]{64}$/.test(proposal.assessmentFingerprint), `Review proposal ${proposal.proposalId} has an invalid assessmentFingerprint`);
    invariant(!fingerprints.has(proposal.assessmentFingerprint), `Duplicate assessment fingerprint: ${proposal.assessmentFingerprint}`);
    fingerprints.add(proposal.assessmentFingerprint);
    invariant(/^[a-f0-9]{64}$/.test(proposal.assessmentContentHash), `Review proposal ${proposal.proposalId} has an invalid assessmentContentHash`);
    invariant(/^[a-f0-9]{64}$/.test(proposal.packageHash), `Review proposal ${proposal.proposalId} has an invalid packageHash`);
    invariant(["candidate", "human-review-required"].includes(proposal.resolutionState), `Review proposal ${proposal.proposalId} has an invalid resolutionState`);
    invariant(proposal.candidateStatus === null || assessmentStatuses.includes(proposal.candidateStatus), `Review proposal ${proposal.proposalId} has an invalid candidateStatus`);
    invariant(proposal.resolutionState !== "candidate" || proposal.candidateStatus !== null, `Candidate proposal ${proposal.proposalId} must include a status`);
    invariant(proposal.resolutionState !== "human-review-required" || proposal.candidateStatus === null, `Human-review proposal ${proposal.proposalId} cannot include a candidate status`);
    invariant(typeof proposal.evaluatedAt === "string" && !Number.isNaN(Date.parse(proposal.evaluatedAt)), `Review proposal ${proposal.proposalId} has an invalid evaluatedAt`);
    invariant(proposal.humanReviewRequired === true, `Review proposal ${proposal.proposalId} must require human review`);
    invariant(proposal.publicationApproved === false, `Review proposal ${proposal.proposalId} must remain unpublished`);
    invariant(typeof proposal.path === "string" && proposal.path.startsWith("automation/review-proposals/"), `Review proposal ${proposal.proposalId} has an invalid path`);
  }
  return manifest;
}

export function describeAssessmentInput(evidencePackage, prompts, runtime) {
  validateEvidencePackage(evidencePackage);
  const assessmentContentHash = hashAssessmentContent(evidencePackage);
  return {
    promiseId: evidencePackage.promise.id,
    packageHash: hashEvidencePackage(evidencePackage),
    assessmentContentHash,
    assessmentFingerprint: hashAssessmentFingerprint({ assessmentContentHash, prompts, runtime })
  };
}

export function planAssessmentInputs({ packages, manifest, blockedPromiseIds = new Set(), prompts, runtime }) {
  validateReviewManifest(manifest);
  const existingFingerprints = new Set(manifest.proposals.map(({ assessmentFingerprint }) => assessmentFingerprint));
  const promiseIds = new Set();
  return packages
    .map(({ path, evidencePackage }) => {
      const identity = describeAssessmentInput(evidencePackage, prompts, runtime);
      invariant(!promiseIds.has(identity.promiseId), `Duplicate evidence package for promise: ${identity.promiseId}`);
      promiseIds.add(identity.promiseId);
      const disposition = existingFingerprints.has(identity.assessmentFingerprint)
        ? "unchanged"
        : blockedPromiseIds.has(identity.promiseId)
          ? "blocked-enrichment-warning"
          : "assess";
      return { path, evidencePackage, ...identity, disposition };
    })
    .sort((left, right) => left.promiseId.localeCompare(right.promiseId));
}

export function createReviewProposal({ auditRecord, proposalDirectory }) {
  invariant(auditRecord?.publicationApproved === false, "Assessment audit must remain unpublished");
  invariant(["candidate", "human-review-required"].includes(auditRecord?.resolution?.state), "Assessment audit has no reviewable resolution");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.assessmentFingerprint), "Assessment audit has an invalid fingerprint");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.assessmentContentHash), "Assessment audit has an invalid content hash");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.packageHash), "Assessment audit has an invalid package hash");
  const promiseId = auditRecord.assessorA?.output?.promiseId;
  invariant(typeof promiseId === "string" && promiseId.length > 0, "Assessment audit is missing promiseId");
  const proposalId = `${promiseId}--${auditRecord.assessmentFingerprint.slice(0, 12)}`;
  return {
    schemaVersion: reviewManifestSchemaVersion,
    proposalId,
    promiseId,
    assessmentFingerprint: auditRecord.assessmentFingerprint,
    assessmentContentHash: auditRecord.assessmentContentHash,
    packageHash: auditRecord.packageHash,
    evaluatedAt: auditRecord.evaluatedAt,
    resolutionState: auditRecord.resolution.state,
    resolutionReason: auditRecord.resolution.reason,
    candidateStatus: auditRecord.resolution.status,
    confidence: auditRecord.resolution.state === "candidate"
      ? [auditRecord.assessorA.output.confidence, auditRecord.assessorB.output.confidence]
      : null,
    humanReviewRequired: true,
    publicationApproved: false,
    path: proposalDirectory.replaceAll("\\", "/")
  };
}

export function addReviewProposals(manifest, proposals) {
  validateReviewManifest(manifest);
  const merged = structuredClone(manifest);
  merged.proposals.push(...proposals);
  merged.proposals.sort((left, right) => left.promiseId.localeCompare(right.promiseId) || left.evaluatedAt.localeCompare(right.evaluatedAt));
  return validateReviewManifest(merged);
}
