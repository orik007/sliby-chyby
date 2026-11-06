/**
 * Which current proposals an assessment-revision pull request publishes
 * (docs/evidence-pipeline.md, From proposal to public score): the current
 * proposal of every promise with a package neither superseded nor withdrawn,
 * divided into candidates (each becomes a revision), those that find the
 * evidence insufficient (nothing changes), and every other one, which no
 * assessment decided: the arbiter could not decide, its request was too
 * large to send, or neither assessor gave a valid answer (each gets an
 * inconclusive-assessment notice). Promises are in id order.
 */
const insufficientEvidenceReasons = new Set(["insufficient-evidence", "arbiter-selected-insufficient-evidence"]);
export function planAssessmentPublication({ reviewManifest, packageQueue }) {
  const assessed = new Set(packageQueue.packages.filter((entry) => !entry.supersededByPackageHash && !entry.withdrawnAt).map(({ promiseId }) => promiseId));
  const current = reviewManifest.proposals
    .filter((proposal) => !proposal.supersededByProposalId && assessed.has(proposal.promiseId))
    .sort((left, right) => left.promiseId.localeCompare(right.promiseId));
  return {
    candidates: current.filter(({ resolutionState }) => resolutionState === "candidate"),
    insufficientEvidence: current.filter(({ resolutionState, resolutionReason }) => resolutionState !== "candidate" && insufficientEvidenceReasons.has(resolutionReason)),
    inconclusive: current.filter(({ resolutionState, resolutionReason }) => resolutionState !== "candidate" && !insufficientEvidenceReasons.has(resolutionReason))
  };
}

/**
 * The notices after publication: every notice for too much evidence stays,
 * unless the promise is renewed; the inconclusive-assessment notices are
 * replaced by the current ones, sorted by promise.
 */
export function noticesAfterPublication({ notices, inconclusive, renewedPromiseIds }) {
  const renewed = new Set(renewedPromiseIds);
  return [
    ...notices.filter(({ kind, promiseId }) => kind !== "inconclusive-assessment" && !renewed.has(promiseId)),
    ...inconclusive
  ].sort((left, right) => left.promiseId.localeCompare(right.promiseId));
}
