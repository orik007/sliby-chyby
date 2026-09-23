import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { strToU8 } from "fflate";
import {
  createCollectedRecord,
  deduplicateRecords,
  fetchVerified,
  validateRegistry
} from "../scripts/lib/collector-core.mjs";
import { parseNewsSitemap, parseRssOrAtom } from "../scripts/lib/feed-collectors.mjs";
import {
  parseMkNewsArchive,
  parseMpsvPressArchive,
  parseMsmtNewsApiPage,
  parseOfficialHtmlArchive,
  parseWordPressRestPage
} from "../scripts/lib/official-archive-collectors.mjs";
import { derivePartyVoteSummaries, normalizePspData, parseUnl } from "../scripts/lib/psp-collector.mjs";

const mediaSource = {
  id: "example-media",
  publisher: "Example Media",
  collector: "rss",
  enabled: true,
  primary: false,
  evidenceRole: "discovery-context",
  bootstrapFrom: "2025-10-01",
  coverage: { mode: "current-window", note: "Fixture feed exposes a current window." },
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
  assert.throws(() => validateRegistry({
    schemaVersion: "1.0.0",
    sources: [{ ...mediaSource, evidenceRole: "official-party-publication", primary: true }]
  }), /needs partyId/);
});

test("retries transient source responses before accepting verified bytes", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  const response = (status, body, contentType = "text/plain") => ({
    ok: status >= 200 && status < 300,
    status,
    url: "https://news.example/api",
    headers: new Headers({ "content-type": contentType }),
    body: null,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer
  });
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts < 3) return response(503, "temporarily unavailable");
    return response(200, '{"items":[]}', "application/json");
  };
  try {
    const result = await fetchVerified(mediaSource, "https://news.example/api", {
      maxBytes: 1_000,
      expectedContentTypes: ["application/json"],
      retryAttempts: 3,
      retryDelayMs: 0
    });
    assert.equal(attempts, 3);
    assert.equal(new TextDecoder().decode(result.bytes), '{"items":[]}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries transport failures while fetching and reading source bytes", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  const response = (readBytes) => ({
    ok: true,
    status: 200,
    url: "https://news.example/api",
    headers: new Headers({ "content-type": "application/json" }),
    body: null,
    arrayBuffer: readBytes
  });
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError("connection reset before response");
    if (attempts === 2) return response(async () => { throw new TypeError("connection reset while reading body"); });
    return response(async () => new TextEncoder().encode('{"items":[]}').buffer);
  };
  try {
    const result = await fetchVerified(mediaSource, "https://news.example/api", {
      maxBytes: 1_000,
      expectedContentTypes: ["application/json"],
      retryAttempts: 3,
      retryDelayMs: 0
    });
    assert.equal(attempts, 3);
    assert.equal(new TextDecoder().decode(result.bytes), '{"items":[]}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("normalizes an official party WordPress item with explicit party attribution", () => {
  const source = {
    ...mediaSource,
    id: "party-news",
    collector: "wordpress-rest",
    primary: true,
    evidenceRole: "official-party-publication",
    partyId: "motoriste",
    apiEndpoint: "https://party.example/wp-json/wp/v2/posts",
    wordpressCategoryId: 5,
    wordpressCategorySlug: "tiskova-zprava",
    expectedHosts: ["party.example"]
  };
  const records = parseWordPressRestPage([{
    id: 42,
    date_gmt: "2026-08-31T10:56:54",
    link: "https://party.example/concrete-step-42",
    title: { rendered: "Strana představila konkrétní krok" },
    excerpt: { rendered: "<p>Oficiální vyjádření strany.</p>" },
    categories: [5]
  }], source, { since: "2025-10-01" });
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, "official-publication");
  assert.equal(records[0].evidenceRole, "official-party-publication");
  assert.equal(records[0].payload.sourcePartyId, "motoriste");
  assert.deepEqual(records[0].payload.wordpressCategoryIds, [5]);
  assert.equal(records[0].payload.wordpressCategorySlug, "tiskova-zprava");
  assert.equal(records[0].payload.excerptCz, "Oficiální vyjádření strany.");
  assert.throws(() => parseWordPressRestPage([{
    id: 43,
    date_gmt: "2026-08-31T11:00:00",
    link: "https://party.example/interview-43",
    title: { rendered: "Interview" },
    excerpt: { rendered: "Interview jednotlivce." },
    categories: [1]
  }], source, { since: "2025-10-01" }), /outside its configured category/);
});

