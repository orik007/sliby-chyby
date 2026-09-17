function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function estimateTokens(text) {
  return Math.ceil(String(text ?? "").length / 4);
}

function evidenceItemTokens(item) {
  return estimateTokens(item.factSummary) + estimateTokens(JSON.stringify(item.structuredFacts ?? {}));
}

// The evidence items alone are not the whole assessor input: every package also
// carries the exact promise text, its source, current assessment context, and
// the scoring instructions. This fixed estimate keeps the reported budget from
// silently under-counting that overhead. It is a planning estimate, not a
// measured constant.
const basePackageOverheadTokens = 1_200;

// The design doc's assessment stage always sends two independent assessor
// calls per changed package (an arbitration call only on disagreement).
const assessorCallsPerPackage = 2;

/**
 * Predicts a bounded evidence package for one promise from its routed
 * evidence items, within an explicit token budget. Never silently drops
 * material: anything beyond the budget is marked for partition review and
 * recorded with its omission reason, per the design doc's §6. The reported
 * `estimatedAssessorInputTokens` includes the fixed per-package overhead and
 * both assessor calls, so it is comparable to the doc's token-budget table.
 */
export function predictBoundedPackage({ promiseId, routedEvidenceItems, maxItems = 24, maxTokenBudget = 6_000 }) {
  invariant(typeof promiseId === "string" && promiseId.length > 0, "predictBoundedPackage requires a promiseId");
  invariant(Array.isArray(routedEvidenceItems), "predictBoundedPackage requires routedEvidenceItems");

  if (routedEvidenceItems.length === 0) {
    return { promiseId, predicted: false, included: [], omitted: [], requiresPartitionReview: false, estimatedTokens: 0, estimatedAssessorInputTokens: 0 };
  }

  const sorted = [...routedEvidenceItems].sort((a, b) => (a.primary === b.primary ? 0 : a.primary ? -1 : 1));

  const included = [];
  const omitted = [];
  let runningTokens = 0;

  for (const item of sorted) {
    const itemTokens = evidenceItemTokens(item);
    const wouldExceedCount = included.length >= maxItems;
    const wouldExceedBudget = runningTokens + itemTokens > maxTokenBudget;
    if (wouldExceedCount || wouldExceedBudget) {
      omitted.push({
        recordId: item.recordId,
        reason: wouldExceedCount ? "exceeds-maximum-item-count" : "exceeds-token-budget"
      });
      continue;
    }
    included.push(item);
    runningTokens += itemTokens;
  }

  const packageTokens = runningTokens + basePackageOverheadTokens;
  return {
    promiseId,
    predicted: included.length > 0,
    included: included.map((item) => item.recordId),
    omitted,
    requiresPartitionReview: omitted.length > 0,
    estimatedTokens: runningTokens,
    estimatedAssessorInputTokens: packageTokens * assessorCallsPerPackage
  };
}
