import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256 } from "../scripts/lib/collector-core.mjs";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { awaitsPromulgation, createPspPageCache, describePageChange, pspPageContent, readPspPage, comparablePageContent } from "../scripts/lib/psp-page-cache.mjs";

const url = (number) => `https://www.psp.cz/sqw/sd.sqw?cd=${number}&o=10`;
// A psp.cz page (its fixtures are ASCII: psp.cz pages are windows-1250), as the fetcher returns it.
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
  assert.equal(comparablePageContent(after, "https://www.psp.cz/sqw/historie.sqw?o=10&t=167"), before);
  // Print 94: descriptors at the very end of its content.
  assert.equal(comparablePageContent('</table> <br><br><b>Deskriptory EUROVOCu:</b> <a href="tisky.sqw?et=340817">návrh rozpočtu</a>, <a href="tisky.sqw?et=9017">státní rozpočet</a><p><div class="clear"></div>', "https://www.psp.cz/sqw/historie.sqw?o=10&t=94"), '</table> <div class="clear"></div>');
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

test("a check ignores the number psp.cz writes into a history step's HTML comment", async () => {
  // Print 16 of term 10: its third-reading step read on 20 October 2026 and on
  // 2 November 2026, differing only in this comment.
  const before = '<p><strong class="highlight">3. Čtení</strong> proběhlo <a href="../eknih/2025ps/stenprot/027schuz/27-1.html#q55">10.&nbsp;7.&nbsp;2026</a> na 27. schůzi.<!--- 1--> Návrh zákona <B>schválen</B>';
  const after = before.replace("<!--- 1-->", "<!--- 4-->");
  assert.equal(comparablePageContent(after, "https://www.psp.cz/sqw/historie.sqw?o=10&t=16"), comparablePageContent(before, "https://www.psp.cz/sqw/historie.sqw?o=10&t=16"));
  // On any other page the number is compared.
  assert.notEqual(comparablePageContent(after, "https://www.psp.cz/sqw/sd.sqw?cd=535&o=10"), comparablePageContent(before, "https://www.psp.cz/sqw/sd.sqw?cd=535&o=10"));
  const historyUrl = "https://www.psp.cz/sqw/historie.sqw?o=10&t=16";
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  await createPspPageCache(directory, "2026-10-20").read({ url: historyUrl, keep: true, download: async () => page(before) });
  assert.deepEqual(await createPspPageCache(directory, "2026-11-02").checkSample(async () => page(after), 1), [historyUrl]);
  await assert.rejects(createPspPageCache(directory, "2026-11-03").checkSample(async () => page(after.replace("schválen", "zamítnut")), 1), /psp\.cz page of a closed print changed/);
  // Any other comment is compared: some carry data.
  const withData = '<!-- idd_pdf_is=1, pdf_all:1, idd_id_tf=14 --><li class="docx">';
  assert.notEqual(comparablePageContent(withData.replace("idd_pdf_is=1", "idd_pdf_is=0"), "https://www.psp.cz/sqw/historie.sqw?o=10&t=16"), comparablePageContent(withData, "https://www.psp.cz/sqw/historie.sqw?o=10&t=16"));
  // A number inside the EUROVOC descriptors does not hide them.
  const descriptors = '</table> <br><br><b>Deskriptory EUROVOCu:</b> <a href="tisky.sqw?et=1">a</a>,<!--- 2--> <a href="tisky.sqw?et=2">b</a><p><div class="clear"></div>';
  assert.equal(comparablePageContent(descriptors, "https://www.psp.cz/sqw/historie.sqw?o=10&t=16"), '</table> <div class="clear"></div>');
});

