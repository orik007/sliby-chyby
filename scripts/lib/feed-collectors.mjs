import { XMLParser } from "fast-xml-parser";
import {
  asArray,
  cleanText,
  createCollectedRecord,
  deduplicateRecords,
  fetchVerified,
  invariant,
  parseIsoDate,
  sha256
} from "./collector-core.mjs";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  processEntities: true
});

function textValue(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  return String(value["#text"] ?? value.__cdata ?? value["@_href"] ?? "");
}

function linkValue(value) {
  if (typeof value === "string") return value;
  for (const item of asArray(value)) {
    if (typeof item === "string") return item;
    if (item?.["@_rel"] === "alternate" && item?.["@_href"]) return item["@_href"];
    if (item?.["@_href"]) return item["@_href"];
    if (item?.["#text"]) return item["#text"];
  }
  return "";
}

function normalizeUrl(rawUrl, source) {
  const url = new URL(rawUrl);
  invariant(url.protocol === "https:", `Feed item from ${source.id} has a non-HTTPS URL`);
  invariant(source.expectedHosts.includes(url.hostname), `Feed item from ${source.id} points outside the source host allowlist`);
  url.hash = "";
  return url.toString();
}

function normalizeAuthors(item) {
  const candidates = [
    ...asArray(item.author),
    ...asArray(item.creator),
    ...asArray(item.authors?.value),
    ...asArray(item.authors)
  ];
  return [...new Set(candidates.map(textValue).map((value) => cleanText(value, 200)).filter(Boolean))];
}

function feedItems(document) {
  if (document.rss?.channel) {
    return { title: cleanText(document.rss.channel.title, 300), items: asArray(document.rss.channel.item) };
  }
  if (document.feed) {
    return { title: cleanText(document.feed.title, 300), items: asArray(document.feed.entry) };
  }
  throw new Error("XML is neither a supported RSS nor Atom feed");
}

function itemDate(item) {
  return parseIsoDate(textValue(item.pubDate ?? item.published ?? item.updated ?? item.date));
}

export function parseRssOrAtom(xml, source, { since }) {
  const parsed = xmlParser.parse(xml);
  const feed = feedItems(parsed);
  const warnings = [];
  const records = [];
  const cutoff = since ? new Date(`${since}T00:00:00Z`) : null;

  for (const item of feed.items) {
    const title = cleanText(item.title, 500);
    const rawUrl = linkValue(item.link) || textValue(item.guid ?? item.id);
    const occurredAt = itemDate(item);
    if (!title || !rawUrl) {
      warnings.push("Skipped an item without a title or URL");
      continue;
    }
    if (!occurredAt) {
      warnings.push(`Skipped undated item: ${title}`);
      continue;
    }
    if (cutoff && new Date(occurredAt) < cutoff) continue;

    const url = normalizeUrl(rawUrl, source);
    const feedEntryId = cleanText(item.guid ?? item.id ?? url, 1000);
    const excerptCz = cleanText(item.description ?? item.summary ?? item.encoded, source.maxExcerptChars ?? 500);
    // Some official feeds reuse one GUID and URL for a base agenda, its addenda,
    // and later notices. Include the dated title so distinct feed occurrences
    // remain auditable without weakening conflicting-record detection.
    const itemIdentity = [feedEntryId || url, occurredAt, title].join("\n");
    const id = `${source.id}--${sha256(itemIdentity).slice(0, 20)}`;
    records.push(createCollectedRecord({
      id,
      sourceId: source.id,
      kind: source.primary ? "official-publication" : "article",
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      occurredAt,
      title,
      publisher: source.publisher,
      url,
      payload: {
        feedEntryId,
        feedTitle: feed.title,
        authorNames: normalizeAuthors(item),
        excerptCz
      }
    }));
  }

  return { records: deduplicateRecords(records), warnings };
}

export function parseNewsSitemap(xml, source, { since }) {
  const parsed = xmlParser.parse(xml);
  const entries = asArray(parsed.urlset?.url);
  invariant(entries.length > 0, "News sitemap contains no URLs");
  const cutoff = since ? new Date(`${since}T00:00:00Z`) : null;
  const records = [];
  const warnings = [];

  for (const entry of entries) {
    const news = entry.news ?? {};
    const title = cleanText(news.title, 500);
    const occurredAt = parseIsoDate(textValue(news.publication_date ?? entry.lastmod));
    if (!title || !entry.loc || !occurredAt) {
      warnings.push("Skipped an incomplete news-sitemap item");
      continue;
    }
    if (cutoff && new Date(occurredAt) < cutoff) continue;
    const url = normalizeUrl(textValue(entry.loc), source);
    records.push(createCollectedRecord({
      id: `${source.id}--${sha256(url).slice(0, 20)}`,
      sourceId: source.id,
      kind: "article",
      primary: false,
      evidenceRole: source.evidenceRole,
      occurredAt,
      title,
      publisher: source.publisher,
      url,
      payload: {
        feedEntryId: url,
        feedTitle: "Google News sitemap",
        authorNames: [],
        excerptCz: ""
      }
    }));
  }

  return { records: deduplicateRecords(records), warnings };
}

export async function collectFeedSource(source, options) {
  const response = await fetchVerified(source, source.endpoint, {
    maxBytes: 5_000_000,
    expectedContentTypes: ["xml", "rss"]
  });
  const xml = new TextDecoder("utf-8").decode(response.bytes);
  const parsed = source.collector === "rss"
    ? parseRssOrAtom(xml, source, options)
    : parseNewsSitemap(xml, source, options);
  return {
    sourceId: source.id,
    collector: source.collector,
    retrievedAt: options.collectedAt,
    snapshot: {
      url: response.finalUrl,
      contentType: response.contentType,
      lastModified: response.lastModified,
      etag: response.etag,
      contentHash: response.contentHash
    },
    records: parsed.records,
    warnings: parsed.warnings,
    referenceData: null
  };
}
