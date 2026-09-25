import { isAssessmentEligible, resolveTag } from "./topic-taxonomy.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const minimumGroundedConfidence = 0.5;

function selectedTags(taggerOutput) {
  return (taggerOutput?.tags ?? []).filter((tagId) => tagId !== "unknown");
}

function isUnknown(taggerOutput) {
  return !taggerOutput || (taggerOutput.tags.length === 1 && taggerOutput.tags[0] === "unknown");
}

/**
 * A tagger's tag selection only counts as agreement support when it is
 * grounded: a plausible confidence and at least one cited excerpt. A tag
 * returned with zero confidence or no supporting excerpt is weak support and
 * must not by itself clear the auto-candidate bar, even if the peer tagger
 * proposes the same tag.
 */
function isGrounded(taggerOutput) {
  return Number.isFinite(taggerOutput?.confidence)
    && taggerOutput.confidence >= minimumGroundedConfidence
    && Array.isArray(taggerOutput?.supportingExcerpts)
    && taggerOutput.supportingExcerpts.length > 0;
}

function groundedSelectedTags(taggerOutput) {
  return isGrounded(taggerOutput) ? selectedTags(taggerOutput) : [];
}

/**
 * Combines two independent tagger outputs into one routing state, per the
 * doc's table. `agreedTags` carries only the tags that both taggers
 * independently and groundedly agreed are sufficiently specific — the set
 * that may drive an auto-created relationship. A one-sided or ungrounded
 * proposal never appears in `agreedTags`; it only makes the result
 * `routing-review` for human attention.
 */
export function combineTaggerResults(taxonomy, taggerA, taggerB) {
  const aUnknown = isUnknown(taggerA);
  const bUnknown = isUnknown(taggerB);

  if (aUnknown && bUnknown) {
    return { state: "orphan-review", reason: "both-taggers-unknown", agreedTags: [] };
  }
  if (aUnknown || bUnknown) {
    return { state: "routing-review", reason: "only-one-tagger-classified", agreedTags: [] };
  }

  const groundedA = groundedSelectedTags(taggerA);
  const groundedB = groundedSelectedTags(taggerB);
  const agreedGroundedSpecific = groundedA.filter(
    (tagId) => groundedB.includes(tagId) && isAssessmentEligible(taxonomy, tagId)
  );
  if (agreedGroundedSpecific.length > 0) {
    return { state: "auto-candidate", reason: "taggers-agree-on-specific-tag", agreedTags: agreedGroundedSpecific };
  }

  const rawA = selectedTags(taggerA);
  const rawB = selectedTags(taggerB);
  if (rawA.some((tagId) => rawB.includes(tagId))) {
    return { state: "routing-review", reason: "taggers-agree-only-on-broad-or-ungrounded-tag", agreedTags: [] };
  }
  return { state: "routing-review", reason: "taggers-disagree", agreedTags: [] };
}

/**
 * Derives one promise's accepted routing tags from two independent tagger
 * proposals. When the taggers groundedly
 * agree on a specific tag (`auto-candidate`), only that agreed set becomes
 * the accepted `tags` -- a tag proposed by just one tagger must not ride
 * along into an assignment marked `needsReview: false`, since that flag is
 * what gates entry into `buildInvertedIndex`. The raw union of both
 * taggers' full proposals is not lost: it stays inspectable via the
 * `taggerA`/`taggerB` fields the caller retains alongside this result,
 * which is what the doc's "union of all proposed relationships is retained
 * in audit data" refers to. For every other state, `tags` is that broader
 * union so a human reviewing `needsReview: true` sees everything proposed.
 */
export function derivePromiseTopicTags(taxonomy, taggerA, taggerB) {
  const combined = combineTaggerResults(taxonomy, taggerA, taggerB);
  if (combined.state === "orphan-review") return { tags: [], state: combined.state, needsReview: true };
  const proposedTags = combined.state === "auto-candidate"
    ? combined.agreedTags
    : [...new Set([...selectedTags(taggerA), ...selectedTags(taggerB)])];
  return { tags: proposedTags, state: combined.state, needsReview: combined.state !== "auto-candidate" };
}

