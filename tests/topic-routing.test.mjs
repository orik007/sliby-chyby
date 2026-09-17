import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import { validatePromiseRegistry } from "../scripts/lib/evidence-matcher.mjs";
import {
  buildInvertedIndex,
  combineTaggerResults,
  routeSourceRecord
} from "../scripts/lib/topic-routing.mjs";
import { validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v1.json", import.meta.url), "utf8")));
const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/matching/promises.json", import.meta.url), "utf8")));
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

test("a tag-routed relationship survives regardless of semantic-discovery rank/similarity (never suppressed)", () => {
  const invertedIndex = buildInvertedIndex(taxonomy, [
    { promiseId: fiscalPromise.id, tagAssignment: taggerOutput(["deficit-and-debt"]) }
  ]);
  const record = voteRecord({ id: "psp--fiscal-vote-2" });
  const taggerA = taggerOutput(["deficit-and-debt"]);
  const taggerB = taggerOutput(["deficit-and-debt"]);

  // No semantic-discovery signal at all -- under the legacy top-3/0.55 policy
  // this record's package could be retired as "outside-active-semantic-policy".
  // The tag-routed relationship must still be created.
  const routeWithoutSemantic = routeSourceRecord({ taxonomy, record, taggerA, taggerB, invertedIndex, semanticDiscoveryPromiseIds: [] });
  assert.equal(routeWithoutSemantic.disposition, "candidate-created");
  assert.ok(routeWithoutSemantic.candidatePromiseIds.includes(fiscalPromise.id));

  // A semantic-discovery candidate for an unrelated promise only adds to the
  // set -- it never removes the tag-routed relationship.
  const routeWithUnrelatedSemantic = routeSourceRecord({ taxonomy, record, taggerA, taggerB, invertedIndex, semanticDiscoveryPromiseIds: ["some-other-promise"] });
  assert.ok(routeWithUnrelatedSemantic.candidatePromiseIds.includes(fiscalPromise.id));
  assert.ok(routeWithUnrelatedSemantic.candidatePromiseIds.includes("some-other-promise"));
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
    directLink: { promiseId: fiscalPromise.id, reason: "matched-legal-identifier" }
  });
  assert.equal(route.disposition, "candidate-created");
  assert.ok(route.candidatePromiseIds.includes(fiscalPromise.id));
  assert.ok(route.routeBasis.includes("direct-structural-link"));
});
