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
});