/**
 * Builds an inverted index from a tag id to the set of promise ids whose
 * *accepted* promise-topic assignment includes that tag. An assignment
 * flagged `needsReview` (disagreement, weak support, or unresolved) is
 * deliberately excluded: it stays in the audit trail, but it must not by
 * itself let a source record auto-route to that promise before a human has
 * confirmed the promise's own topic.
 */
export function buildInvertedIndex(taxonomy, promiseTopicAssignments) {
  const index = new Map();
  for (const assignment of promiseTopicAssignments) {
    if (assignment.needsReview) continue;
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
 * Legal identifiers of a law change (the acts it amends, or the state budget
 * print kind) that a taxonomy tag lists in `directLegalIdentifiers`,
 * resolved to the promises holding that tag.
 */
export function directLinkForChange({ change, directIdIndex, invertedIndex }) {
  const promiseIds = new Set();
  const matchedIdentifiers = [];
  const matchedTagIds = new Set();
  for (const identifier of [...new Set(change.identifiers)].sort()) {
    let matchedAny = false;
    for (const tagId of directIdIndex.get(identifier) ?? []) {
      for (const promiseId of invertedIndex.get(tagId) ?? []) {
        promiseIds.add(promiseId);
        matchedTagIds.add(tagId);
        matchedAny = true;
      }
    }
    if (matchedAny) matchedIdentifiers.push(identifier);
  }
  if (promiseIds.size === 0) return null;
  return { promiseIds: [...promiseIds].sort(), matchedIdentifiers, matchedTagIds: [...matchedTagIds].sort() };
}

/**
 * Routes one substantive law change to promises by a direct legal-identifier
 * link and by the specific tags both screeners groundedly agree on; a change
 * gets the promises of both. Without either it stays in `routing-review` or
 * `orphan-review` for human attention.
 */
export function routeLawChange({ taxonomy, change, screenerA, screenerB, invertedIndex, directIdIndex }) {
  invariant(typeof change.changeId === "string" && change.changeId.length > 0, "routeLawChange requires a changeId");
  const directLink = directLinkForChange({ change, directIdIndex, invertedIndex });
  const combined = combineTaggerResults(taxonomy, screenerA, screenerB);
  const agreedTagIds = combined.state === "auto-candidate" ? combined.agreedTags : [];
  const tagPromiseIds = promiseIdsForTags(taxonomy, invertedIndex, agreedTagIds);
  // Each promise records how the change reached it, so the assessment
  // summary can count rejected changes by the tag or link that routed them.
  const routes = new Map();
  for (const promiseId of directLink?.promiseIds ?? []) routes.set(promiseId, { direct: true, tagIds: [] });
  for (const tagId of agreedTagIds) {
    for (const promiseId of promiseIdsForTags(taxonomy, invertedIndex, [tagId])) {
      const route = routes.get(promiseId) ?? { direct: false, tagIds: [] };
      route.tagIds.push(tagId);
      routes.set(promiseId, route);
    }
  }
  const routedTo = [...routes].sort(([left], [right]) => left.localeCompare(right)).map(([promiseId, route]) => ({
    promiseId,
    routeBasis: [...(route.direct ? ["direct-structural-link"] : []), ...(route.tagIds.length > 0 ? ["controlled-tag"] : [])],
    matchedTagIds: route.tagIds,
    directLinkIdentifiers: route.direct ? directLink.matchedIdentifiers : []
  }));
  if (routedTo.length > 0) {
    return { changeId: change.changeId, disposition: "routed", reason: directLink && tagPromiseIds.size > 0 ? "direct-link-and-agreed-tags" : directLink ? "direct-structural-link" : combined.reason, routedTo };
  }
  const disposition = combined.state === "orphan-review" || combined.state === "auto-candidate" ? "orphan-review" : "routing-review";
  const reason = combined.state === "auto-candidate" ? "no-matching-promise-after-safe-assignment" : combined.reason;
  return { changeId: change.changeId, disposition, reason, routedTo: [] };
}
