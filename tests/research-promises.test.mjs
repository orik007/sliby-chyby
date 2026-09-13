import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("research promises use one source catalog and three promise statuses", async () => {
  const catalog = JSON.parse(await readFile(new URL("../research/2025-election/promises.json", import.meta.url), "utf8"));
  const publicPromises = await Promise.all(
    (await readdir(new URL("../data/promises/", import.meta.url)))
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => JSON.parse(await readFile(new URL(`../data/promises/${name}`, import.meta.url), "utf8")))
  );
  const policyCategoryData = JSON.parse(await readFile(new URL("../data/promise-categories.json", import.meta.url), "utf8"));
  const categoryAudit = JSON.parse(await readFile(new URL("../research/2025-election/promise-category-audit.json", import.meta.url), "utf8"));
  const matchingRegistry = JSON.parse(await readFile(new URL("../automation/matching/promises.json", import.meta.url), "utf8"));
  const publicPromiseIds = new Set(publicPromises.map(({ id }) => id));
  const publicPromiseById = new Map(publicPromises.map((promise) => [promise.id, promise]));
  const matchingPromiseById = new Map(matchingRegistry.promises.map((promise) => [promise.id, promise]));
  const sourceIds = new Set(catalog.sources.map(({ id }) => id));
  const promiseIds = new Set();
  assert.equal(catalog.sources.length, 3);
  for (const source of catalog.sources) {
    assert.ok(source.id);
    assert.ok(source.type);
    assert.ok(source.title);
    assert.ok(source.publisher);
    assert.match(source.url, /^https:\/\//);
  }
  for (const promise of catalog.promises) {
    assert.ok(!promiseIds.has(promise.id), `Duplicate promise ID: ${promise.id}`);
    promiseIds.add(promise.id);
    assert.ok(sourceIds.has(promise.sourceId), `Promise ${promise.id} has no source`);
    assert.ok(["candidate", "rejected", "confirmed"].includes(promise.status));
    assert.ok(promise.originalTextCz);
    assert.ok(Number.isInteger(promise.locator?.page));
    if (promise.status === "rejected") assert.ok(promise.rejectionReason);
    if (promise.status === "confirmed") {
      assert.ok(publicPromiseIds.has(promise.id), `Confirmed promise ${promise.id} is not public`);
      assert.deepEqual(publicPromiseById.get(promise.id).sourceLocator, promise.locator, `Public locator differs for ${promise.id}`);
      assert.equal(publicPromiseById.get(promise.id).originalText, promise.originalTextCz, `Public wording differs for ${promise.id}`);
    }
  }
  const confirmedPromiseIds = new Set(catalog.promises.filter(({ status }) => status === "confirmed").map(({ id }) => id));
  assert.deepEqual([...confirmedPromiseIds].sort(), [...publicPromiseIds].sort(), "Every and only confirmed campaign promise must be public");

  const meaningfulNumericTitleEndings = new Map([
    ["candidate-0ea588eda55f", "ve výši 5"],
    ["candidate-10983bd9b9ff", "Stork 2"],
    ["candidate-7e91cc854899", "příspěvek až 3"],
    ["candidate-fa5955ca9f54", "potřebám 21"],
    ["ano-2025-stop-2026-self-employed-contribution-increase", "rok 2026"]
  ]);
  const meaningfulNumericSentenceEndings = new Map([
    ["candidate-10983bd9b9ff", "Stork 2."],
    ["candidate-8f5e458aad72", "roku 2035."],
    ["candidate-f58e6ecc2c77", "Temelíně 3 a 4."],
    ["candidate-fd61cfd63a87", "roku 2001."],
    ["ano-2025-stop-2026-self-employed-contribution-increase", "rok 2026."]
  ]);
  for (const promise of publicPromises) {
    assert.doesNotMatch(promise.title, /^\d+[).]\s/, `Unexpected leading list number in title: ${promise.id}`);
    assert.doesNotMatch(promise.originalText, /^\d+[).]\s/, `Unexpected leading list number in wording: ${promise.id}`);
    const expectedTitleEnding = meaningfulNumericTitleEndings.get(promise.id);
    if (expectedTitleEnding) assert.ok(promise.title.endsWith(expectedTitleEnding), `Unexpected meaningful numeric title ending: ${promise.id}`);
    else assert.doesNotMatch(promise.title, /\s\d+$/, `Unexpected trailing reference number in title: ${promise.id}`);
    const expectedSentenceEnding = meaningfulNumericSentenceEndings.get(promise.id);
    if (expectedSentenceEnding) assert.ok(promise.originalText.endsWith(expectedSentenceEnding), `Unexpected meaningful numeric sentence ending: ${promise.id}`);
    else assert.doesNotMatch(promise.originalText, /\s\d+\.$/, `Unexpected trailing reference number in wording: ${promise.id}`);
  }

  const cleanedPromiseIds = new Set([
    "candidate-25f3c03be8e6", "candidate-698136a01899", "candidate-8bf3936c8ca4", "candidate-ace9999f8f27", "candidate-c96ac416ec96",
    "candidate-11691e361504", "candidate-2a0bbbc1c960", "candidate-2b33a82f28ea", "candidate-34a3f14a3094", "candidate-44950246ea44",
    "candidate-4990f8667c6d", "candidate-4d12fa7247c6", "candidate-50bc0fc01a48", "candidate-558143535dd7", "candidate-5bed789c30fc",
    "candidate-723b3dfc8296", "candidate-724ffbd7f19b", "candidate-7e1665215935", "candidate-87a1ab000ff3", "candidate-924a215b9854",
    "candidate-95658d9c7a4d", "candidate-b3645cef0b14", "candidate-b3db7861173a", "candidate-bd368f10716c", "candidate-cbb11a9eaa9f",
    "candidate-d325f2c293a9", "candidate-d4aa2e1dec79", "candidate-e005657dcae1", "candidate-f407d5e3430f", "candidate-f5a000b1fe81",
    "candidate-fad73882b864"
  ]);
  for (const promiseId of cleanedPromiseIds) {
    const publicPromise = publicPromiseById.get(promiseId);
    const matchingPromise = matchingPromiseById.get(promiseId);
    assert.ok(publicPromise, `Cleaned public promise is missing: ${promiseId}`);
    assert.ok(matchingPromise, `Matching registry promise is missing: ${promiseId}`);
    assert.equal(matchingPromise.titleCz, publicPromise.title, `Matching title differs for ${promiseId}`);
    assert.equal(matchingPromise.atomicClaimCz, publicPromise.originalText, `Matching atomic claim differs for ${promiseId}`);
    assert.equal(matchingPromise.originalTextCz, publicPromise.originalText, `Matching wording differs for ${promiseId}`);
    assert.equal(matchingPromise.promiseSource.exactQuoteCz, publicPromise.originalText, `Matching source quote differs for ${promiseId}`);
  }

  assert.equal(policyCategoryData.schemaVersion, 1);
  assert.equal(policyCategoryData.categories.length, 14);
  assert.equal(new Set(policyCategoryData.categories.map(({ id }) => id)).size, policyCategoryData.categories.length, "Policy category IDs must be unique");
  assert.equal(new Set(policyCategoryData.categories.map(({ order }) => order)).size, policyCategoryData.categories.length, "Policy category ordering must be unique");
  const policyCategoryIds = new Set(policyCategoryData.categories.map(({ id }) => id));
  const mappedPromiseIds = new Set(policyCategoryData.mappings.map(({ promiseId }) => promiseId));
  const policyCategoryByPromiseId = new Map(policyCategoryData.mappings.map((mapping) => [mapping.promiseId, mapping.policyCategoryId]));
  const auditByPromiseId = new Map(categoryAudit.rows.map((row) => [row.promiseId, row]));
  assert.equal(mappedPromiseIds.size, policyCategoryData.mappings.length, "Every promise has at most one common category mapping");
  assert.deepEqual([...mappedPromiseIds].sort(), [...publicPromiseIds].sort(), "Every public promise has one common category mapping");
  for (const mapping of policyCategoryData.mappings) {
    assert.ok(policyCategoryIds.has(mapping.policyCategoryId), `Unknown common category for ${mapping.promiseId}`);
    assert.ok(mapping.sourceProgrammeChapter, `Missing source programme chapter for ${mapping.promiseId}`);
    assert.ok(Number.isInteger(mapping.sourceProgrammeChapterOrder), `Missing source programme chapter order for ${mapping.promiseId}`);
    const auditRow = auditByPromiseId.get(mapping.promiseId);
    assert.ok(auditRow, `Missing source-review audit row for ${mapping.promiseId}`);
    assert.equal(mapping.sourceProgrammeChapter, auditRow.programmeChapter, `Source chapter changed for ${mapping.promiseId}`);
    assert.equal(mapping.sourceProgrammeChapterOrder, auditRow.programmeChapterOrder, `Source chapter order changed for ${mapping.promiseId}`);
    assert.equal(mapping.sourceSection, auditRow.sourceSection, `Source section changed for ${mapping.promiseId}`);
    assert.equal(mapping.sourceSectionOrder, auditRow.sourceSectionOrder, `Source section order changed for ${mapping.promiseId}`);
    assert.equal(mapping.sourceOrder, auditRow.sourceOrder, `Source item order changed for ${mapping.promiseId}`);
  }

  const reviewedAssignments = {
    "candidate-f58e6ecc2c77": "energy-climate-and-environment",
    "candidate-02de5dc826fe": "energy-climate-and-environment",
    "candidate-f4285b7d1411": "education-science-and-sport",
    "candidate-196684d1adcb": "education-science-and-sport",
    "candidate-2031ad036844": "education-science-and-sport",
    "candidate-7e91cc854899": "education-science-and-sport",
    "candidate-3461f6d65292": "education-science-and-sport",
    "candidate-443578b0139c": "education-science-and-sport",
    "candidate-95b1127bb4ae": "education-science-and-sport",
    "candidate-8eb814515f6f": "justice-democracy-and-rights",
    "candidate-2298c888a473": "justice-democracy-and-rights",
    "candidate-8d1f3ce81a7b": "justice-democracy-and-rights",
    "candidate-9394dcf307d6": "justice-democracy-and-rights"
  };
  for (const [promiseId, categoryId] of Object.entries(reviewedAssignments)) assert.equal(policyCategoryByPromiseId.get(promiseId), categoryId, `Incorrect reviewed category for ${promiseId}`);
});