test("documents every configured collector source in the canonical pipeline policy", async () => {
  const registry = JSON.parse(await readFile(new URL("../automation/collectors/sources.json", import.meta.url), "utf8"));
  const policy = await readFile(new URL("../docs/evidence-pipeline.md", import.meta.url), "utf8");
  for (const source of registry.sources) {
    assert.match(policy, new RegExp(`\\x60${source.id}\\x60`), `Missing ${source.id} from evidence-pipeline.md`);
  }
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

test("accepts an explicitly allowlisted official linked host", () => {
  const governmentSource = {
    ...mediaSource,
    id: "government-example",
    primary: true,
    evidenceRole: "official-discovery",
    expectedHosts: ["vlada.gov.cz", "www.odok.cz"]
  };
  const xml = `<?xml version="1.0"?><rss><channel><title>Government</title><item><title>Cabinet agenda</title><link>https://www.odok.cz/portal/zvlady/jednani-detail/2026-08-31</link><pubDate>Mon, 31 Aug 2026 12:00:00 +0200</pubDate></item></channel></rss>`;
  const result = parseRssOrAtom(xml, governmentSource, { since: "2026-08-01" });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].url, "https://www.odok.cz/portal/zvlady/jednani-detail/2026-08-31");
  assert.equal(result.records[0].primary, true);
});

