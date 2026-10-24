import assert from "node:assert/strict";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPspPageCache, pspPageContent, readPspPage, withoutEurovocDescriptors } from "../scripts/lib/psp-page-cache.mjs";

const url = (number) => `https://www.psp.cz/sqw/sd.sqw?cd=${number}&o=10`;
// A psp.cz page, as the fetcher returns it.
const html = (body, menu = "Menu") => `<html><div id="header">Hlavicka</div><div id="main-content">${body}</div><div id="menu">${menu}</div></html>`;
const page = (body, menu) => ({ bytes: new TextEncoder().encode(html(body, menu)) });

test("keeps only the content of a page, and nothing of a page without it", () => {
  assert.equal(pspPageContent('<div id="header">x</div><div id="main-content">SD 1306</div><div id="menu">y</div>'), '<div id="main-content">SD 1306</div>');
  assert.equal(pspPageContent("<html>Chyba</html>"), null);
});

test("reads a page of a closed print once and every page of an open print in every run", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  let downloads = 0;
  const download = (body) => async () => {
    downloads += 1;
    return page(body);
  };
  const first = createPspPageCache(directory, "2026-10-19");
  assert.equal(await first.read({ url: url(1), keep: true, download: download("closed") }), '<div id="main-content">closed</div>');
  // Every page is read as its content, also one that is not kept.
  assert.equal(await first.read({ url: url(2), keep: false, download: download("open") }), '<div id="main-content">open</div>');
  const second = createPspPageCache(directory, "2026-10-20");
  assert.match(await second.read({ url: url(1), keep: true, download: download("other") }), /closed/);
  assert.match(await second.read({ url: url(2), keep: false, download: download("open again") }), /open again/);
  assert.equal(downloads, 3);
  assert.equal((await readdir(directory)).length, 1);
  // A kept page whose print is open again is read again and removed.
  assert.match(await second.read({ url: url(1), keep: false, download: download("reopened") }), /reopened/);
  assert.deepEqual(await readdir(directory), []);
});

test("never keeps a page whose reader did not find what it reads, nor psp.cz's error page", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  const cache = createPspPageCache(directory, "2026-10-19");
  await cache.read({ url: url(1), keep: true, download: async () => page("Sněmovní dokument 1 Sněmovní dokument nebyl nalezen.") });
  await cache.read({ url: url(2), keep: true, download: async () => page("Bez souboru"), complete: (content) => content.includes(".docx") });
  await cache.read({ url: url(3), keep: true, download: async () => ({ bytes: new TextEncoder().encode("<html>Údržba</html>") }) });
  assert.deepEqual(await readdir(directory), []);
});

test("keeps a page only when every print it is read for is closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  const pageCache = createPspPageCache(directory, "2026-10-19");
  const pages = { pageCache, closedPrintIds: new Set(["43174"]), fetchPsp: async () => page("turn"), source: {} };
  await readPspPage(pages, url(1), ["43174", 43200]);
  // A turn of the stenographic record is read for no print and never kept.
  await readPspPage(pages, url(3), []);
  assert.deepEqual({ kept: pageCache.stats.kept, open: pageCache.stats.open }, { kept: 0, open: 2 });
  await readPspPage(pages, url(2), [43174]);
  assert.equal(pageCache.stats.kept, 1);
  // A page whose reader found nothing is read again next time.
  await readPspPage(pages, url(4), [43174], () => false);
  assert.deepEqual({ kept: pageCache.stats.kept, notKept: pageCache.stats.notKept }, { kept: 1, notKept: 1 });
});

test("checks the pages checked longest ago, not those read that day, and fails when one's content changed, not its menu", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  const cache = createPspPageCache(directory, "2026-10-19");
  for (const number of [1, 2]) await cache.read({ url: url(number), keep: true, download: async () => page(`SD ${number}`) });
  assert.deepEqual(await cache.checkSample(async () => page("never"), 5), []);
  const later = createPspPageCache(directory, "2026-10-20");
  const checked = await later.checkSample(async (pageUrl) => page(`SD ${new URL(pageUrl).searchParams.get("cd")}`, "Nové menu"), 1);
  assert.equal(checked.length, 1);
  const next = createPspPageCache(directory, "2026-10-21");
  await assert.rejects(next.checkSample(async () => page("SD 9"), 2), /psp\.cz page of a closed print changed/);
});

test("a check ignores the EUROVOC descriptors psp.cz adds to a history page later, and nothing else", async () => {
  // Print 167 of term 10: its history page read on 20 October 2026, and on 24
  // October 2026 with its descriptors added (the end of its content).
  const before = 'zákonů v částce 91 pod číslem <a href="sbirka.sqw?O=10&T=167">91/2026</a> Sb.</p>            <sqw_flush> <p><b><a href="historie.sqw?o=10&t=167&snzp=1">Navržené změny předpisů</a></b> (1)';
  const after = 'zákonů v částce 91 pod číslem <a href="sbirka.sqw?O=10&T=167">91/2026</a> Sb.</p>            <sqw_flush> <br><br><b>Deskriptory EUROVOCu:</b> <a href="tisky.sqw?et=283178">digitalizace dokumentů</a>, <a href="tisky.sqw?et=326678">elektronická správa dokumentů</a>, <a href="tisky.sqw?et=7747">informační systém</a>, <a href="tisky.sqw?et=9672">stavební právo</a>, <a href="tisky.sqw?et=104979">územní plánování</a><p><p><b><a href="historie.sqw?o=10&t=167&snzp=1">Navržené změny předpisů</a></b> (1)';
  assert.equal(withoutEurovocDescriptors(after), before);
  // Print 94: descriptors at the very end of its content.
  assert.equal(withoutEurovocDescriptors('</table> <br><br><b>Deskriptory EUROVOCu:</b> <a href="tisky.sqw?et=340817">návrh rozpočtu</a>, <a href="tisky.sqw?et=9017">státní rozpočet</a><p><div class="clear"></div>'), '</table> <div class="clear"></div>');
  const historyUrl = "https://www.psp.cz/sqw/historie.sqw?o=10&t=167";
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  await createPspPageCache(directory, "2026-10-20").read({ url: historyUrl, keep: true, download: async () => page(before) });
  assert.deepEqual(await createPspPageCache(directory, "2026-10-24").checkSample(async () => page(after), 1), [historyUrl]);
  // Kept with its descriptors, then read with others: still the same page.
  const changedDescriptors = after.replace("územní plánování", "stavební řízení");
  assert.deepEqual(await createPspPageCache(directory, "2026-10-25").checkSample(async () => page(changedDescriptors), 1), [historyUrl]);
  // Any other change still fails.
  await assert.rejects(createPspPageCache(directory, "2026-10-26").checkSample(async () => page(after.replace("91/2026", "92/2026")), 1), /psp\.cz page of a closed print changed/);
});

test("refuses a damaged page cache entry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  await writeFile(join(directory, `${"0".repeat(32)}.json`), "{}\n");
  assert.throws(() => createPspPageCache(directory, "2026-10-19"), /Invalid psp\.cz page cache entry/);
});
