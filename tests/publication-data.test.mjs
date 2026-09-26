import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadTrackedPromises } from "../scripts/lib/published-promises.mjs";
import { isAssessmentEligible, validateTaxonomy } from "../scripts/lib/topic-taxonomy.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

async function readJsonDirectory(relativePath) {
  const directory = new URL(`../${relativePath}/`, import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, directory), "utf8"))));
}

const [items, revisions, sources, partyPeriods] = await Promise.all([
  readJsonDirectory("data/promises"),
  readJsonDirectory("data/assessment-revisions"),
  readJsonDirectory("data/sources"),
  readJsonDirectory("data/party-periods")
]);
const categories = JSON.parse(await readFile(new URL("../data/promise-categories.json", import.meta.url), "utf8"));

test("every published item is a promise or a statement of one tracked party, with a category and a source", () => {
  assert.ok(items.length > 0);
  assert.ok([items, revisions, sources, partyPeriods].every((collection) => collection.every(({ isDemo }) => isDemo === false)));
  const categoryIds = new Set(categories.categories.map(({ id }) => id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const partyPeriodIds = new Set(partyPeriods.map(({ id }) => id));
  const ids = new Set();
  const slugs = new Set();
  const orders = new Set();
  for (const item of items) {
    assert.ok(!ids.has(item.id), `Duplicate item id: ${item.id}`);
    ids.add(item.id);
    assert.ok(!slugs.has(`${item.partyPeriodId}/${item.slug}`), `Duplicate slug: ${item.slug}`);
    slugs.add(`${item.partyPeriodId}/${item.slug}`);
    assert.ok(["promise", "statement"].includes(item.kind), `Invalid kind: ${item.id}`);
    assert.ok(categoryIds.has(item.policyCategoryId), `Unknown category: ${item.id}`);
    assert.ok(partyPeriodIds.has(item.partyPeriodId), `Unknown party period: ${item.id}`);
    const source = sourceById.get(item.primarySourceId);
    assert.ok(source?.type === "programme" && source.url, `Invalid source: ${item.id}`);
    assert.ok(Number.isInteger(item.sourceLocator?.page), `Missing page: ${item.id}`);
    assert.ok(!orders.has(`${item.primarySourceId}/${item.sourceOrder}`), `Duplicate source order: ${item.id}`);
    orders.add(`${item.primarySourceId}/${item.sourceOrder}`);
    assert.doesNotMatch(item.title, /^\d+[).]\s/, `Leading list number in title: ${item.id}`);
    assert.ok(item.title.length <= 120, `Title too long: ${item.id}`);
  }
  assert.deepEqual(
    new Set(items.filter(({ kind }) => kind === "promise").map(({ partyPeriodId }) => partyPeriodId)),
    new Set(["cz-ps-2025--ano", "cz-ps-2025--spd", "cz-ps-2025--motoriste"])
  );
});

test("every promise has a current score and a statement has none", () => {
  const promiseIds = new Set(items.filter(({ kind }) => kind === "promise").map(({ id }) => id));
  const revisedIds = new Set(revisions.map(({ promiseId }) => promiseId));
  assert.deepEqual([...revisedIds].sort(), [...promiseIds].sort());
  const itemById = new Map(items.map((item) => [item.id, item]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const revision of revisions) {
    if (revision.baselinePromiseSourceId) {
      assert.equal(revision.status, "no-progress");
      assert.equal(revision.baselinePromiseSourceId, itemById.get(revision.promiseId).primarySourceId);
      assert.deepEqual(revision.evidenceSourceIds, [revision.baselinePromiseSourceId]);
    }
    for (const sourceId of revision.evidenceSourceIds) assert.ok(sourceById.get(sourceId)?.primary, `Missing source ${sourceId}`);
  }
});

test("the pipeline tracks exactly the promises, each with reviewed specific tags", async () => {
  const taxonomy = validateTaxonomy(JSON.parse(await readFile(new URL("../automation/topic-routing/taxonomy-v2.json", import.meta.url), "utf8")));
  const { promises } = await loadTrackedPromises(root);
  assert.deepEqual(promises.map(({ id }) => id).sort(), items.filter(({ kind }) => kind === "promise").map(({ id }) => id).sort());
  for (const promise of promises) {
    assert.ok(promise.tags.length > 0 && promise.tags.every((tagId) => isAssessmentEligible(taxonomy, tagId)), `Invalid tags: ${promise.id}`);
    assert.equal(new Set(promise.tags).size, promise.tags.length, `Repeated tag: ${promise.id}`);
  }
});