test("keeps distinct official feed items that reuse one GUID and URL", () => {
  const xml = `<?xml version="1.0"?><rss><channel><title>Government</title>
    <item><guid>https://news.example/agenda/1</guid><title>Cabinet agenda</title><link>https://news.example/agenda/1</link><pubDate>Mon, 31 Aug 2026 12:00:00 +0200</pubDate></item>
    <item><guid>https://news.example/agenda/1</guid><title>Cabinet agenda addendum</title><link>https://news.example/agenda/1</link><pubDate>Mon, 31 Aug 2026 12:00:00 +0200</pubDate></item>
  </channel></rss>`;
  const result = parseRssOrAtom(xml, mediaSource, { since: "2026-08-01" });
  assert.equal(result.records.length, 2);
  assert.notEqual(result.records[0].id, result.records[1].id);
  assert.equal(result.records[0].payload.feedEntryId, result.records[1].payload.feedEntryId);
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

test("normalizes a bounded official Czech annual archive", () => {
  const source = {
    ...mediaSource,
    id: "official-archive",
    collector: "official-html-archive",
    primary: true,
    evidenceRole: "official-discovery",
    archiveEndpoints: ["https://news.example/archive/2025"]
  };
  const html = `<article class="b-article link-mask"><a href="/release/a" class="b-article__link link-mask__link">Priorita &#x10C;R</a><span class="b-article__date">15. prosince 2025</span></article>`;
  const records = parseOfficialHtmlArchive(html, source, { since: "2025-10-01" });
  assert.equal(records.length, 1);
  assert.equal(records[0].title, "Priorita ČR");
  assert.equal(records[0].occurredAt, "2025-12-15T00:00:00.000Z");
  assert.equal(records[0].url, "https://news.example/release/a");
  assert.equal(records[0].primary, true);
  assert.deepEqual(parseOfficialHtmlArchive(html, source, { since: "2026-01-01" }), []);
});

test("normalizes only ministry-labelled items from the Culture Ministry archive", () => {
  const source = {
    ...mediaSource,
    id: "mk-news-archive",
    collector: "mk-news-archive",
    primary: true,
    evidenceRole: "official-discovery",
    archiveEndpoint: "https://www.mk.gov.cz/novinky-a-media-cs-4",
    itemPathPrefix: "/novinky-a-media-cs-4/",
    allowedPublisherCategories: ["ministerstvo"],
    expectedHosts: ["www.mk.gov.cz"]
  };
  const html = `
    <a href="/novinky-a-media-cs-4/1cs-ministry-item" class="malaNovinka novinka">
      <div class="novinkaTexty"><div class="novinkaNadpis">Hmatatelné opatření</div>
      <div class="novinkaInfo"><span class="novinkaDatum">17.08.2026 12:26</span><div><span></span><span class="novinkaDruh">ministerstvo</span></div></div>
      <div class="novinkaText"><p>Oficiální stručný popis &amp; souvislosti.</p></div></div>
    </a>
    <a href="/novinky-a-media-cs-4/2cs-institution-item" class="malaNovinka novinka">
      <div class="novinkaTexty"><div class="novinkaNadpis">Program muzea</div>
      <div class="novinkaInfo"><span class="novinkaDatum">16.08.2026 10:00</span><div><span></span><span class="novinkaDruh">příspěvkové organizace</span></div></div>
      <div class="novinkaText"><p>Program podřízené organizace.</p></div></div>
    </a>`;
  const records = parseMkNewsArchive(html, source, { since: "2025-10-01" });
  assert.equal(records.length, 1);
  assert.equal(records[0].title, "Hmatatelné opatření");
  assert.equal(records[0].occurredAt, "2026-08-17T12:26:00");
  assert.equal(records[0].payload.publisherCategory, "ministerstvo");
  assert.equal(records[0].payload.excerptCz, "Oficiální stručný popis & souvislosti.");
});

test("normalizes a complete page from the MPSV annual archive", () => {
  const source = {
    ...mediaSource,
    id: "mpsv-press-archive-2025-2026",
    collector: "mpsv-press-archive",
    primary: true,
    evidenceRole: "official-discovery",
    archiveEndpoints: ["https://mpsv.gov.cz/tiskove-zpravy-mpsv?year=2025"],
    expectedHosts: ["mpsv.gov.cz"]
  };
  const html = `<span>Nalezen <b>1</b> výsledek</span><ul><li>
    <a href="https://mpsv.gov.cz/zmena-podpory" class="card__basic card__horizontal" type="horizontal">
      <div class="card__basic-content"><h3><span class="one-line-heading">Změna podpory</span></h3>
      <span class="card__basic-date">30. prosince 2025</span>
      <div class="card__basic-text">Ministerstvo zveřejnilo konkrétní opatření.</div></div>
    </a></li></ul>`;
  const records = parseMpsvPressArchive(html, source, { since: "2025-10-01" });
  assert.equal(records.length, 1);
  assert.equal(records[0].occurredAt, "2025-12-30T00:00:00.000Z");
  assert.equal(records[0].url, "https://mpsv.gov.cz/zmena-podpory");
  assert.equal(records[0].payload.excerptCz, "Ministerstvo zveřejnilo konkrétní opatření.");
});

test("normalizes a cursor-paginated MŠMT API page without trusting redirects", () => {
  const source = {
    ...mediaSource,
    id: "msmt-news-api",
    collector: "msmt-news-api",
    primary: true,
    evidenceRole: "official-discovery",
    apiEndpoint: "https://msmt.gov.cz/api/aktuality",
    archiveEndpoint: "https://msmt.gov.cz/aktuality",
    itemPathPrefix: "/aktuality/",
    expectedHosts: ["msmt.gov.cz"]
  };
  const page = {
    success: true,
    data: {
      aktuality: {
        pageInfo: { hasNextPage: true, endCursor: "next", total: 2 },
        edges: [{ node: {
          id: "post-1",
          title: "Nové opatření ve školství",
          date: "2026-08-20T09:15:00",
          excerpt: "<p>Ministerstvo zveřejnilo <strong>konkrétní</strong> opatření.</p>",
          slug: "nove-opatreni-ve-skolstvi",
          tagsmain: { nodes: [{ name: "Ministerstvo" }] },
          redirectacf: { redirect: true, redirecturl: "https://outside.example/ignored" }
        } }]
      }
    }
  };
  const parsed = parseMsmtNewsApiPage(page, source, { since: "2025-10-01" });
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].url, "https://msmt.gov.cz/aktuality/nove-opatreni-ve-skolstvi");
  assert.equal(parsed.records[0].payload.excerptCz, "Ministerstvo zveřejnilo konkrétní opatření.");
  assert.deepEqual(parsed.records[0].payload.tags, ["Ministerstvo"]);
  assert.equal(parsed.pageInfo.endCursor, "next");
});

