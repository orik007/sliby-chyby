import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { invariant } from "./collector-core.mjs";

/**
 * The files of a cache in the audit state that keeps one JSON entry per ID
 * (`<dir>/<id>.json`, with `id` and the run dates `readOn` and `checkedOn`):
 * the psp.cz document cache and the psp.cz page cache.
 */
export const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Every entry of `directory` whose name matches `idPattern`; an invalid one fails at once. */
export function loadCacheEntries(directory, idPattern, validEntry, label) {
  const entries = new Map();
  if (!existsSync(directory)) return entries;
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    if (!idPattern.test(id)) continue;
    let entry = null;
    try {
      entry = JSON.parse(readFileSync(join(directory, name), "utf8"));
    } catch {
      // Reported below with the path.
    }
    invariant(validEntry(entry, id), `Invalid ${label} entry: ${join(directory, name)}`);
    entries.set(id, entry);
  }
  return entries;
}

// Written to a temporary file and renamed, so a run stopped mid-write keeps
// the previous complete entry. The temporary file is named with a leading dot
// and `.tmp`, which .gitignore keeps out of the audit state.
export function saveCacheEntry(directory, entry) {
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `.${entry.id}.json.tmp`);
  writeFileSync(temporary, `${JSON.stringify(entry)}\n`);
  renameSync(temporary, join(directory, `${entry.id}.json`));
}

export function removeCacheEntry(directory, id) {
  rmSync(join(directory, `${id}.json`), { force: true });
}

/** The `sampleSize` entries checked longest ago (by `checkedOn`, then ID) of those `include` accepts. */
export function oldestChecked(entries, sampleSize, include = () => true) {
  return [...entries.values()]
    .filter(include)
    .sort((left, right) => left.checkedOn.localeCompare(right.checkedOn) || left.id.localeCompare(right.id, "en", { numeric: true }))
    .slice(0, sampleSize);
}
