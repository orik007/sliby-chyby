/**
 * What an assessment-revision pull request publishes (docs/evidence-pipeline.md,
 * From proposal to public score). `currentFingerprints` maps each promise
 * with a current package (neither superseded nor withdrawn) to that
 * package's assessment fingerprint. Its assessment is the proposal with that
 * fingerprint, or with it as its `reducedAssessmentFingerprint` (an
 * assessment kept for a package that differs only by the law changes its
 * assessors both found not relevant), or else a failure of both assessors
 * saved outside the review manifest under that fingerprint (`failures`, each
 * with its `promiseId` and `assessmentFingerprint`). A promise with neither
 * is not assessed yet. Each assessment is a candidate (it becomes a
 * revision), finds the evidence insufficient (nothing changes), or decided
 * nothing: the arbiter could not decide, its request was too large to send,
 * or both assessors failed (an inconclusive-assessment notice). Promises are
 * in id order.
 */
const insufficientEvidenceReasons = new Set(["insufficient-evidence", "arbiter-selected-insufficient-evidence"]);

export function planAssessmentPublication({ reviewManifest, currentFingerprints, failures = [] }) {
  const candidates = [];
  const insufficientEvidence = [];
  const inconclusive = [];
  const notAssessed = [];
  for (const [promiseId, fingerprint] of [...currentFingerprints].sort(([left], [right]) => left.localeCompare(right))) {
    // A superseded proposal is never the assessment: a newer one replaced it.
    const proposal = reviewManifest.proposals.find((entry) => entry.promiseId === promiseId && !entry.supersededByProposalId && (entry.assessmentFingerprint === fingerprint || entry.reducedAssessmentFingerprint === fingerprint));
    if (!proposal) {
      const failure = failures.find((entry) => entry.promiseId === promiseId && entry.assessmentFingerprint === fingerprint);
      (failure ? inconclusive : notAssessed).push(failure ?? { promiseId });
      continue;
    }
    if (proposal.resolutionState === "candidate") candidates.push(proposal);
    else if (insufficientEvidenceReasons.has(proposal.resolutionReason)) insufficientEvidence.push(proposal);
    else inconclusive.push(proposal);
  }
  return { candidates, insufficientEvidence, inconclusive, notAssessed };
}

/**
 * The notices after publication, sorted by promise: a promise whose current
 * package is too large for the models (`tooMuchEvidence`) gets its notice
 * from that package; an inconclusive assessment gets its notice; an older
 * notice for too much evidence stays only while its promise has neither and
 * its current package is not assessed (`assessedPromiseIds`: renewed, or
 * found to have insufficient evidence).
 */
export function noticesAfterPublication({ notices, inconclusive, tooMuchEvidence = [], assessedPromiseIds }) {
  const current = [...tooMuchEvidence, ...inconclusive];
  const replaced = new Set([...assessedPromiseIds, ...current.map(({ promiseId }) => promiseId)]);
  return [
    ...notices.filter(({ kind, promiseId }) => kind !== "inconclusive-assessment" && !replaced.has(promiseId)),
    ...current
  ].sort((left, right) => left.promiseId.localeCompare(right.promiseId));
}
