import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validatePromiseRegistry } from "../scripts/lib/attribution.mjs";
import {
  buildInvertedIndex,
  combineTaggerResults,
  derivePromiseTopicTags,
  directLinkForChange,
  routeLawChange
} from "../scripts/lib/topic-routing.mjs";
import { directLegalIdentifierIndex, validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v2.json", import.meta.url), "utf8")));
const directIdIndex = directLegalIdentifierIndex(taxonomy);
const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/promise-registry/promises.json", import.meta.url), "utf8")));
const fiscalPromise = registry.promises.find(({ id }) => id === "candidate-d5359e35a4c4");

function taggerOutput(tags, { confidence = 0.9 } = {}) {
  return { tags, confidence };
}

function lawChange(overrides = {}) {
  return { changeId: overrides.changeId ?? "43200-1", identifiers: overrides.identifiers ?? [] };
}

const fiscalIndex = () => buildInvertedIndex(taxonomy, [{ promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]) }]);

test("both screeners agreeing on a specific tag route the law change to the promises with that tag", () => {
  const screenerA = taggerOutput(["deficit-and-debt"]);
  const screenerB = taggerOutput(["deficit-and-debt"]);
  assert.equal(combineTaggerResults(taxonomy, screenerA, screenerB).state, "auto-candidate");
  const route = routeLawChange({ taxonomy, change: lawChange(), screenerA, screenerB, invertedIndex: fiscalIndex(), directIdIndex });
  assert.equal(route.disposition, "routed");
  assert.deepEqual(route.routedTo, [{ promiseId: fiscalPromise.id, routeBasis: ["controlled-tag"], matchedTagIds: ["deficit-and-debt"], directLinkIdentifiers: [] }]);
});

test("agreement on a broad parent or on a sibling tag never routes to the fiscal promise", () => {
  const broadOnly = combineTaggerResults(taxonomy, taggerOutput(["fiscal-responsibility"]), taggerOutput(["fiscal-responsibility"]));
  assert.equal(broadOnly.state, "routing-review", "agreement on a broad parent alone must never be auto-candidate");
  const route = routeLawChange({ taxonomy, change: lawChange(), screenerA: taggerOutput(["vat-policy"]), screenerB: taggerOutput(["vat-policy"]), invertedIndex: fiscalIndex(), directIdIndex });
  assert.equal(route.disposition, "orphan-review");
  assert.deepEqual(route.routedTo, []);
});

test("an unknown classification is visible in orphan review, and disagreement in routing review", () => {
  const unknown = taggerOutput(["unknown"]);
  assert.equal(routeLawChange({ taxonomy, change: lawChange(), screenerA: unknown, screenerB: unknown, invertedIndex: fiscalIndex(), directIdIndex }).disposition, "orphan-review");
  const disagreement = routeLawChange({ taxonomy, change: lawChange(), screenerA: taggerOutput(["deficit-and-debt"]), screenerB: taggerOutput(["vat-policy"]), invertedIndex: fiscalIndex(), directIdIndex });
  assert.equal(disagreement.disposition, "routing-review");
  assert.equal(disagreement.reason, "taggers-disagree");
  // An invalid screener output (null) is treated like one unclassified side.
  assert.equal(routeLawChange({ taxonomy, change: lawChange(), screenerA: null, screenerB: taggerOutput(["deficit-and-debt"]), invertedIndex: fiscalIndex(), directIdIndex }).disposition, "routing-review");
});

test("a law change amending a mapped act links directly, whatever the screeners' tags", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [{ promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["fiscal-rules"]) }]);
  const change = lawChange({ identifiers: ["cz-act-218-2000"] });
  assert.deepEqual(directLinkForChange({ change, directIdIndex, invertedIndex }), { promiseIds: [fiscalPromise.id], matchedIdentifiers: ["cz-act-218-2000"], matchedTagIds: ["fiscal-rules"] });
  const unknown = taggerOutput(["unknown"]);
  const route = routeLawChange({ taxonomy, change, screenerA: unknown, screenerB: unknown, invertedIndex, directIdIndex });
  assert.equal(route.disposition, "routed");
  assert.equal(route.reason, "direct-structural-link");
  assert.deepEqual(route.routedTo, [{ promiseId: fiscalPromise.id, routeBasis: ["direct-structural-link"], matchedTagIds: [], directLinkIdentifiers: ["cz-act-218-2000"] }]);
  assert.equal(directLinkForChange({ change: lawChange({ identifiers: ["cz-act-1-1900"] }), directIdIndex, invertedIndex }), null);
});

