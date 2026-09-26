import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ancestorChain,
  directLegalIdentifierIndex,
  isAssessmentEligible,
  resolveTag,
  taxonomyHash,
  validateTaxonomy
} from "../scripts/lib/topic-taxonomy.mjs";

const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v2.json", import.meta.url), "utf8")));

test("the committed taxonomy is valid and contains the fiscal example branch", () => {
  assert.equal(taxonomy.taxonomyVersion, "topic-routing-v2");
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

test("rejects a tag with an unknown parent", () => {
  const broken = { ...taxonomy, tags: [...taxonomy.tags, { id: "orphan-tag", parent: "does-not-exist", labelEn: "x", assessmentEligible: true, inclusionExamples: ["x"], exclusionExamples: ["x"], czechAliases: ["x"] }] };
  assert.throws(() => validateTaxonomy(broken), /unknown parent/);
});

test("rejects duplicate tag ids", () => {
  const broken = { ...taxonomy, tags: [...taxonomy.tags, taxonomy.tags[0]] };
  assert.throws(() => validateTaxonomy(broken), /Duplicate taxonomy tag id/);
});

test("rejects a Czech alias assigned to more than one tag", () => {
  const broken = { ...taxonomy, tags: [...taxonomy.tags, { id: "duplicate-alias-tag", parent: null, labelEn: "x", assessmentEligible: true, inclusionExamples: ["x"], exclusionExamples: ["x"], czechAliases: ["DPH"] }] };
  assert.throws(() => validateTaxonomy(broken), /assigned to more than one tag/);
  const repeated = { ...taxonomy, tags: taxonomy.tags.map((tag, index) => (index === 0 ? { ...tag, czechAliases: [...tag.czechAliases, tag.czechAliases[0].toUpperCase()] } : tag)) };
  assert.throws(() => validateTaxonomy(repeated), /lists the Czech alias .* twice/);
  const invalid = { ...taxonomy, tags: taxonomy.tags.map((tag, index) => (index === 0 ? { ...tag, czechAliases: [...tag.czechAliases, null] } : tag)) };
  assert.throws(() => validateTaxonomy(invalid), /empty or invalid Czech alias/);
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

// Acts amended by law changes of run 56 (26 September 2026) that no specific
// tag covered, so their changes could not reach any promise.
test("acts that no specific tag covered in run 56 now link to one", () => {
  const index = directLegalIdentifierIndex(taxonomy);
  const expected = {
    "cz-act-49-1997": "aviation-and-waterways",
    "cz-act-114-1995": "aviation-and-waterways",
    "cz-act-361-2000": "road-traffic-and-vehicles",
    "cz-act-338-1992": "property-and-vehicle-taxes",
    "cz-act-16-1993": "property-and-vehicle-taxes",
    "cz-act-378-2007": "medicines-and-medical-devices",
    "cz-act-375-2022": "medicines-and-medical-devices",
    "cz-act-108-2006": "social-services",
    "cz-act-589-1992": "social-security-contributions",
    "cz-act-45-2013": "criminal-law-and-victims",
    "cz-act-89-2012": "civil-law",
    "cz-act-329-1999": "state-records-and-documents",
    "cz-act-245-2000": "state-symbols-and-holidays",
    "cz-act-332-2025": "postal-services",
    "cz-act-246-1992": "animal-breeding-and-welfare",
    "cz-act-449-2001": "forestry-and-hunting",
    "cz-act-156-2000": "police-and-internal-security",
    "cz-act-257-2001": "cultural-funding-and-heritage",
    "cz-act-17-2012": "tax-administration",
    "cz-act-330-2025": "regional-development-and-planning"
  };
  for (const [act, tagId] of Object.entries(expected)) {
    assert.ok(index.get(act)?.includes(tagId), `${act} links to ${tagId}`);
    assert.equal(isAssessmentEligible(taxonomy, tagId), true, tagId);
  }
});
