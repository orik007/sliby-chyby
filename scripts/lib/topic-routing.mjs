import { isAssessmentEligible } from "./topic-taxonomy.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const minimumConfidence = 0.5;

function selectedTags(screenerOutput) {
  return (screenerOutput?.tags ?? []).filter((tagId) => tagId !== "unknown");
}

// A screener's tag counts only with a plausible confidence: a tag returned
// with low confidence is weak support and routes nothing by itself.
function confidentSelectedTags(screenerOutput) {
  return Number.isFinite(screenerOutput?.confidence) && screenerOutput.confidence >= minimumConfidence ? selectedTags(screenerOutput) : [];
}

/**
 * Builds an index from each specific tag to the promises that hold it. A
 * promise's tags are assigned once, reviewed, and stored in
 * automation/topic-routing/promise-tags.json (docs/evidence-pipeline.md);
 * every one must be a specific (`assessmentEligible`) taxonomy tag.
 */
export function buildInvertedIndex(taxonomy, promises) {
  const index = new Map();
  for (const promise of promises) {
    for (const tagId of promise.tags) {
      invariant(isAssessmentEligible(taxonomy, tagId), `Promise ${promise.id} holds a tag that is not specific: ${tagId}`);
      index.set(tagId, (index.get(tagId) ?? new Set()).add(promise.id));
    }
  }
  return index;
}

function promiseIdsForTags(invertedIndex, tagIds) {
  const promiseIds = new Set();
  for (const tagId of tagIds) for (const promiseId of invertedIndex.get(tagId) ?? []) promiseIds.add(promiseId);
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
 * The specific tags a law change carries: every specific tag either screener
 * gives with a confidence of at least 0.5. An `unknown` or a low-confidence
 * answer of one screener does not block the other's tags, and the relevance
 * checks then read every pair in full.
 */
export function lawChangeTags(taxonomy, screenerA, screenerB) {
  return [...new Set([...confidentSelectedTags(screenerA), ...confidentSelectedTags(screenerB)])]
    .filter((tagId) => isAssessmentEligible(taxonomy, tagId))
    .sort();
}

/**
 * Routes one substantive law change to promises by a direct legal-identifier
 * link and by the specific tags of either screener; a change gets the
 * promises of both. A change that reaches no promise is `unrouted`: it has
 * no specific tag, or no promise holds one of its tags.
 */
export function routeLawChange({ taxonomy, change, screenerA, screenerB, invertedIndex, directIdIndex }) {
  invariant(typeof change.changeId === "string" && change.changeId.length > 0, "routeLawChange requires a changeId");
  const directLink = directLinkForChange({ change, directIdIndex, invertedIndex });
  const agreedTagIds = lawChangeTags(taxonomy, screenerA, screenerB);
  const tagPromiseIds = promiseIdsForTags(invertedIndex, agreedTagIds);
  // Each promise records how the change reached it, so the assessment
  // summary can count rejected changes by the tag or link that routed them.
  const routes = new Map();
  for (const promiseId of directLink?.promiseIds ?? []) routes.set(promiseId, { direct: true, tagIds: [] });
  for (const tagId of agreedTagIds) {
    for (const promiseId of promiseIdsForTags(invertedIndex, [tagId])) {
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
    return { changeId: change.changeId, disposition: "routed", reason: directLink && tagPromiseIds.size > 0 ? "direct-link-and-tags" : directLink ? "direct-structural-link" : "screener-tags", routedTo };
  }
  const reason = agreedTagIds.length > 0 ? "no-promise-with-its-tags" : "no-specific-tag";
  return { changeId: change.changeId, disposition: "unrouted", reason, routedTo: [] };
}
