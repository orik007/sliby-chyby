import { createHash } from "node:crypto";
import { isoDate, loadCacheEntries, oldestChecked, removeCacheEntry, saveCacheEntry } from "./audit-cache-entries.mjs";
import { invariant, sha256 } from "./collector-core.mjs";
import { decodePspPage, pspPageOptions } from "./psp-print-documents.mjs";

/**
 * The psp.cz pages of closed prints, kept in the audit state under the rule
 * in docs/evidence-pipeline.md (Chamber data rules, Closed prints).
 */
export const pspPageCacheVersion = "psp-page-cache-v1";

/** The content of a psp.cz page (decoded HTML) that its readers read, or null. */
export function pspPageContent(html) {
  const start = html.indexOf('<div id="main-content"');
  const end = start >= 0 ? html.indexOf('<div id="menu"', start) : -1;
  return start >= 0 && end > start ? html.slice(start, end) : null;
}

// psp.cz adds a print's EUROVOC descriptors to its history page later (print
// 167 of term 10: not on 20 October 2026, on 24 October 2026). No reader reads
// them, so a check compares a kept page without them (docs/evidence-pipeline.md,
// Closed prints).
const eurovocDescriptors = /<br><br><b>Deskriptory EUROVOCu:<\/b>[^<]*(?:<a [^>]*>[^<]*<\/a>[^<]*)*<p>/u;
export function withoutEurovocDescriptors(content) {
  return content.replace(eurovocDescriptors, "");
}

// "Sněmovní dokument nebyl nalezen.", "Dokument nebyl nalezen." (checked on
// 19 October 2026).
const notFoundPattern = /okument nebyl nalezen\./u;

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
 * download, complete })` returns the content of the page at `url` (the
 * whole page when it has none): its kept content when `keep` and the cache
 * holds it, otherwise that of the psp.cz response `download()` returns,
 * saved at once when `keep` and `complete(content)` (its reader found in it
 * what it reads). A kept page read without `keep` is removed.
 * `checkSample(download, sampleSize)` downloads the pages checked longest
 * ago and fails on the first one whose content changed in anything but its
 * EUROVOC descriptors.
 */
export function createPspPageCache(directory, today) {
  invariant(isoDate.test(today), "The page cache needs the run date");
  const entries = loadCacheEntries(directory, /^[0-9a-f]{32}$/, validEntry, "psp.cz page cache");
  const stats = { fromCache: 0, kept: 0, notKept: 0, open: 0, checked: 0 };
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
      const content = pspPageContent(html);
      if (!keep) {
        stats.open += 1;
        if (cached) {
          entries.delete(id);
          removeCacheEntry(directory, id);
        }
        return content ?? html;
      }
      // A page without its content, psp.cz's not-found page (served with HTTP
      // 200), or one whose reader found nothing in it is read again next run.
      if (content === null || notFoundPattern.test(content) || !complete(content)) {
        stats.notKept += 1;
        return content ?? html;
      }
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
        invariant(content !== null && withoutEurovocDescriptors(content) === withoutEurovocDescriptors(entry.content), `psp.cz page of a closed print changed (${entry.url}): the rule that a closed print's pages do not change (docs/evidence-pipeline.md) no longer holds`);
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
 * is closed (`closedPrintIds`) and `complete(content)`, downloaded through
 * `fetchPsp` otherwise.
 */
export function readPspPage({ pageCache, closedPrintIds, fetchPsp, source }, url, printIds, complete = undefined) {
  const keep = printIds.length > 0 && printIds.every((printId) => closedPrintIds.has(String(printId)));
  return pageCache.read({ url, keep, download: () => fetchPsp(source, url, pspPageOptions), complete });
}
