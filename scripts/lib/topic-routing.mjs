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
 * proposal never appears in `agreedTags`; it still reaches routing-review
 * review through the broader union `routeSourceRecord` builds below.
 */
export function combineTaggerResults(taxonomy, taggerA, taggerB, { directLink = null } = {}) {
  if (directLink) {
    return { state: "auto-candidate", reason: "direct-structural-link", directLink, agreedTags: [] };
  }

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
 * proposals, for pilot measurement purposes. When the taggers groundedly
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
 * Routes one source record to zero or more promises by agreed specific tags
 * or a direct structural link. A record without either stays in
 * `orphan-review` or `routing-review` for human attention.
 */
export function routeSourceRecord({
  taxonomy,
  record,
  taggerA,
  taggerB,
  invertedIndex,
  directLink = null
}) {
  invariant(typeof record.id === "string" && record.id.length > 0, "routeSourceRecord requires a record id");

  const combined = combineTaggerResults(taxonomy, taggerA, taggerB, { directLink });

  if (combined.state === "orphan-review") {
    return {
      recordId: record.id,
      disposition: "orphan-review",
      routingState: combined.state,
      reason: combined.reason,
      candidatePromiseIds: [],
      routeBasis: [],
      matchedTagIds: [],
      directLinkReason: null
    };
  }

  const directPromiseIds = new Set(directLink?.promiseIds ?? (directLink?.promiseId ? [directLink.promiseId] : []));
  // Auto-candidate uses only the tags both taggers groundedly agreed were
  // sufficiently specific. Routing-review uses the broader union of every
  // proposed tag (including one-sided or ungrounded ones) so the record
  // still surfaces for human routing review rather than being lost.
  const routingTagIds = combined.state === "auto-candidate"
    ? combined.agreedTags
    : [...selectedTags(taggerA), ...selectedTags(taggerB)];
  const tagRoutedPromiseIds = promiseIdsForTags(taxonomy, invertedIndex, routingTagIds);
  const candidatePromiseIds = new Set([...tagRoutedPromiseIds, ...directPromiseIds]);
  const routeBasis = [
    ...(tagRoutedPromiseIds.size > 0 ? ["controlled-tag"] : []),
    ...(directPromiseIds.size > 0 ? ["direct-structural-link"] : [])
  ];

  if (candidatePromiseIds.size === 0) {
    return {
      recordId: record.id,
      disposition: "orphan-review",
      routingState: combined.state,
      reason: "no-matching-promise-after-safe-assignment",
      candidatePromiseIds: [],
      routeBasis: [],
      matchedTagIds: routingTagIds,
      directLinkReason: directLink?.reason ?? null
    };
  }

  return {
    recordId: record.id,
    disposition: combined.state === "auto-candidate" ? "candidate-created" : "routing-review",
    routingState: combined.state,
    reason: combined.reason,
    candidatePromiseIds: [...candidatePromiseIds],
    routeBasis,
    matchedTagIds: routingTagIds,
    directLinkReason: directLink?.reason ?? null
  };
}

export function recordPrintIds(record) {
  const payload = record.payload ?? {};
  return [
    ...(payload.externalPrintId ? [String(payload.externalPrintId)] : []),
    ...(payload.linkedPrints ?? []).map(({ externalPrintId }) => String(externalPrintId))
  ];
}

/**
 * Finds a direct structural link for a source record: a legal identifier of
 * an act that a print the record concerns amends (from `printIdentifiers`,
 * keyed by print ID), which a taxonomy tag lists in
 * `directLegalIdentifiers`, resolved to promises holding that tag. Returns
 * null when no identifier resolves to a promise.
 */
export function deriveDirectLink({ record, directIdIndex, invertedIndex, printIdentifiers = {} }) {
  const identifiers = [...new Set(recordPrintIds(record).flatMap((printId) => printIdentifiers[printId]?.identifiers ?? []))].sort();
  const promiseIds = new Set();
  const matchedIdentifiers = [];
  for (const identifier of identifiers) {
    let matchedAny = false;
    for (const tagId of directIdIndex.get(identifier) ?? []) {
      for (const promiseId of invertedIndex.get(tagId) ?? []) {
        promiseIds.add(promiseId);
        matchedAny = true;
      }
    }
    if (matchedAny) matchedIdentifiers.push(identifier);
  }
  if (promiseIds.size === 0) return null;
  return { promiseIds: [...promiseIds].sort(), reason: `matched-legal-identifiers:${matchedIdentifiers.join(", ")}` };
}