test("safely encodes an unusual MŠMT slug returned by the official API", () => {
  const source = {
    ...mediaSource,
    id: "msmt-news-api",
    collector: "msmt-news-api",
    primary: true,
    evidenceRole: "official-discovery",
    apiEndpoint: "https://msmt.gov.cz/api/aktuality",
    archiveEndpoint: "https://msmt.gov.cz/aktuality",
    itemPathPrefix: "/aktuality/",
    expectedHosts: ["msmt.gov.cz"]
  };
  const page = {
    success: true,
    data: { aktuality: {
      pageInfo: { hasNextPage: false, endCursor: null, total: 1 },
      edges: [{ node: {
        id: "post-2",
        title: "Průvodce pro studenty",
        date: "2026-02-03T10:06:09",
        excerpt: "",
        slug: "titulní-stránka-⁄-aktuality",
        tagsmain: { nodes: [] }
      } }]
    } }
  };
  const parsed = parseMsmtNewsApiPage(page, source, { since: "2025-10-01" });
  assert.equal(parsed.records[0].url, "https://msmt.gov.cz/aktuality/tituln%C3%AD-str%C3%A1nka-%E2%81%84-aktuality");
});

test("UNL parser respects escaped delimiters and null fields", () => {
  const rows = parseUnl("1|escaped\\|pipe||\n", ["id", "text", "empty"]);
  assert.deepEqual(rows, [{ id: "1", text: "escaped|pipe", empty: null }]);
});

