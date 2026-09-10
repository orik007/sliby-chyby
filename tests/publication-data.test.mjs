import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadPublishedPromiseIds, publishedMatchingRegistry } from "../scripts/lib/published-promises.mjs";

async function readJsonDirectory(relativePath) {
  const directory = new URL(`../${relativePath}/`, import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, directory), "utf8"))));
}

test("production assessments retain their approved audit and sources", async () => {
  const [promises, revisions, sources, partyPeriods] = await Promise.all([
    readJsonDirectory("data/promises"),
    readJsonDirectory("data/assessment-revisions"),
    readJsonDirectory("data/sources"),
    readJsonDirectory("data/party-periods")
  ]);
  assert.ok(promises.length > 0);
  assert.ok(promises.every(({ isDemo }) => isDemo === false));
  assert.ok(revisions.every(({ isDemo }) => isDemo === false));
  assert.ok(sources.every(({ isDemo }) => isDemo === false));
  assert.ok(partyPeriods.every(({ isDemo }) => isDemo === false));

  const promiseIds = new Set(promises.map(({ id }) => id));
  const revisedPromiseIds = new Set(revisions.map(({ promiseId }) => promiseId));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  assert.ok(promiseIds.has("ano-2025-abolish-public-media-fees"));
  assert.ok(promiseIds.has("ano-2025-eet-2"));
  assert.equal(promises.filter(({ partyPeriodId }) => partyPeriodId === "cz-ps-2025--ano").length, 22, "The current confirmed ANO catalog must be public");
  assert.deepEqual([...revisedPromiseIds].sort(), [...promiseIds].sort(), "Every published promise must have a current score");

  for (const promise of promises) {
    const source = sourceById.get(promise.primarySourceId);
    assert.ok(source, `Missing promise source ${promise.primarySourceId}`);
    assert.equal(source.isDemo, false);
    assert.equal(source.type, "programme");
    assert.ok(source.url);
  }

  for (const revision of revisions) {
    assert.ok(promiseIds.has(revision.promiseId));
    assert.ok(revision.reviewProposalId || revision.baselinePromiseSourceId);
    if (revision.baselinePromiseSourceId) {
      const promise = promises.find(({ id }) => id === revision.promiseId);
      assert.equal(revision.status, "no-progress");
      assert.equal(revision.baselinePromiseSourceId, promise.primarySourceId);
      assert.deepEqual(revision.evidenceSourceIds, [revision.baselinePromiseSourceId]);
    }
    for (const sourceId of revision.evidenceSourceIds) {
      const source = sourceById.get(sourceId);
      assert.ok(source, `Missing published source ${sourceId}`);
      assert.equal(source.isDemo, false);
      assert.equal(source.primary, true);
      assert.ok(source.url);
    }
  }

  assert.ok(partyPeriods.every((partyPeriod) => !("indexPublished" in partyPeriod)));
});

test("the evidence pipeline selects exactly the published promises", async () => {
  const [registry, publishedIds] = await Promise.all([
    (async () => JSON.parse(await readFile(new URL("../automation/matching/promises.json", import.meta.url), "utf8")))(),
    loadPublishedPromiseIds(fileURLToPath(new URL("../data/promises/", import.meta.url)))
  ]);
  const selected = publishedMatchingRegistry(registry, publishedIds);
  assert.deepEqual(selected.promises.map(({ id }) => id).sort(), [...publishedIds].sort());
});
