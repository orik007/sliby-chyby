import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { extractPdfPages, formatPages } from "../scripts/extract-programme-text.mjs";

// Quotes drop what the PDF layout adds: white space, line breaks, and page
// footers. A hyphen at the end of a line is either a word break, which the
// quote drops, or a real hyphen, which it keeps; every other character,
// dashes included, must be the exact wording of the archived programme.
const lineBreakHyphen = "\u0000";
const canonicalSource = (text) => text.replace(/-[ \t]*\n/g, lineBreakHyphen).replace(/[\s\u00ad]/g, "");
const canonicalQuote = (text) => text.replace(/\s/g, "");
const json = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const rejectionReasons = new Set(["duplicate", "summary", "list-estimate", "not-party-statement", "truncated"]);

const manifest = await json("archive/promise-sources/manifest.json");
const programmePages = new Map();
for (const { sourceId } of manifest.entries) {
  const text = await readFile(new URL(`../research/2025-election/programme-text/${sourceId}.txt`, import.meta.url), "utf8");
  const parts = text.split(/=== PAGE (\d+) ===\n/);
  const pages = new Map();
  for (let index = 1; index < parts.length; index += 2) pages.set(Number(parts[index]), canonicalSource(parts[index + 1]));
  programmePages.set(sourceId, pages);
}

function matchesAt(text, quote, start) {
  let position = start;
  for (let index = 0; index < quote.length; position += 1) {
    if (position >= text.length) return false;
    if (text[position] === lineBreakHyphen) {
      if (quote[index] === "-") index += 1;
    } else if (text[position] === quote[index]) {
      index += 1;
    } else {
      return false;
    }
  }
  return true;
}

function assertVerbatim(sourceId, page, quote, label) {
  const pages = programmePages.get(sourceId);
  assert.ok(pages, `No programme text for ${label}`);
  const pageText = pages.get(page);
  assert.ok(pageText, `${label} names page ${page}, which ${sourceId} does not have`);
  // The quote begins on its stated page and may continue onto the next one.
  const text = pageText + (pages.get(page + 1) ?? "");
  const canonical = canonicalQuote(quote);
  let found = false;
  for (let start = text.indexOf(canonical[0]); start !== -1 && start < pageText.length && !found; start = text.indexOf(canonical[0], start + 1)) {
    found = matchesAt(text, canonical, start);
  }
  assert.ok(found, `${label} is not the exact wording beginning on page ${page} of ${sourceId}`);
  assert.doesNotMatch(quote, /Volební program hnutí ANO \/ 2025|Umíme vyřešit i složité věci \|/, `${label} contains a page footer`);
}

test("the programme text is the text of the archived PDFs", async () => {
  for (const entry of manifest.entries) {
    const expected = await readFile(new URL(`../research/2025-election/programme-text/${entry.sourceId}.txt`, import.meta.url), "utf8");
    assert.equal(formatPages(await extractPdfPages(await readFile(new URL(`../${entry.path}`, import.meta.url)))), expected, entry.sourceId);
  }
});

test("every published item quotes its programme exactly", async () => {
  const directory = new URL("../data/promises/", import.meta.url);
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".json"))) {
    const item = JSON.parse(await readFile(new URL(file, directory), "utf8"));
    assertVerbatim(item.primarySourceId, item.sourceLocator.page, item.originalText, item.id);
  }
});

test("every rejected occurrence quotes its programme exactly and states a technical reason", async () => {
  const { schemaVersion, rejected } = await json("research/2025-election/rejected.json");
  assert.equal(schemaVersion, "1.0.0");
  const directory = new URL("../data/promises/", import.meta.url);
  const published = new Map();
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".json"))) {
    const item = JSON.parse(await readFile(new URL(file, directory), "utf8"));
    published.set(item.id, item);
  }
  for (const [index, occurrence] of rejected.entries()) {
    const label = `rejected occurrence ${index}`;
    assertVerbatim(occurrence.sourceId, occurrence.locator.page, occurrence.originalTextCz, label);
    assert.ok(rejectionReasons.has(occurrence.reason), `${label} has no technical reason code`);
    if (occurrence.reason === "duplicate") {
      assert.equal(published.get(occurrence.duplicateOf)?.primarySourceId, occurrence.sourceId, `${label} must name a published item of the same programme`);
    } else {
      assert.equal(occurrence.duplicateOf, undefined, label);
    }
  }
});
