import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

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
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  assert.ok(promiseIds.has("ano-2025-abolish-public-media-fees"));
  assert.ok(promiseIds.has("ano-2025-eet-2"));

  for (const promise of promises) {
    const source = sourceById.get(promise.primarySourceId);
    assert.ok(source, `Missing promise source ${promise.primarySourceId}`);
    assert.equal(source.isDemo, false);
    assert.equal(source.type, "programme");
    assert.ok(source.url);
  }

  for (const revision of revisions) {
    assert.ok(promiseIds.has(revision.promiseId));
    assert.ok(revision.reviewProposalId);
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
