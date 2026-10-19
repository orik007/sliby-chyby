import { createHash } from "node:crypto";
import { isoDate, loadCacheEntries, oldestChecked, removeCacheEntry, saveCacheEntry } from "./audit-cache-entries.mjs";
import { invariant, sha256 } from "./collector-core.mjs";
import { decodePspPage, pspPageOptions } from "./psp-print-documents.mjs";

/**
 * The psp.cz pages of closed prints, kept in the audit state
 * (docs/evidence-pipeline.md, Chamber data rules, Closed prints). A print in
 * the state type "KONEC" does not change, so a page read only for closed
 * prints is downloaded once and read from here in every later run; every
 * other page is downloaded in every run. A page is kept as its content (from
 * `<div id="main-content"` to `<div id="menu"`), which is all its readers
 * read, so a change of psp.cz's menu or footer changes no kept page; it is
 * kept only when its reader found in it what it reads, so an error page
 * psp.cz serves with HTTP 200 ("Dokument nebyl nalezen.") is never kept.
 * Each page is one file, `<dir>/<id>.json`, the ID the start of the SHA-256
 * of its URL, with the content's SHA-256 and the run dates (Prague) it was
 * read and last checked. Every run downloads again the `sampleSize` pages
 * checked longest ago, of those not read that day, and fails when one of
 * them no longer has the same content.
 */
export const pspPageCacheVersion = "psp-page-cache-v1";

/** The content of a psp.cz page (decoded HTML) that its readers read, or null. */
export function pspPageContent(html) {
  const start = html.indexOf('<div id="main-content"');
  const end = start >= 0 ? html.indexOf('<div id="menu"', start) : -1;
  return start >= 0 && end > start ? html.slice(start, end) : null;
}

function pageId(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function validEntry(entry, id) {
  return entry?.schemaVersion === pspPageCacheVersion && entry.id === id && typeof entry.url === "string" && pageId(entry.url) === id
    && typeof entry.content === "string" && entry.contentSha256 === sha256(entry.content)
    && isoDate.test(entry.readOn ?? "") && isoDate.test(entry.checkedOn ?? "");
}

/**
 * The cache in `directory` on the run date `today`. `read({ url, keep,
 * download, complete })` returns the page at `url`: its kept content when
 * `keep` and the cache holds it; otherwise the page `download()` returns
 * (the psp.cz response), decoded, whose content is saved at once when
 * `keep` and `complete(content)` (its reader found what it reads in it). A
 * kept page read without `keep` (its print is open again) is removed.
 * `checkSample(download, sampleSize)` downloads the pages checked longest
 * ago and fails on the first one whose content changed.
 */
export function createPspPageCache(directory, today) {
  invariant(isoDate.test(today), "The page cache needs the run date");
  const entries = loadCacheEntries(directory, /^[0-9a-f]{32}$/, validEntry, "psp.cz page cache");
  const stats = { fromCache: 0, downloaded: 0, kept: 0, checked: 0 };
  return {
    stats,
    async read({ url, keep, download, complete = () => true }) {
      const id = pageId(url);
      const cached = entries.get(id);
      if (keep && cached) {
        stats.fromCache += 1;
        return cached.content;
      }
      const html = decodePspPage(await download());
      stats.downloaded += 1;
      if (!keep && cached) {
        entries.delete(id);
        removeCacheEntry(directory, id);
      }
      const content = keep ? pspPageContent(html) : null;
      if (content === null || /nebyl nalezen/u.test(content) || !complete(content)) return html;
      const entry = { schemaVersion: pspPageCacheVersion, id, url, contentSha256: sha256(content), readOn: today, checkedOn: today, content };
      entries.set(id, entry);
      saveCacheEntry(directory, entry);
      stats.kept += 1;
      return content;
    },
    async checkSample(download, sampleSize) {
      // A page read this day is as fresh as a check.
      const sample = oldestChecked(entries, sampleSize, ({ readOn }) => readOn < today);
      for (const entry of sample) {
        const content = pspPageContent(decodePspPage(await download(entry.url)));
        invariant(content !== null && sha256(content) === entry.contentSha256, `psp.cz page of a closed print changed (${entry.url}): the rule that a closed print's pages do not change (docs/evidence-pipeline.md) no longer holds`);
        entry.checkedOn = today;
        saveCacheEntry(directory, entry);
        stats.checked += 1;
      }
      return sample.map(({ url }) => url);
    },
    size: () => entries.size
  };
}

/**
 * A psp.cz page read for the prints `printIds`: kept when every one of them
 * is closed (`closedPrintIds`), downloaded through `fetchPsp` otherwise.
 * `complete(content)` says whether its reader found what it reads.
 */
export function readPspPage({ pageCache, closedPrintIds, fetchPsp, source }, url, printIds, complete = undefined) {
  const keep = printIds.length > 0 && printIds.every((printId) => closedPrintIds.has(String(printId)));
  return pageCache.read({ url, keep, download: () => fetchPsp(source, url, pspPageOptions), complete });
}