test("a changed page is handed over with both versions before the check fails, and where it changed is described", async () => {
  const historyUrl = "https://www.psp.cz/sqw/historie.sqw?o=10&t=76";
  const before = "<p>Navrh zakona odeslan k vyhlaseni 20.&nbsp;10.&nbsp;2026.</p><p>Souvisejici tisk: 77</p>";
  const after = "<p>Navrh zakona odeslan k vyhlaseni 20.&nbsp;10.&nbsp;2026.</p><p>Zakon vyhlasen ve Sbirce zakonu pod cislem 300/2026 Sb.</p><p>Souvisejici tisk: 77</p>";
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  await createPspPageCache(directory, "2026-10-21").read({ url: historyUrl, keep: true, download: async () => page(before) });
  const changes = [];
  await assert.rejects(createPspPageCache(directory, "2026-11-07").checkSample(async () => page(after), 1, async (change) => changes.push(change)), /psp\.cz page of a closed print changed/);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].url, historyUrl);
  assert.equal(changes[0].readOn, "2026-10-21");
  assert.ok(changes[0].after.includes("300/2026"));
  const change = describePageChange(changes[0].before, changes[0].after);
  assert.equal(change.before, "");
  assert.match(change.after, /^Zakon vyhlasen ve Sbirce zakonu pod cislem 300\/2026 Sb\. ?$/);
  assert.match(change.context, /odeslan k vyhlaseni 20\. 10\. 2026\. $/);
  // An unchanged page is not handed over.
  const unchanged = [];
  await createPspPageCache(directory, "2026-11-08").read({ url: "https://www.psp.cz/sqw/historie.sqw?o=10&t=77", keep: true, download: async () => page(before) });
  await createPspPageCache(directory, "2026-11-09").checkSample(async () => page(before), 1, async (change) => unchanged.push(change)).catch(() => {});
  assert.deepEqual(unchanged.filter(({ url }) => url.endsWith("t=77")), []);
});

// A page in psp.cz's windows-1250, for text with Czech letters.
const cp1250 = { "á": 0xe1, "é": 0xe9, "í": 0xed, "ý": 0xfd, "ú": 0xfa, "ů": 0xf9, "ě": 0xec, "š": 0x9a, "č": 0xe8, "ř": 0xf8, "ž": 0x9e, "Š": 0x8a };
const czechPage = (body) => ({ bytes: Uint8Array.from([...html(body)].map((character) => cp1250[character] ?? character.charCodeAt(0))) });

test("a history page of an act sent for promulgation but not yet promulgated is neither kept nor read from the cache", async () => {
  // Print 76 of term 10: read on 21 October 2026, and on 7 November 2026.
  const historyUrl = "https://www.psp.cz/sqw/historie.sqw?o=10&t=76";
  const sent = '<h1>Sněmovní tisk <a href="tisky.sqw?o=10&t=76">76</a></h1><p>Schválený zákon odeslán k publikaci ve Sbírce zákonů 20.&nbsp;10.&nbsp;2026.</p>';
  const promulgated = `${sent}<p>Zákon vyhlášen 22.&nbsp;10.&nbsp;2026 ve Sbírce zákonů v částce 195 pod číslem <a href="sbirka.sqw?O=10&T=76">195/2026</a> Sb.</p>`;
  assert.equal(awaitsPromulgation(historyUrl, sent), true);
  assert.equal(awaitsPromulgation(historyUrl, promulgated), false);
  assert.equal(awaitsPromulgation("https://www.psp.cz/sqw/text/tisk.sqw?o=10&ct=76&ct1=0", sent), false, "only a history page waits for its promulgation");

  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  const first = createPspPageCache(directory, "2026-10-21");
  await first.read({ url: historyUrl, keep: true, download: async () => czechPage(sent) });
  assert.equal(first.stats.notKept, 1);
  assert.deepEqual(await readdir(directory), []);

  // A page kept before this rule is removed when the cache is loaded, and the
  // promulgated page is read and kept.
  const entryId = createHash("sha256").update(historyUrl).digest("hex").slice(0, 32);
  await writeFile(join(directory, `${entryId}.json`), JSON.stringify({ schemaVersion: "psp-page-cache-v1", id: entryId, url: historyUrl, contentSha256: sha256(sent), readOn: "2026-10-21", checkedOn: "2026-10-21", content: sent }));
  const later = createPspPageCache(directory, "2026-11-07");
  assert.equal(later.stats.awaitingPromulgation, 1);
  assert.deepEqual(await readdir(directory), []);
  const content = await later.read({ url: historyUrl, keep: true, download: async () => czechPage(promulgated) });
  assert.match(content, /195\/2026/);
  assert.equal(later.stats.kept, 1);
});
