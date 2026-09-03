import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function readJsonDirectory(relativePath) {
  const directory = new URL(`../${relativePath}/`, import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, directory), "utf8"))));
}

test("published real assessments retain their approved audit and sources", async () => {
  const [promises, revisions, sources, partyPeriods] = await Promise.all([
    readJsonDirectory("data/promises"),
    readJsonDirectory("data/assessment-revisions"),
    readJsonDirectory("data/sources"),
    readJsonDirectory("data/party-periods")
  ]);
  const realPromises = promises.filter(({ isDemo }) => !isDemo);
  const realPromiseIds = new Set(realPromises.map(({ id }) => id));
  const realRevisions = revisions.filter(({ promiseId }) => realPromiseIds.has(promiseId));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  assert.deepEqual(realPromises.map(({ id }) => id).sort(), [
    "ano-2025-abolish-public-media-fees",
    "ano-2025-eet-2"
  ]);
  assert.equal(realRevisions.length, 2);

  for (const promise of realPromises) {
    const source = sourceById.get(promise.primarySourceId);
    assert.ok(source, `Missing promise source ${promise.primarySourceId}`);
    assert.equal(source.isDemo, false);
    assert.equal(source.type, "programme");
    assert.ok(source.url);
  }

  for (const revision of realRevisions) {
    assert.equal(revision.status, "moving-towards");
    assert.ok(revision.reviewProposalId);
    for (const sourceId of revision.evidenceSourceIds) {
      const source = sourceById.get(sourceId);
      assert.ok(source, `Missing published source ${sourceId}`);
      assert.equal(source.isDemo, false);
      assert.equal(source.primary, true);
      assert.ok(source.url);
    }
  }

  assert.ok(partyPeriods.every(({ indexPublished }) => indexPublished === false));
});