test("a direct link and agreed tags together reach the promises of both", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["fiscal-rules"]) },
    { promiseId: "fixture-vat-promise", tagAssignment: taggerOutput(["vat-policy"]) }
  ]);
  const route = routeLawChange({ taxonomy, change: lawChange({ identifiers: ["cz-act-218-2000"] }), screenerA: taggerOutput(["vat-policy"]), screenerB: taggerOutput(["vat-policy"]), invertedIndex, directIdIndex });
  assert.equal(route.reason, "direct-link-and-agreed-tags");
  assert.deepEqual(route.routedTo.map(({ promiseId, routeBasis }) => [promiseId, routeBasis]), [
    [fiscalPromise.id, ["direct-structural-link"]],
    ["fixture-vat-promise", ["controlled-tag"]]
  ]);
});

test("a one-sided tag never routes, even when the pair also agrees on a specific tag", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]) },
    { promiseId: "fixture-vat-promise", tagAssignment: taggerOutput(["vat-policy"]) }
  ]);
  const route = routeLawChange({ taxonomy, change: lawChange(), screenerA: taggerOutput(["deficit-and-debt", "vat-policy"]), screenerB: taggerOutput(["deficit-and-debt"]), invertedIndex, directIdIndex });
  assert.deepEqual(route.routedTo.map(({ promiseId }) => promiseId), [fiscalPromise.id]);
});

test("a promise-topic assignment still pending human review is excluded from routing", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [{ promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]), needsReview: true }]);
  const route = routeLawChange({ taxonomy, change: lawChange(), screenerA: taggerOutput(["deficit-and-debt"]), screenerB: taggerOutput(["deficit-and-debt"]), invertedIndex, directIdIndex });
  assert.notEqual(route.disposition, "routed");
});

test("agreement on a specific tag below a confidence of 0.5 on either side is weak support, not auto-candidate", () => {
  const lowConfidence = combineTaggerResults(
    taxonomy,
    taggerOutput(["deficit-and-debt"], { confidence: 0.49 }),
    taggerOutput(["deficit-and-debt"], { confidence: 0.9 })
  );
  assert.deepEqual([lowConfidence.state, lowConfidence.reason], ["routing-review", "taggers-agree-only-on-broad-or-low-confidence-tag"]);
  const confident = combineTaggerResults(
    taxonomy,
    taggerOutput(["deficit-and-debt"], { confidence: 0.5 }),
    taggerOutput(["deficit-and-debt"], { confidence: 0.5 })
  );
  assert.equal(confident.state, "auto-candidate");
});

test("a promise-topic assignment's accepted tags exclude a one-sided tag even when the pair also agrees on a specific tag", () => {
  // Tagger A proposes both deficit-and-debt and vat-policy; tagger B only
  // agrees on deficit-and-debt. combineTaggerResults correctly reaches
  // auto-candidate with agreedTags: ["deficit-and-debt"] alone -- the
  // accepted `tags` (which gates entry into buildInvertedIndex once
  // needsReview is false) must match that, not the raw two-tag union.
  const derived = derivePromiseTopicTags(taxonomy, taggerOutput(["deficit-and-debt", "vat-policy"]), taggerOutput(["deficit-and-debt"]));
  assert.equal(derived.needsReview, false);
  assert.deepEqual(derived.tags, ["deficit-and-debt"]);

  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: { tags: derived.tags }, needsReview: derived.needsReview }
  ]);
  assert.ok(invertedIndex.get("deficit-and-debt")?.has(fiscalPromise.id));
  assert.ok(!invertedIndex.get("vat-policy")?.has(fiscalPromise.id));
});

test("a promise-topic assignment pending review still retains the full proposed union for audit", () => {
  const derived = derivePromiseTopicTags(taxonomy, taggerOutput(["deficit-and-debt"]), taggerOutput(["vat-policy"]));
  assert.equal(derived.needsReview, true);
  assert.deepEqual(new Set(derived.tags), new Set(["deficit-and-debt", "vat-policy"]));
});