test("requires a strict majority of all club members for a party direction", () => {
  const vote = (externalMpId, choiceCode) => ({
    externalMpId,
    choiceCode,
    clubMembershipsAtVote: [{ projectPartyId: "ano" }]
  });
  const attributed = derivePartyVoteSummaries([
    vote("1", "A"), vote("2", "A"), vote("3", "A"), vote("4", "@"), vote("5", "M")
  ])[0];
  assert.equal(attributed.eligibleMemberCount, 5);
  assert.equal(attributed.directionalVoteCount, 3);
  assert.equal(attributed.strictMajorityThreshold, 3);
  assert.equal(attributed.majorityChoice, "yes");
  assert.equal(attributed.attributionStatus, "attributed");
  assert.equal(attributed.ruleVersion, "party-vote-strict-majority-v3");

  const insufficientSupport = derivePartyVoteSummaries([
    vote("1", "A"), vote("2", "A"), vote("3", "N"), vote("4", "C"), vote("5", "@")
  ])[0];
  assert.equal(insufficientSupport.majorityChoice, null);
  assert.equal(insufficientSupport.attributionStatus, "no-strict-majority");

  const absentMajority = derivePartyVoteSummaries([
    vote("1", "A"), vote("2", "@"), vote("3", "@"), vote("4", "M"), vote("5", "M")
  ])[0];
  assert.equal(absentMajority.majorityChoice, null);
  assert.equal(absentMajority.attributionStatus, "no-strict-majority");

  const noDirectionalVotes = derivePartyVoteSummaries([
    vote("1", "C"), vote("2", "F"), vote("3", "@")
  ])[0];
  assert.equal(noDirectionalVotes.majorityChoice, null);
  assert.equal(noDirectionalVotes.attributionStatus, "no-strict-majority");

  const voided = derivePartyVoteSummaries([
    vote("1", "A"), vote("2", "A"), vote("3", "A")
  ], { voidedByOfficialRecord: true })[0];
  assert.equal(voided.majorityChoice, null);
  assert.equal(voided.attributionStatus, "voided-vote");
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
  Object.assign(printFields, { 0: "700", 1: "1", 2: "20", 3: "189", 4: "0", 7: "174", 10: "Short bill", 15: "Full bill title", 21: "2026-08-29 09:15" });
  const historyFields = Array(15).fill(null);
  Object.assign(historyFields, { 0: "800", 1: "700", 2: "2026-08-30 12:34", 3: "900", 4: "10", 6: "12", 7: "55" });
  const printsEntries = {
    "tisky.unl": entry(unl(printFields)),
    "hist.unl": entry(unl(historyFields)),
    "stavy.unl": entry(unl(["20", "6", "1", "Approved", null, null]) + unl(["10", "5", "1", "Before vote", null, null])),
    "prechody.unl": entry(unl(["10", "10", "20", "5", "1"])),
    "typ_akce.unl": entry(unl(["5", "Chamber approved bill"]))
  };

  const sessionsEntries = { "schuze.unl": entry(""), "bod_schuze.unl": entry("") };
  const result = normalizePspData({ source, since: "2026-08-01", votesEntries, membersEntries, printsEntries, sessionsEntries });
  const vote = result.records.find((record) => record.kind === "parliamentary-vote");
  const step = result.records.find((record) => record.kind === "legislative-step");
  assert.ok(vote);
  assert.ok(step);
  assert.equal(vote.payload.linkedPrints[0].number, 189);
  assert.equal(vote.payload.linkedPrints[0].historyContexts[0].actionCz, "Chamber approved bill");
  assert.equal(vote.payload.linkedPrints[0].linkBasis, "history-vote-id");
  assert.equal(vote.payload.individualVotes[0].clubMembershipsAtVote[0].projectPartyId, "ano");
  assert.equal(step.payload.externalVoteId, "900");
  assert.equal(step.payload.actionCz, "Chamber approved bill");
  assert.equal(step.payload.documentPublishedAt, "2026-08-29T09:15:00");
  assert.equal(vote.primary, true);
});

