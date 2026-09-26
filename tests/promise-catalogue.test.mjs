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

const notCataloguedReasons = new Set(["heading", "layout", "description", "justification", "criticism", "appeal"]);

// Each programme is one canonical stream; a page is its range in the stream.
const manifest = await json("archive/promise-sources/manifest.json");
const programmes = new Map();
for (const { sourceId } of manifest.entries) {
  const text = await readFile(new URL(`../research/2025-election/programme-text/${sourceId}.txt`, import.meta.url), "utf8");
  const parts = text.split(/=== PAGE (\d+) ===\n/);
  const pageStarts = new Map();
  let stream = "";
  for (let index = 1; index < parts.length; index += 2) {
    pageStarts.set(Number(parts[index]), stream.length);
    stream += canonicalSource(parts[index + 1]);
  }
  programmes.set(sourceId, { stream, pageStarts });
}

function matchEnd(text, quote, start) {
  let position = start;
  for (let index = 0; index < quote.length; position += 1) {
    if (position >= text.length) return -1;
    if (text[position] === lineBreakHyphen) {
      if (quote[index] === "-") index += 1;
    } else if (text[position] === quote[index]) {
      index += 1;
    } else {
      return -1;
    }
  }
  return position;
}

// Every occurrence of the quote that begins on its stated page and ends no
// later than the next page, as [start, end) ranges of the programme stream.
function occurrences(sourceId, page, quote, label) {
  const programme = programmes.get(sourceId);
  assert.ok(programme, `No programme text for ${label}`);
  const pageStart = programme.pageStarts.get(page);
  assert.ok(pageStart !== undefined, `${label} names page ${page}, which ${sourceId} does not have`);
  const pageEnd = programme.pageStarts.get(page + 1) ?? programme.stream.length;
  const limit = programme.pageStarts.get(page + 2) ?? programme.stream.length;
  const text = programme.stream.slice(0, limit);
  const canonical = canonicalQuote(quote);
  const ranges = [];
  for (let start = text.indexOf(canonical[0], pageStart); start !== -1 && start < pageEnd; start = text.indexOf(canonical[0], start + 1)) {
    const end = matchEnd(text, canonical, start);
    if (end !== -1) ranges.push([start, end]);
  }
  assert.ok(ranges.length > 0, `${label} is not the exact wording beginning on page ${page} of ${sourceId}`);
  return ranges;
}

function assertQuote(sourceId, page, quote, label) {
  occurrences(sourceId, page, quote, label);
  assert.doesNotMatch(quote, /Volební program hnutí ANO \/ 2025|Umíme vyřešit i složité věci \|/, `${label} contains a page footer`);
}

async function publishedItems() {
  const directory = new URL("../data/promises/", import.meta.url);
  const items = [];
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".json"))) items.push(JSON.parse(await readFile(new URL(file, directory), "utf8")));
  return items;
}

test("the programme text is the text of the archived PDFs", async () => {
  for (const entry of manifest.entries) {
    const expected = await readFile(new URL(`../research/2025-election/programme-text/${entry.sourceId}.txt`, import.meta.url), "utf8");
    assert.equal(formatPages(await extractPdfPages(await readFile(new URL(`../${entry.path}`, import.meta.url)))), expected, entry.sourceId);
  }
});

test("every published item quotes its programme exactly", async () => {
  for (const item of await publishedItems()) assertQuote(item.primarySourceId, item.sourceLocator.page, item.originalText, item.id);
});

test("every rejected occurrence quotes its programme exactly and states a technical reason", async () => {
  const { schemaVersion, rejected } = await json("research/2025-election/rejected.json");
  assert.equal(schemaVersion, "1.0.0");
  const published = new Map((await publishedItems()).map((item) => [item.id, item]));
  for (const [index, occurrence] of rejected.entries()) {
    const label = `rejected occurrence ${index}`;
    assertQuote(occurrence.sourceId, occurrence.locator.page, occurrence.originalTextCz, label);
    assert.ok(rejectionReasons.has(occurrence.reason), `${label} has no technical reason code`);
    if (occurrence.reason === "duplicate") {
      assert.equal(published.get(occurrence.duplicateOf)?.primarySourceId, occurrence.sourceId, `${label} must name a published item of the same programme`);
    } else {
      assert.equal(occurrence.duplicateOf, undefined, label);
    }
  }
});

test("every passage left out of the catalogue quotes its programme exactly and states why", async () => {
  const { schemaVersion, passages } = await json("research/2025-election/not-catalogued.json");
  assert.equal(schemaVersion, "1.0.0");
  for (const [index, passage] of passages.entries()) {
    const label = `not-catalogued passage ${index}`;
    occurrences(passage.sourceId, passage.locator.page, passage.originalTextCz, label);
    assert.ok(notCataloguedReasons.has(passage.reason), `${label} has no reason code`);
  }
});

test("every character of every programme is catalogued, rejected, or recorded as not catalogued", async () => {
  const { rejected } = await json("research/2025-election/rejected.json");
  const { passages } = await json("research/2025-election/not-catalogued.json");
  const quotes = [
    ...(await publishedItems()).map((item) => ({ sourceId: item.primarySourceId, page: item.sourceLocator.page, text: item.originalText, label: item.id })),
    ...rejected.map((occurrence, index) => ({ sourceId: occurrence.sourceId, page: occurrence.locator.page, text: occurrence.originalTextCz, label: `rejected occurrence ${index}` })),
    ...passages.map((passage, index) => ({ sourceId: passage.sourceId, page: passage.locator.page, text: passage.originalTextCz, label: `not-catalogued passage ${index}` }))
  ];
  const covered = new Map([...programmes].map(([sourceId, { stream }]) => [sourceId, new Uint8Array(stream.length)]));
  // Longer quotes first, so that a short passage repeated on one page (a
  // bullet or a running header) takes the occurrences no longer quote covers.
  for (const quote of quotes.sort((left, right) => right.text.length - left.text.length)) {
    const marks = covered.get(quote.sourceId);
    const ranges = occurrences(quote.sourceId, quote.page, quote.text, quote.label);
    const [start, end] = ranges.find(([first]) => !marks[first]) ?? ranges[0];
    marks.fill(1, start, end);
  }
  for (const [sourceId, { stream, pageStarts }] of programmes) {
    const marks = covered.get(sourceId);
    let gap = -1;
    for (let index = 0; index < stream.length && gap === -1; index += 1) if (!marks[index] && stream[index] !== lineBreakHyphen) gap = index;
    const page = gap === -1 ? null : Math.max(...[...pageStarts].filter(([, start]) => start <= gap).map(([number]) => number));
    assert.equal(gap, -1, `${sourceId} page ${page} has text that is not accounted for: ${stream.slice(gap, gap + 60)}`);
  }
});
