import assert from "node:assert/strict";
import test from "node:test";
import { strToU8 } from "fflate";
import {
  createCollectedRecord,
  deduplicateRecords,
  validateRegistry
} from "../scripts/lib/collector-core.mjs";
import { parseNewsSitemap, parseRssOrAtom } from "../scripts/lib/feed-collectors.mjs";
import { normalizePspData, parseUnl } from "../scripts/lib/psp-collector.mjs";

const mediaSource = {
  id: "example-media",
  publisher: "Example Media",
  collector: "rss",
  enabled: true,
  primary: false,
  evidenceRole: "discovery-context",
  endpoint: "https://news.example/rss",
  verificationUrl: "https://news.example/rss-help",
  verifiedAt: "2026-08-31",
  expectedHosts: ["news.example"],
  maxExcerptChars: 80
};

test("validates a unique, explicit collector registry", () => {
  const registry = { schemaVersion: "1.0.0", sources: [mediaSource] };
  assert.equal(validateRegistry(registry), registry);
  assert.throws(() => validateRegistry({ schemaVersion: "1.0.0", sources: [mediaSource, mediaSource] }), /Duplicate collector source id/);
});

test("normalizes RSS metadata without storing a full article", () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title><item>
    <guid>item-1</guid><title>Policy &amp; vote</title><link>https://news.example/article/1</link>
    <description><![CDATA[<p>This is a publisher-provided summary with <strong>markup</strong> and deliberately more than eighty characters for truncation.</p>]]></description>
    <pubDate>Sun, 30 Aug 2026 12:00:00 +0200</pubDate><author>Reporter</author>
  </item></channel></rss>`;
  const result = parseRssOrAtom(xml, mediaSource, { since: "2026-08-01" });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].kind, "article");
  assert.equal(result.records[0].primary, false);
  assert.equal(result.records[0].payload.authorNames[0], "Reporter");
  assert.ok(result.records[0].payload.excerptCz.length <= 80);
  assert.doesNotMatch(result.records[0].payload.excerptCz, /<p>/);
  assert.equal("status" in result.records[0], false);
  assert.equal("direction" in result.records[0], false);
  assert.equal("score" in result.records[0], false);
});

test("rejects a feed item that redirects readers outside the source allowlist", () => {
  const xml = `<?xml version="1.0"?><rss><channel><title>Feed</title><item><title>Wrong host</title><link>https://other.example/a</link><pubDate>Sun, 30 Aug 2026 12:00:00 +0200</pubDate></item></channel></rss>`;
  assert.throws(() => parseRssOrAtom(xml, mediaSource, { since: "2026-08-01" }), /outside the source host allowlist/);
});

test("normalizes a publisher news sitemap without inventing an excerpt", () => {
  const source = { ...mediaSource, id: "example-sitemap", collector: "news-sitemap", maxExcerptChars: 0 };
  const xml = `<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url>
    <loc>https://news.example/article/2</loc><news:news><news:publication_date>2026-08-30T14:00:00+02:00</news:publication_date><news:title>Government decision</news:title></news:news>
  </url></urlset>`;
  const result = parseNewsSitemap(xml, source, { since: "2026-08-01" });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].payload.excerptCz, "");
  assert.equal(result.records[0].url, "https://news.example/article/2");
});

test("UNL parser respects escaped delimiters and null fields", () => {
  const rows = parseUnl("1|escaped\\|pipe||\n", ["id", "text", "empty"]);
  assert.deepEqual(rows, [{ id: "1", text: "escaped|pipe", empty: null }]);
});

function unl(fields) {
  return `${fields.map((value) => value ?? "").join("|")}|\n`;
}

function entry(text) {
  return strToU8(text);
}

test("PSP normalizer joins votes, prints, and club membership at vote date", () => {
  const source = {
    id: "psp-core-2025",
    publisher: "PSP",
    evidenceRole: "primary-record",
    partyAliases: { ANO2011: "ano" },
    term: { year: 2025, number: 10, organId: 174 }
  };

  const votesEntries = {
    "hl2025s.unl": entry(unl(["900", "174", "12", "33", "5", "30.08.2026", "12:34", "100", "20", "10", "2", "132", "67", "N", "A", "Final vote", "Vote"])),
    "hl2025h1.unl": entry(unl(["100", "900", "A"])),
    "zmatecne.unl": entry("")
  };
  const membersEntries = {
    "osoby.unl": entry(unl(["1", null, "Novak", "Jan", null, "01.01.1980", "M", null, null])),
    "poslanec.unl": entry(unl(["100", "1", null, null, "174", null, null, null, null, null, null, null, null, null, "1"])),
    "zarazeni.unl": entry(unl(["1", "1750", "0", "2025-10-08 00", null, null, null])),
    "organy.unl": entry(unl(["1750", "174", "1", "ANO2011", "Poslanecky klub ANO 2011", "ANO club", "08.10.2025", null, null, "0"]))
  };
  const printFields = Array(24).fill(null);
  Object.assign(printFields, { 0: "700", 1: "1", 2: "20", 3: "189", 4: "0", 7: "174", 10: "Short bill", 15: "Full bill title" });
  const historyFields = Array(15).fill(null);
  Object.assign(historyFields, { 0: "800", 1: "700", 2: "2026-08-30 12:34", 3: "900", 4: "10", 6: "12", 7: "55" });
  const printsEntries = {
    "tisky.unl": entry(unl(printFields)),
    "hist.unl": entry(unl(historyFields)),
    "stavy.unl": entry(unl(["20", "6", "1", "Approved", null, null]) + unl(["10", "5", "1", "Before vote", null, null])),
    "prechody.unl": entry(unl(["10", "10", "20", "5", "1"])),
    "typ_akce.unl": entry(unl(["5", "Chamber approved bill"]))
  };

  const result = normalizePspData({ source, since: "2026-08-01", votesEntries, membersEntries, printsEntries });
  const vote = result.records.find((record) => record.kind === "parliamentary-vote");
  const step = result.records.find((record) => record.kind === "legislative-step");
  assert.ok(vote);
  assert.ok(step);
  assert.equal(vote.payload.linkedPrints[0].number, 189);
  assert.equal(vote.payload.individualVotes[0].clubMembershipsAtVote[0].projectPartyId, "ano");
  assert.equal(step.payload.externalVoteId, "900");
  assert.equal(step.payload.actionCz, "Chamber approved bill");
  assert.equal(vote.primary, true);
});

test("deduplication accepts identical records and rejects conflicting content", () => {
  const base = {
    id: "source--1",
    sourceId: "source",
    kind: "article",
    primary: false,
    evidenceRole: "discovery-context",
    occurredAt: "2026-08-30T10:00:00.000Z",
    title: "Title",
    publisher: "Publisher",
    url: "https://news.example/a",
    payload: {}
  };
  const first = createCollectedRecord(base);
  assert.equal(deduplicateRecords([first, structuredClone(first)]).length, 1);
  const second = createCollectedRecord({ ...base, title: "Changed title" });
  assert.throws(() => deduplicateRecords([first, second]), /Conflicting records/);
});