function agendaFixture({ historyAgendaId = "5001" } = {}) {
  const source = {
    id: "psp-core-2025",
    publisher: "PSP",
    evidenceRole: "primary-record",
    partyAliases: { MS: "motoriste" },
    term: { year: 2025, number: 10, organId: 174 }
  };
  const voteRow = (id, number, agenda, time, longTitle) => unl([id, "174", "29", number, agenda, "26.08.2026", time, "104", "72", "0", "0", "176", "101", "N", "A", longTitle, null]);
  const votesEntries = {
    "hl2025s.unl": entry(
      voteRow("950", "10", "3", "11:00", "Pozmenovaci navrh")
      + voteRow("951", "11", "3", "11:05", null)
      + voteRow("952", "12", "0", "11:10", "Proceduralni hlasovani")
    ),
    "hl2025h1.unl": entry(unl(["100", "951", "A"]) + unl(["100", "950", "B"]) + unl(["100", "952", "A"])),
    "zmatecne.unl": entry("")
  };
  const membersEntries = {
    "osoby.unl": entry(unl(["1", null, "Novak", "Jan", null, "01.01.1980", "M", null, null])),
    "poslanec.unl": entry(unl(["100", "1", null, null, "174", null, null, null, null, null, null, null, null, null, "1"])),
    "zarazeni.unl": entry(unl(["1", "1760", "0", "2025-10-08 00", null, null, null])),
    "organy.unl": entry(unl(["1760", "174", "1", "MS", "Poslanecky klub Motoriste sobe", "MS club", "08.10.2025", null, null, "0"]))
  };
  const print = (id, number, title) => {
    const fields = Array(24).fill(null);
    Object.assign(fields, { 0: id, 1: "1", 2: "20", 3: number, 4: "0", 7: "174", 10: title, 15: title });
    return unl(fields);
  };
  const historyFields = Array(15).fill(null);
  Object.assign(historyFields, { 0: "810", 1: "701", 2: "2026-08-26 11:05", 4: "11", 5: historyAgendaId, 6: "29" });
  const printsEntries = {
    "tisky.unl": entry(print("701", "68", "Vladni navrh zakona, kterym se meni zakon c. 23/2017 Sb., o pravidlech rozpoctove odpovednosti") + print("702", "90", "Unrelated bill")),
    "hist.unl": entry(unl(historyFields)),
    "stavy.unl": entry(unl(["20", "6", "1", "Approved", null, null])),
    "prechody.unl": entry(unl(["11", "20", "20", "6", "1"])),
    "typ_akce.unl": entry(unl(["6", "Snemovna setrvala na zakonu"]))
  };
  // PSP files are windows-1250; the fixture stays ASCII so UTF-8 bytes decode identically.
  const sessionsEntries = {
    // The invitation record for session 29 numbers item 3 differently and must be ignored.
    "schuze.unl": entry(unl(["290", "174", "29", "25.08.2026", null, null, "1"]) + unl(["291", "174", "29", "25.08.2026", null, null, null])),
    "bod_schuze.unl": entry(
      unl(["4999", "290", "702", "1", "3", "Unrelated invitation item", null])
      + unl(["5001", "291", "701", "1", "3", "Vladni navrh zakona o pravidlech rozpoctove odpovednosti", "/snemovni tisk 68/ - zakon vraceny prezidentem"])
    )
  };
  return normalizePspData({ source, since: "2026-08-01", votesEntries, membersEntries, printsEntries, sessionsEntries });
}

test("PSP normalizer links votes to the print of their approved agenda item", () => {
  const result = agendaFixture();
  assert.deepEqual(result.warnings, []);
  const byId = new Map(result.records.map((record) => [record.id, record]));
  const amendment = byId.get("psp-core-2025--vote-950");
  const finalVote = byId.get("psp-core-2025--vote-951");
  const procedural = byId.get("psp-core-2025--vote-952");

  assert.equal(finalVote.payload.agendaItem.titleCz, "Vladni navrh zakona o pravidlech rozpoctove odpovednosti");
  assert.equal(finalVote.payload.agendaItem.suffixCz, "/snemovni tisk 68/ - zakon vraceny prezidentem");
  assert.equal(finalVote.payload.linkedPrints.length, 1);
  assert.equal(finalVote.payload.linkedPrints[0].number, 68);
  assert.equal(finalVote.payload.linkedPrints[0].linkBasis, "agenda-item-final-vote");
  assert.equal(finalVote.payload.linkedPrints[0].historyContexts[0].actionCz, "Snemovna setrvala na zakonu");

  // An earlier vote on the same agenda item names the print but never inherits the decisive step.
  assert.equal(amendment.payload.linkedPrints[0].number, 68);
  assert.equal(amendment.payload.linkedPrints[0].linkBasis, "agenda-item");
  assert.deepEqual(amendment.payload.linkedPrints[0].historyContexts, []);

  assert.equal(procedural.payload.agendaItem, null);
  assert.deepEqual(procedural.payload.linkedPrints, []);
});

test("PSP normalizer skips agenda links when schuze.zip and hist.unl disagree", () => {
  const result = agendaFixture({ historyAgendaId: "7777" });
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /agenda-item vote links were skipped/);
  const finalVote = result.records.find((record) => record.id === "psp-core-2025--vote-951");
  assert.equal(finalVote.payload.agendaItem, null);
  assert.deepEqual(finalVote.payload.linkedPrints, []);
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
