import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { invariant, sha256 } from "./collector-core.mjs";
import { decodePspPage } from "./psp-print-documents.mjs";

/**
 * The psp.cz pages of closed prints, kept in the audit state
 * (docs/evidence-pipeline.md, Chamber data rules, Closed prints). A print in
 * the state "KONEC" does not change, so a page read only for closed prints
 * is downloaded once and read from here in every later run; every other page
 * is downloaded in every run. A page is kept as its content (the part of the
 * page from `<div id="main-content"` to `<div id="menu"`), which every reader
 * of a psp.cz page reads, so a change of psp.cz's menu or footer changes no
 * kept page. Each page is one file, `<dir>/<id>.json`, the ID the start of
 * the SHA-256 of its URL, with the content's SHA-256 and the run dates
 * (Prague) it was read and last checked. Every run downloads again the
 * `sampleSize` pages checked longest ago and fails when one of them no
 * longer has the same content.
 */
export const pspPageCacheVersion = "psp-page-cache-v1";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** The content of a psp.cz page (decoded HTML) that its readers read. */
export function pspPageContent(html) {
  const start = html.indexOf('<div id="main-content"');
  const end = html.indexOf('<div id="menu"', start);
  invariant(start >= 0 && end > start, "psp.cz page has no main content followed by the menu");
  return html.slice(start, end);
}

function pageId(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function validEntry(entry, id) {
  return entry?.schemaVersion === pspPageCacheVersion && entry.id === id && typeof entry.url === "string" && pageId(entry.url) === id
    && typeof entry.content === "string" && entry.contentSha256 === sha256(entry.content)
    && isoDate.test(entry.readOn ?? "") && isoDate.test(entry.checkedOn ?? "");
}

// Written to a temporary file and renamed, so a run stopped mid-write keeps
// the previous complete entry; .gitignore keeps the dot file out of the
// audit state.
function save(directory, entry) {
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `.${entry.id}.json.tmp`);
  writeFileSync(temporary, `${JSON.stringify(entry)}\n`);
  renameSync(temporary, join(directory, `${entry.id}.json`));
}

/**
 * The cache in `directory` on the run date `today`. `content(url, keep,
 * download)` returns the content of the page at `url`: from the cache when
 * it holds the page, otherwise from `download()`, which must return the
 * psp.cz response; a page downloaded with `keep` is saved at once. A kept
 * page that is read without `keep` (its print is open again) is downloaded
 * and removed from the cache. `checkSample(download, sampleSize)`
 * downloads the pages checked longest ago (by `checkedOn`, then ID) and
 * fails on the first one whose content changed.
 */
export function createPspPageCache(directory, today) {
  invariant(isoDate.test(today), "The page cache needs the run date");
  const entries = new Map();
  if (existsSync(directory)) {
    for (const name of readdirSync(directory)) {
      if (!/^[0-9a-f]{32}\.json$/.test(name)) continue;
      const id = name.slice(0, -".json".length);
      let entry = null;
      try {
        entry = JSON.parse(readFileSync(join(directory, name), "utf8"));
      } catch {
        // Reported below with the path.
      }
      invariant(validEntry(entry, id), `Invalid psp.cz page cache entry: ${join(directory, name)}`);
      entries.set(id, entry);
    }
  }
  const stats = { fromCache: 0, downloaded: 0, kept: 0, checked: 0 };
  return {
    stats,
    async content(url, keep, download) {
      const id = pageId(url);
      const cached = entries.get(id);
      if (keep && cached) {
        stats.fromCache += 1;
        return cached.content;
      }
      const content = pspPageContent(decodePspPage(await download()));
      stats.downloaded += 1;
      if (!keep && cached) {
        entries.delete(id);
        rmSync(join(directory, `${id}.json`), { force: true });
      }
      if (keep) {
        const entry = { schemaVersion: pspPageCacheVersion, id, url, contentSha256: sha256(content), readOn: today, checkedOn: today, content };
        entries.set(id, entry);
        save(directory, entry);
        stats.kept += 1;
      }
      return content;
    },
    async checkSample(download, sampleSize) {
      const sample = [...entries.values()]
        .sort((left, right) => left.checkedOn.localeCompare(right.checkedOn) || left.id.localeCompare(right.id))
        .slice(0, sampleSize);
      for (const entry of sample) {
        const content = pspPageContent(decodePspPage(await download(entry.url)));
        invariant(sha256(content) === entry.contentSha256, `psp.cz page of a closed print changed (${entry.url}): the rule that a closed print's pages do not change (docs/evidence-pipeline.md) no longer holds`);
        entry.checkedOn = today;
        save(directory, entry);
        stats.checked += 1;
      }
      return sample.map(({ url }) => url);
    },
    size: () => entries.size
  };
}
