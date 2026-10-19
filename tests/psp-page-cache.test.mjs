import assert from "node:assert/strict";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPspPageCache, pspPageContent } from "../scripts/lib/psp-page-cache.mjs";

const url = (number) => `https://www.psp.cz/sqw/sd.sqw?cd=${number}&o=10`;
// A psp.cz page in windows-1250, as the fetcher returns it.
const page = (body, menu = "Menu") => ({ bytes: new Uint8Array(Buffer.from(`<html><div id="header">Hlavička</div><div id="main-content">${body}</div><div id="menu">${menu}</div></html>`, "latin1")) });

test("keeps only the content of a page", () => {
  assert.equal(pspPageContent('<div id="header">x</div><div id="main-content">SD 1306</div><div id="menu">y</div>'), '<div id="main-content">SD 1306</div>');
  assert.throws(() => pspPageContent("<html>Chyba</html>"), /no main content/);
});

test("reads a page of a closed print once and every page of an open print in every run", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  let downloads = 0;
  const download = (body) => async () => {
    downloads += 1;
    return page(body);
  };
  const first = createPspPageCache(directory, "2026-10-19");
  assert.match(await first.content(url(1), true, download("closed")), /closed/);
  assert.match(await first.content(url(2), false, download("open")), /open/);
  const second = createPspPageCache(directory, "2026-10-20");
  assert.match(await second.content(url(1), true, download("other")), /closed/);
  assert.match(await second.content(url(2), false, download("open again")), /open again/);
  assert.equal(downloads, 3);
  assert.equal((await readdir(directory)).length, 1);
  // A kept page whose print is open again is read again and removed.
  assert.match(await second.content(url(1), false, download("reopened")), /reopened/);
  assert.deepEqual(await readdir(directory), []);
});

test("checks the pages checked longest ago and fails when one's content changed, not its menu", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  const cache = createPspPageCache(directory, "2026-10-19");
  for (const number of [1, 2]) await cache.content(url(number), true, async () => page(`SD ${number}`));
  const later = createPspPageCache(directory, "2026-10-20");
  const checked = await later.checkSample(async (pageUrl) => page(`SD ${new URL(pageUrl).searchParams.get("cd")}`, "Nové menu"), 1);
  assert.equal(checked.length, 1);
  const next = createPspPageCache(directory, "2026-10-21");
  await assert.rejects(next.checkSample(async () => page("SD 9"), 2), /psp\.cz page of a closed print changed/);
});

test("refuses a damaged page cache entry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-pages-"));
  await writeFile(join(directory, `${"0".repeat(32)}.json`), "{}\n");
  assert.throws(() => createPspPageCache(directory, "2026-10-19"), /Invalid psp\.cz page cache entry/);
});
