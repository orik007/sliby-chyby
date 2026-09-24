import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import { validatePromiseRegistry } from "../scripts/lib/attribution.mjs";
import {
  buildInvertedIndex,
  combineTaggerResults,
  derivePromiseTopicTags,
  routeSourceRecord
} from "../scripts/lib/topic-routing.mjs";
import { validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v1.json", import.meta.url), "utf8")));
const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/promise-registry/promises.json", import.meta.url), "utf8")));
const fiscalPromise = registry.promises.find(({ id }) => id === "candidate-d5359e35a4c4");

function taggerOutput(tags, { confidence = 0.9, supportingExcerpts = ["fixture excerpt"] } = {}) {
  return { tags, confidence, supportingExcerpts };
}

function voteRecord(overrides = {}) {
  return createCollectedRecord({
    id: overrides.id ?? "psp--fiscal-vote-1",
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: overrides.occurredAt ?? "2026-06-01T00:00:00",
    title: overrides.title ?? "Hlasování o novele zákona o pravidlech rozpočtové odpovědnosti",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/hlasy.sqw?g=1",
    payload: overrides.payload ?? { externalVoteId: "1" }
  });
}

test("fixture 1: both taggers agree on a specific fiscal-responsibility tag creates an auto-candidate", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]) }
  ]);
  const record = voteRecord();
  const taggerA = taggerOutput(["deficit-and-debt"]);
  const taggerB = taggerOutput(["deficit-and-debt"]);

  const combined = combineTaggerResults(taxonomy, taggerA, taggerB);
  assert.equal(combined.state, "auto-candidate");

  const route = routeSourceRecord({ taxonomy, record, taggerA, taggerB, invertedIndex });
  assert.equal(route.disposition, "candidate-created");
  assert.ok(route.candidatePromiseIds.includes(fiscalPromise.id));
  assert.ok(route.routeBasis.includes("controlled-tag"));
});

test("fixture 2: a record that shares only the broad public-finance parent does not create a fiscal-responsibility candidate", () => {
  // Both taggers agree only on the broad, non-assessment-eligible parent tag.
  const broadOnly = combineTaggerResults(taxonomy, taggerOutput(["fiscal-responsibility"]), taggerOutput(["fiscal-responsibility"]));
  assert.equal(broadOnly.state, "routing-review", "agreement on a broad parent alone must never be auto-candidate");

  // A genuine tax-measure record (VAT), tagged under the sibling `taxation` branch,
  // must not be routed to the fiscal-responsibility promise at all.
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]) }
  ]);
  const vatRecord = createCollectedRecord({
    id: "psp--vat-rate-change",
    sourceId: "psp-core-2025",
    kind: "legislative-step",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-05-01T00:00:00",
    title: "Novela zákona o dani z přidané hodnoty — změna sazby",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/historie.sqw?o=10&t=999",
    payload: { externalPrintId: "999" }
  });
  const taggerA = taggerOutput(["vat-policy"]);
  const taggerB = taggerOutput(["vat-policy"]);
  const route = routeSourceRecord({ taxonomy, record: vatRecord, taggerA, taggerB, invertedIndex });
  assert.notEqual(route.disposition, "candidate-created");
  assert.ok(!route.candidatePromiseIds.includes(fiscalPromise.id));
});

test("fixture 3: an unknown classification is visible in orphan review, not silently treated as no candidate", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]) }
  ]);
  const record = voteRecord({ id: "psp--ambiguous-record" });
  const taggerA = taggerOutput(["unknown"], { supportingExcerpts: ["too ambiguous to classify"] });
  const taggerB = taggerOutput(["unknown"], { supportingExcerpts: ["too ambiguous to classify"] });

  const route = routeSourceRecord({ taxonomy, record, taggerA, taggerB, invertedIndex });
  assert.equal(route.disposition, "orphan-review");
  assert.notEqual(route.disposition, undefined);
});

test("a direct structural link always creates an auto-candidate, independent of tagger agreement", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, []);
  const record = voteRecord({ id: "psp--direct-link" });
  const route = routeSourceRecord({
    taxonomy,
    record,
    taggerA: taggerOutput(["unknown"]),
    taggerB: taggerOutput(["unknown"]),
    invertedIndex,
    directLink: { promiseId: fiscalPromise.id, reason: "matched-legal-identifier:cz-act-23-2017" }
  });
  assert.equal(route.disposition, "candidate-created");
  assert.ok(route.candidatePromiseIds.includes(fiscalPromise.id));
  assert.ok(route.routeBasis.includes("direct-structural-link"));
  assert.equal(route.directLinkReason, "matched-legal-identifier:cz-act-23-2017", "the concrete matched identifier must be reported, not just the generic 'direct-structural-link' basis label");
});

test("the route audit records the concrete agreed tag id, not just the generic 'controlled-tag' basis label", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]) }
  ]);
  const record = voteRecord({ id: "psp--matched-tag-audit" });
  const route = routeSourceRecord({ taxonomy, record, taggerA: taggerOutput(["deficit-and-debt"]), taggerB: taggerOutput(["deficit-and-debt"]), invertedIndex });
  assert.deepEqual(route.matchedTagIds, ["deficit-and-debt"]);
  assert.equal(route.directLinkReason, null);
});

test("agreement on a specific tag with zero confidence or no excerpts is weak support, not auto-candidate", () => {
  const zeroConfidence = combineTaggerResults(
    taxonomy,
    taggerOutput(["deficit-and-debt"], { confidence: 0 }),
    taggerOutput(["deficit-and-debt"], { confidence: 0 })
  );
  assert.equal(zeroConfidence.state, "routing-review");

  const noExcerpts = combineTaggerResults(
    taxonomy,
    taggerOutput(["deficit-and-debt"], { supportingExcerpts: [] }),
    taggerOutput(["deficit-and-debt"], { supportingExcerpts: [] })
  );
  assert.equal(noExcerpts.state, "routing-review");
});

test("a one-sided tag proposal never auto-creates a relationship, even when the pair also agrees on a specific tag", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]) },
    { promiseId: "fixture-vat-promise", tagAssignment: taggerOutput(["vat-policy"]) }
  ]);
  const record = voteRecord({ id: "psp--mixed-agreement" });
  // Both taggers agree on deficit-and-debt (specific -> auto-candidate), but
  // tagger A alone also proposes vat-policy. That one-sided tag must not
  // pull the unrelated fixture-vat-promise into the auto-created candidate set.
  const taggerA = taggerOutput(["deficit-and-debt", "vat-policy"]);
  const taggerB = taggerOutput(["deficit-and-debt"]);
  const route = routeSourceRecord({ taxonomy, record, taggerA, taggerB, invertedIndex });
  assert.equal(route.disposition, "candidate-created");
  assert.deepEqual(route.candidatePromiseIds, [fiscalPromise.id]);
  assert.ok(!route.candidatePromiseIds.includes("fixture-vat-promise"));
});

test("a promise-topic assignment still pending human review is excluded from the auto-candidate index", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]), needsReview: true }
  ]);
  const record = voteRecord({ id: "psp--pending-review-promise" });
  const route = routeSourceRecord({
    taxonomy,
    record,
    taggerA: taggerOutput(["deficit-and-debt"]),
    taggerB: taggerOutput(["deficit-and-debt"]),
    invertedIndex
  });
  assert.notEqual(route.disposition, "candidate-created");
  assert.ok(!route.candidatePromiseIds.includes(fiscalPromise.id));
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

