import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  aliasIndex,
  ancestorChain,
  directLegalIdentifierIndex,
  isAssessmentEligible,
  isDescendant,
  resolveTag,
  taxonomyHash,
  validateTaxonomy
} from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v1.json", import.meta.url), "utf8")));

test("the committed taxonomy is valid and contains the design doc's example branch", () => {
  assert.equal(taxonomy.taxonomyVersion, "topic-routing-v1");
  assert.ok(resolveTag(taxonomy, "public-finance"));
  assert.ok(resolveTag(taxonomy, "fiscal-responsibility"));
  assert.ok(resolveTag(taxonomy, "deficit-and-debt"));
  assert.ok(resolveTag(taxonomy, "fiscal-rules"));
  assert.ok(resolveTag(taxonomy, "debt-brake"));
  assert.deepEqual(ancestorChain(taxonomy, "deficit-and-debt"), ["fiscal-responsibility", "public-finance"]);
});

test("a broad parent tag is never assessment-eligible by itself", () => {
  assert.equal(isAssessmentEligible(taxonomy, "public-finance"), false);
  assert.equal(isAssessmentEligible(taxonomy, "fiscal-responsibility"), false);
  assert.equal(isAssessmentEligible(taxonomy, "deficit-and-debt"), true);
});

test("isDescendant reports the full ancestor chain, not just the direct parent", () => {
  assert.equal(isDescendant(taxonomy, "deficit-and-debt", "public-finance"), true);
  assert.equal(isDescendant(taxonomy, "deficit-and-debt", "health-and-care"), false);
});

test("rejects a tag with an unknown parent", () => {
  const broken = { ...taxonomy, tags: [...taxonomy.tags, { id: "orphan-tag", parent: "does-not-exist", labelEn: "x", assessmentEligible: true, inclusionExamples: ["x"], exclusionExamples: ["x"], czechAliases: ["x"] }] };
  assert.throws(() => validateTaxonomy(broken), /unknown parent/);
});

test("rejects duplicate tag ids", () => {
  const broken = { ...taxonomy, tags: [...taxonomy.tags, taxonomy.tags[0]] };
  assert.throws(() => validateTaxonomy(broken), /Duplicate taxonomy tag id/);
});

test("aliasIndex resolves a Czech alias to its tag id and rejects a duplicate alias", () => {
  const index = aliasIndex(taxonomy);
  assert.equal(index.get("dph"), "vat-policy");
  const broken = { ...taxonomy, tags: [...taxonomy.tags, { id: "duplicate-alias-tag", parent: null, labelEn: "x", assessmentEligible: true, inclusionExamples: ["x"], exclusionExamples: ["x"], czechAliases: ["DPH"] }] };
  assert.throws(() => aliasIndex(broken), /assigned to more than one tag/);
});

test("taxonomyHash changes when a tag's Czech aliases or examples change, not just its id/parent/eligibility", () => {
  const baseline = taxonomyHash(taxonomy);
  assert.equal(taxonomyHash(taxonomy), baseline, "hashing the same content twice must be stable");

  const aliasChanged = {
    ...taxonomy,
    tags: taxonomy.tags.map((tag) => (tag.id === "deficit-and-debt" ? { ...tag, czechAliases: [...tag.czechAliases, "nový alias"] } : tag))
  };
  assert.notEqual(taxonomyHash(aliasChanged), baseline, "a changed alias must invalidate a cache entry fingerprinted against this hash");

  const exampleChanged = {
    ...taxonomy,
    tags: taxonomy.tags.map((tag) => (tag.id === "deficit-and-debt" ? { ...tag, inclusionExamples: [...tag.inclusionExamples, "a new inclusion example"] } : tag))
  };
  assert.notEqual(taxonomyHash(exampleChanged), baseline, "a changed inclusion example must invalidate a cache entry fingerprinted against this hash");
});

test("taxonomyHash changes when aliases are merely reordered, not just when their content changes", () => {
  const baseline = taxonomyHash(taxonomy);
  const target = taxonomy.tags.find((tag) => tag.id === "deficit-and-debt");
  assert.ok(target.czechAliases.length >= 2, "fixture must have enough aliases to meaningfully reorder");
  const aliasesReordered = {
    ...taxonomy,
    tags: taxonomy.tags.map((tag) => (tag.id === "deficit-and-debt" ? { ...tag, czechAliases: [...tag.czechAliases].reverse() } : tag))
  };
  assert.notEqual(taxonomyHash(aliasesReordered), baseline, "taxonomyDefinitionsText renders aliases in their given order, so reordering them changes the exact model input");
});

test("taxonomyHash changes when the tags array itself is merely reordered", () => {
  const baseline = taxonomyHash(taxonomy);
  const tagsReordered = { ...taxonomy, tags: [...taxonomy.tags].reverse() };
  assert.notEqual(taxonomyHash(tagsReordered), baseline, "taxonomyDefinitionsText renders tags in taxonomy.tags order, so reordering them changes the exact model input");
});

test("directLegalIdentifierIndex groups tags sharing a legal identifier", () => {
  const index = directLegalIdentifierIndex(taxonomy);
  const fiscalTags = index.get("cz-act-23-2017");
  assert.ok(fiscalTags.includes("deficit-and-debt"));
  assert.ok(fiscalTags.includes("fiscal-rules"));
  assert.ok(fiscalTags.includes("debt-brake"));
});
