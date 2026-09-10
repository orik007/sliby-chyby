import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export async function loadPublishedPromiseIds(directory) {
  const files = (await readdir(resolve(directory))).filter((file) => file.endsWith(".json"));
  const ids = new Set();
  for (const file of files) {
    const promise = JSON.parse(await readFile(resolve(directory, file), "utf8"));
    invariant(typeof promise.id === "string" && promise.id.length > 0, `Published promise ${file} is missing id`);
    invariant(!ids.has(promise.id), `Duplicate published promise id: ${promise.id}`);
    ids.add(promise.id);
  }
  return ids;
}

export function publishedMatchingRegistry(registry, publishedPromiseIds) {
  const promises = registry.promises.filter(({ id }) => publishedPromiseIds.has(id));
  const matchingIds = new Set(registry.promises.map(({ id }) => id));
  for (const id of publishedPromiseIds) invariant(matchingIds.has(id), `Published promise ${id} is missing matching configuration`);
  return { ...registry, promises };
}
