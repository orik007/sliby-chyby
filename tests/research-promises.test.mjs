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
  const publicPromiseIds = new Set(publicPromises.map(({ id }) => id));
  const publicPromiseById = new Map(publicPromises.map((promise) => [promise.id, promise]));
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
    }
  }
  const confirmedPromiseIds = new Set(catalog.promises.filter(({ status }) => status === "confirmed").map(({ id }) => id));
  assert.deepEqual([...confirmedPromiseIds].sort(), [...publicPromiseIds].sort(), "Every and only confirmed campaign promise must be public");

  assert.equal(policyCategoryData.schemaVersion, 1);
  assert.equal(policyCategoryData.categories.length, 14);
  assert.equal(new Set(policyCategoryData.categories.map(({ id }) => id)).size, policyCategoryData.categories.length, "Policy category IDs must be unique");
  assert.equal(new Set(policyCategoryData.categories.map(({ order }) => order)).size, policyCategoryData.categories.length, "Policy category ordering must be unique");
  const policyCategoryIds = new Set(policyCategoryData.categories.map(({ id }) => id));
  const mappedPromiseIds = new Set(policyCategoryData.mappings.map(({ promiseId }) => promiseId));
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
    if (auditRow.proposedPolicyCategoryId) assert.equal(mapping.policyCategoryId, auditRow.proposedPolicyCategoryId, `Reviewed chapter mapping changed for ${mapping.promiseId}`);
  }
});
