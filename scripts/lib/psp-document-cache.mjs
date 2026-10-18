import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { invariant, sha256 } from "./collector-core.mjs";

/**
 * The text of every psp.cz document file a run has read, kept in the audit
 * state under the file's document ID (`idd` of `orig2.sqw`), because a file
 * under an ID does not change (docs/evidence-pipeline.md, Chamber data
 * rules): a file is downloaded once, and every later run reads its text from
 * here. Each ID is one file, `<dir>/<idd>.json`, with the file's SHA-256 and
 * length, the run dates (Prague) it was read and last checked, and its text
 * per extraction (`extractions`): what an extraction returned, or the reason
 * it could not read the file. An extraction is named with its version
 * ("docx-paragraphs-v1"), so a changed extractor reads the file again. Every
 * run downloads again the `sampleSize` files checked longest ago and fails
 * when one of them no longer has its SHA-256.
 */
export const pspDocumentCacheVersion = "psp-document-cache-v1";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

// The numeric document ID of an orig2.sqw URL, or null without one.
export function pspDocumentId(url) {
  const id = new URL(url).searchParams.get("idd");
  return /^\d+$/.test(id ?? "") ? id : null;
}

function validEntry(entry, id) {
  return entry?.schemaVersion === pspDocumentCacheVersion && entry.id === id && /^[0-9a-f]{64}$/.test(entry.fileSha256 ?? "")
    && Number.isInteger(entry.byteLength) && isoDate.test(entry.readOn ?? "") && isoDate.test(entry.checkedOn ?? "")
    && typeof entry.url === "string" && entry.extractions && typeof entry.extractions === "object";
}

// Written to a temporary file and renamed, so a run stopped mid-write keeps
// the previous complete entry. The temporary file is named with a leading dot
// and `.tmp`, which .gitignore keeps out of the audit state.
function save(directory, entry) {
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `.${entry.id}.json.tmp`);
  writeFileSync(temporary, `${JSON.stringify(entry)}\n`);
  renameSync(temporary, join(directory, `${entry.id}.json`));
}

/**
 * The cache in `directory` on the run date `today`. `read(url, extraction,
 * extract, download)` returns `{ value, error, downloaded }`: the text that
 * `extract(bytes)` gives (an exception is the error, kept like a text), from
 * the cache when it holds this extraction of the ID, otherwise from
 * `download()`, which must return the file's bytes; a file downloaded again
 * for another extraction must have its SHA-256. Every entry is saved at once,
 * so a failed run keeps what it read. A URL without a document ID is never
 * cached. `checkSample(download, sampleSize)` downloads the files checked
 * longest ago (by `checkedOn`, then ID) and fails on the first one whose file
 * changed.
 */
export function createPspDocumentCache(directory, today) {
  invariant(isoDate.test(today), "The document cache needs the run date");
  const entries = new Map();
  if (existsSync(directory)) {
    for (const name of readdirSync(directory)) {
      if (!/^\d+\.json$/.test(name)) continue;
      const id = name.slice(0, -".json".length);
      let entry = null;
      try {
        entry = JSON.parse(readFileSync(join(directory, name), "utf8"));
      } catch {
        // Reported below with the path.
      }
      invariant(validEntry(entry, id), `Invalid psp.cz document cache entry: ${join(directory, name)}`);
      entries.set(id, entry);
    }
  }
  const stats = { fromCache: 0, downloaded: 0, checked: 0 };
  const verified = (entry, bytes) => {
    const fileSha256 = sha256(bytes);
    invariant(fileSha256 === entry.fileSha256, `psp.cz document ${entry.id} changed under the same ID (${entry.url}): SHA-256 ${fileSha256} instead of ${entry.fileSha256}; the rule that a file under an ID does not change (docs/evidence-pipeline.md) no longer holds`);
  };
  return {
    stats,
    async read(url, extraction, extract, download) {
      const id = pspDocumentId(url);
      const run = async (bytes) => {
        try {
          return { value: await extract(bytes), error: null };
        } catch (error) {
          return { value: null, error: error instanceof Error ? error.message : String(error) };
        }
      };
      if (!id) {
        const bytes = await download();
        stats.downloaded += 1;
        return { ...(await run(bytes)), downloaded: true, bytes };
      }
      const cached = entries.get(id);
      if (cached?.extractions[extraction]) {
        stats.fromCache += 1;
        return { ...cached.extractions[extraction], downloaded: false, bytes: null };
      }
      const bytes = await download();
      stats.downloaded += 1;
      if (cached) verified(cached, bytes);
      const result = await run(bytes);
      const entry = cached ?? { schemaVersion: pspDocumentCacheVersion, id, url, fileSha256: sha256(bytes), byteLength: bytes.byteLength, readOn: today, checkedOn: today, extractions: {} };
      entry.extractions[extraction] = result;
      entries.set(id, entry);
      save(directory, entry);
      return { ...result, downloaded: true, bytes };
    },
    async checkSample(download, sampleSize) {
      const sample = [...entries.values()]
        .filter(({ checkedOn }) => checkedOn < today)
        .sort((left, right) => left.checkedOn.localeCompare(right.checkedOn) || Number(left.id) - Number(right.id))
        .slice(0, sampleSize);
      for (const entry of sample) {
        verified(entry, await download(entry.url));
        entry.checkedOn = today;
        save(directory, entry);
        stats.checked += 1;
      }
      return sample.map(({ id }) => id);
    },
    size: () => entries.size
  };
}
