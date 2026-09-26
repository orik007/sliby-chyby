import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildInvertedIndex, directLinkForChange, routeLawChange } from "../scripts/lib/topic-routing.mjs";
import { directLegalIdentifierIndex, validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v2.json", import.meta.url), "utf8")));
const directIdIndex = directLegalIdentifierIndex(taxonomy);
const fiscalPromise = { id: "fixture-fiscal-promise" };

function taggerOutput(tags, { confidence = 0.9 } = {}) {
  return { tags, confidence };
}

function lawChange(overrides = {}) {
  return { changeId: overrides.changeId ?? "43200-1", identifiers: overrides.identifiers ?? [] };
}

const promiseWith = (id, tags) => ({ id, tags });
const fiscalIndex = () => buildInvertedIndex(taxonomy, [promiseWith(fiscalPromise.id, ["deficit-and-debt"])]);

test("both screeners agreeing on a specific tag route the law change to the promises with that tag", () => {
  const screenerA = taggerOutput(["deficit-and-debt"]);
  const screenerB = taggerOutput(["deficit-and-debt"]);
  const route = routeLawChange({ taxonomy, change: lawChange(), screenerA, screenerB, invertedIndex: fiscalIndex(), directIdIndex });
  assert.equal(route.disposition, "routed");
  assert.deepEqual(route.routedTo, [{ promiseId: fiscalPromise.id, routeBasis: ["controlled-tag"], matchedTagIds: ["deficit-and-debt"], directLinkIdentifiers: [] }]);
});

test("a broad parent tag alone, or a tag no promise holds, routes a law change nowhere", () => {
  const broadOnly = routeLawChange({ taxonomy, change: lawChange(), screenerA: taggerOutput(["fiscal-responsibility"]), screenerB: taggerOutput(["fiscal-responsibility"]), invertedIndex: fiscalIndex(), directIdIndex });
  assert.deepEqual([broadOnly.disposition, broadOnly.reason, broadOnly.routedTo], ["unrouted", "no-specific-tag", []]);
  const otherTopic = routeLawChange({ taxonomy, change: lawChange(), screenerA: taggerOutput(["vat-policy"]), screenerB: taggerOutput(["vat-policy"]), invertedIndex: fiscalIndex(), directIdIndex });
  assert.deepEqual([otherTopic.disposition, otherTopic.reason, otherTopic.routedTo], ["unrouted", "no-promise-with-its-tags", []]);
  const unknown = taggerOutput(["unknown"]);
  assert.equal(routeLawChange({ taxonomy, change: lawChange(), screenerA: unknown, screenerB: unknown, invertedIndex: fiscalIndex(), directIdIndex }).reason, "no-specific-tag");
});

test("a law change carries the specific tags of either screener: one screener's unknown, invalid output, or other tag does not block them", () => {
  const routedBy = (screenerA, screenerB) => routeLawChange({ taxonomy, change: lawChange(), screenerA, screenerB, invertedIndex: fiscalIndex(), directIdIndex });
  for (const [screenerA, screenerB] of [
    [taggerOutput(["unknown"]), taggerOutput(["deficit-and-debt"])],
    [null, taggerOutput(["deficit-and-debt"])],
    [taggerOutput(["vat-policy"]), taggerOutput(["deficit-and-debt"])]
  ]) {
    const route = routedBy(screenerA, screenerB);
    assert.deepEqual([route.disposition, route.reason, route.routedTo.map(({ promiseId }) => promiseId)], ["routed", "screener-tags", [fiscalPromise.id]]);
  }
  // A tag given with a confidence below 0.5 does not count.
  assert.equal(routedBy(taggerOutput(["unknown"]), taggerOutput(["deficit-and-debt"], { confidence: 0.4 })).disposition, "unrouted");
});

test("a law change amending a mapped act links directly, whatever the screeners' tags", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [promiseWith(fiscalPromise.id, ["fiscal-rules"])]);
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
    promiseWith(fiscalPromise.id, ["fiscal-rules"]),
    promiseWith("fixture-vat-promise", ["vat-policy"])
  ]);
  const route = routeLawChange({ taxonomy, change: lawChange({ identifiers: ["cz-act-218-2000"] }), screenerA: taggerOutput(["vat-policy"]), screenerB: taggerOutput(["vat-policy"]), invertedIndex, directIdIndex });
  assert.equal(route.reason, "direct-link-and-tags");
  assert.deepEqual(route.routedTo.map(({ promiseId, routeBasis }) => [promiseId, routeBasis]), [
    [fiscalPromise.id, ["direct-structural-link"]],
    ["fixture-vat-promise", ["controlled-tag"]]
  ]);
});

test("a law change reaches the promises of every tag of both screeners", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    promiseWith(fiscalPromise.id, ["deficit-and-debt"]),
    promiseWith("fixture-vat-promise", ["vat-policy"])
  ]);
  const route = routeLawChange({ taxonomy, change: lawChange(), screenerA: taggerOutput(["deficit-and-debt", "vat-policy"]), screenerB: taggerOutput(["deficit-and-debt"]), invertedIndex, directIdIndex });
  assert.deepEqual(route.routedTo.map(({ promiseId, matchedTagIds }) => [promiseId, matchedTagIds]), [[fiscalPromise.id, ["deficit-and-debt"]], ["fixture-vat-promise", ["vat-policy"]]]);
});

test("a promise holds only specific tags", () => {
  assert.throws(() => buildInvertedIndex(taxonomy, [promiseWith(fiscalPromise.id, ["fiscal-responsibility"])]), /not specific/);
  const invertedIndex = buildInvertedIndex(taxonomy, [promiseWith(fiscalPromise.id, ["deficit-and-debt", "fiscal-rules"])]);
  assert.deepEqual([...invertedIndex.keys()].sort(), ["deficit-and-debt", "fiscal-rules"]);
});
