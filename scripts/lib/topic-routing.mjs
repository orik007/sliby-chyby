import { isAssessmentEligible, resolveTag } from "./topic-taxonomy.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function selectedTags(taggerOutput) {
  return taggerOutput.tags.filter((tagId) => tagId !== "unknown");
}

function isUnknown(taggerOutput) {
  return taggerOutput.tags.length === 1 && taggerOutput.tags[0] === "unknown";
}

function hasSufficientlySpecificOverlap(taxonomy, tagsA, tagsB) {
  const shared = tagsA.filter((tagId) => tagsB.includes(tagId));
  return shared.some((tagId) => isAssessmentEligible(taxonomy, tagId));
}

function hasAnyOverlap(tagsA, tagsB) {
  return tagsA.some((tagId) => tagsB.includes(tagId));
}

/**
 * Combines two independent tagger outputs into one routing state, per the
 * doc's table: direct structural link, or both taggers agreeing on a
 * sufficiently specific (assessmentEligible) tag, is auto-candidate; a
 * single tagger, disagreement, or only a broad shared tag is routing-review;
 * both unknown (or no controlled tag at all) is orphan-review.
 */
export function combineTaggerResults(taxonomy, taggerA, taggerB, { directLink = null } = {}) {
  if (directLink) {
    return { state: "auto-candidate", reason: "direct-structural-link", directLink };
  }

  const aUnknown = taggerA ? isUnknown(taggerA) : true;
  const bUnknown = taggerB ? isUnknown(taggerB) : true;

  if (aUnknown && bUnknown) {
    return { state: "orphan-review", reason: "both-taggers-unknown" };
  }
  if (aUnknown || bUnknown) {
    return { state: "routing-review", reason: "only-one-tagger-classified" };
  }

  const tagsA = selectedTags(taggerA);
  const tagsB = selectedTags(taggerB);

  if (hasSufficientlySpecificOverlap(taxonomy, tagsA, tagsB)) {
    return { state: "auto-candidate", reason: "taggers-agree-on-specific-tag" };
  }
  if (hasAnyOverlap(tagsA, tagsB)) {
    return { state: "routing-review", reason: "taggers-agree-only-on-broad-tag" };
  }
  return { state: "routing-review", reason: "taggers-disagree" };
}

/**
 * Derives one promise's accepted routing tags from two independent tagger
 * proposals, for pilot measurement purposes. The union of proposed tags is
 * always retained (per the doc: "The union of all proposed relationships is
 * retained in audit data"); `needsReview` flags a promise-topic assignment
 * that a human still needs to confirm before it should be treated as final.
 */
export function derivePromiseTopicTags(taxonomy, taggerA, taggerB) {
  const combined = combineTaggerResults(taxonomy, taggerA, taggerB);
  if (combined.state === "orphan-review") return { tags: [], state: combined.state, needsReview: true };
  const proposedTags = [...new Set([...selectedTags(taggerA ?? { tags: [] }), ...selectedTags(taggerB ?? { tags: [] })])];
  return { tags: proposedTags, state: combined.state, needsReview: combined.state !== "auto-candidate" };
}

/**
 * Builds an inverted index from an assessment-eligible tag id to the set of
 * promise ids whose promise-topic assignment includes that tag (directly, or
 * through a configured parent-child rule where the promise's own tag is an
 * ancestor of the record's specific tag).
 */
export function buildInvertedIndex(taxonomy, promiseTopicAssignments) {
  const index = new Map();
  for (const assignment of promiseTopicAssignments) {
    for (const tagId of selectedTags(assignment.tagAssignment)) {
      const promiseIds = index.get(tagId) ?? new Set();
      promiseIds.add(assignment.promiseId);
      index.set(tagId, promiseIds);
    }
  }
  return index;
}

function promiseIdsForTags(taxonomy, invertedIndex, tagIds) {
  const promiseIds = new Set();
  for (const tagId of tagIds) {
    for (const promiseId of invertedIndex.get(tagId) ?? []) promiseIds.add(promiseId);
    const tag = resolveTag(taxonomy, tagId);
    for (const promiseId of invertedIndex.get(tag.parent) ?? []) promiseIds.add(promiseId);
  }
  return promiseIds;
}

/**
 * Routes one source record to zero or more promises. Semantic-discovery
 * candidates (`semanticDiscoveryPromiseIds`) are unioned into the result and
 * are never used to filter or retire a tag- or direct-routed relationship —
 * this is the property the design doc requires (lines 106-107) that the
 * legacy top-N/0.55 semantic policy violated.
 */
export function routeSourceRecord({
  taxonomy,
  record,
  taggerA,
  taggerB,
  invertedIndex,
  directLink = null,
  semanticDiscoveryPromiseIds = []
}) {
  invariant(typeof record.id === "string" && record.id.length > 0, "routeSourceRecord requires a record id");

  const combined = combineTaggerResults(taxonomy, taggerA, taggerB, { directLink });
  const semanticSet = new Set(semanticDiscoveryPromiseIds);

  if (combined.state === "orphan-review") {
    return {
      recordId: record.id,
      disposition: semanticSet.size > 0 ? "candidate-created" : "orphan-review",
      routingState: combined.state,
      reason: combined.reason,
      candidatePromiseIds: [...semanticSet],
      routeBasis: semanticSet.size > 0 ? ["semantic-discovery"] : []
    };
  }

  const tagIds = [
    ...selectedTags(taggerA ?? { tags: [] }),
    ...selectedTags(taggerB ?? { tags: [] })
  ];
  const tagRoutedPromiseIds = promiseIdsForTags(taxonomy, invertedIndex, tagIds);
  const directPromiseIds = directLink ? new Set([directLink.promiseId]) : new Set();

  const candidatePromiseIds = new Set([...tagRoutedPromiseIds, ...directPromiseIds, ...semanticSet]);
  const routeBasis = [
    ...(tagRoutedPromiseIds.size > 0 ? ["controlled-tag"] : []),
    ...(directPromiseIds.size > 0 ? ["direct-structural-link"] : []),
    ...(semanticSet.size > 0 ? ["semantic-discovery"] : [])
  ];

  if (candidatePromiseIds.size === 0) {
    return {
      recordId: record.id,
      disposition: "orphan-review",
      routingState: combined.state,
      reason: "no-matching-promise-after-safe-assignment",
      candidatePromiseIds: [],
      routeBasis: []
    };
  }

  return {
    recordId: record.id,
    disposition: combined.state === "auto-candidate" ? "candidate-created" : "routing-review",
    routingState: combined.state,
    reason: combined.reason,
    candidatePromiseIds: [...candidatePromiseIds],
    routeBasis
  };
}
