import { cleanText, createCollectedRecord, fetchVerified, invariant, sha256 } from "./collector-core.mjs";

const CZECH_MONTHS = new Map([
  ["ledna", 1], ["února", 2], ["března", 3], ["dubna", 4], ["května", 5], ["června", 6],
  ["července", 7], ["srpna", 8], ["září", 9], ["října", 10], ["listopadu", 11], ["prosince", 12]
]);

function parseCzechDate(value) {
  const match = cleanText(value).match(/^(\d{1,2})\.\s+([^\s]+)\s+(\d{4})$/u);
  if (!match) return null;
  const month = CZECH_MONTHS.get(match[2].toLocaleLowerCase("cs-CZ"));
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}T00:00:00.000Z`;
}

function parseCzechNumericDateTime(value) {
  const match = cleanText(value).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/u);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00`;
  const date = new Date(`${iso}Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 16) !== `${iso.slice(0, 16)}`) return null;
  return iso;
}

function allowedUrl(value, source) {
  const base = source.archiveEndpoints?.[0] ?? source.archiveEndpoint ?? source.apiEndpoint;
  const url = new URL(value, base);
  if (url.protocol !== "https:" || !source.expectedHosts.includes(url.hostname)) return null;
  if (source.itemPathPrefix && !url.pathname.startsWith(source.itemPathPrefix)) return null;
  return url.href;
}

function snapshotOf(fetched) {
  return {
    url: fetched.finalUrl,
    contentType: fetched.contentType,
    lastModified: fetched.lastModified,
    etag: fetched.etag,
    contentHash: fetched.contentHash
  };
}

function parseMkNewsArchivePage(html, source, { since }) {
  const records = [];
  const itemDates = [];
  const itemPattern = /<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*\bnovinka\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(itemPattern)) {
    const body = match[2];
    const titleMatch = body.match(/<div\b[^>]*class="[^"]*\bnovinkaNadpis\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const dateMatch = body.match(/<span\b[^>]*class="[^"]*\bnovinkaDatum\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const kindMatch = body.match(/<span\b[^>]*class="[^"]*\bnovinkaDruh\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const excerptMatch = body.match(/<div\b[^>]*class="[^"]*\bnovinkaText\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    invariant(titleMatch && dateMatch && kindMatch, `Archive item from ${source.id} is missing title, date, or publisher category`);
    const occurredAt = parseCzechNumericDateTime(dateMatch[1]);
    invariant(occurredAt, `Archive item from ${source.id} has an unsupported date: ${cleanText(dateMatch[1])}`);
    itemDates.push(occurredAt);
    if (occurredAt.slice(0, 10) < since) continue;
    const publisherCategory = cleanText(kindMatch[1]).toLocaleLowerCase("cs-CZ");
    if (source.allowedPublisherCategories && !source.allowedPublisherCategories.includes(publisherCategory)) continue;
    const url = allowedUrl(match[1], source);
    if (!url) continue;
    const title = cleanText(titleMatch[1]);
    invariant(title.length > 0, `Archive item from ${source.id} has no title`);
    records.push(createCollectedRecord({
      id: `${source.id}--news-${sha256(url).slice(0, 20)}`,
      sourceId: source.id,
      kind: "official-publication",
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      occurredAt,
      timeZone: "Europe/Prague",
      title,
      publisher: source.publisher,
      url,
      payload: {
        excerptCz: cleanText(excerptMatch?.[1], source.maxExcerptChars ?? 500),
        publisherCategory
      }
    }));
  }
  invariant(itemDates.length > 0, `Official archive ${source.id} yielded no structurally valid items`);
  return { records, itemDates };
}

export function parseMkNewsArchive(html, source, options) {
  return parseMkNewsArchivePage(html, source, options).records;
}

export async function collectMkNewsArchive(source, { since, collectedAt }) {
  invariant(/^https:\/\//.test(source.archiveEndpoint), `Source ${source.id} needs an HTTPS archiveEndpoint`);
  const records = [];
  const snapshots = [];
  let previousOldest = null;
  for (let page = 0; page < (source.maxPages ?? 100); page += 1) {
    const endpoint = new URL(source.archiveEndpoint);
    endpoint.searchParams.set("paging.pageNo", String(page));
    const fetched = await fetchVerified(source, endpoint.href, { maxBytes: 5_000_000, expectedContentTypes: ["text/html"] });
    invariant(!snapshots.some(({ contentHash }) => contentHash === fetched.contentHash), `Official archive ${source.id} repeated a page before reaching the requested cutoff`);
    const parsed = parseMkNewsArchivePage(new TextDecoder().decode(fetched.bytes), source, { since });
    const newest = parsed.itemDates.slice().sort().at(-1);
    const oldest = parsed.itemDates.slice().sort()[0];
    if (previousOldest) invariant(newest <= previousOldest, `Official archive ${source.id} is not ordered newest first across pages`);
    previousOldest = oldest;
    records.push(...parsed.records);
    snapshots.push(snapshotOf(fetched));
    if (newest.slice(0, 10) < since) break;
    invariant(page + 1 < (source.maxPages ?? 100), `Official archive ${source.id} exceeded its page safety limit before reaching the cutoff`);
  }
  return { sourceId: source.id, collector: source.collector, retrievedAt: collectedAt, snapshots, records, warnings: [], referenceData: null };
}

function parseMpsvPressArchivePage(html, source, { since }) {
  const totalMatch = html.match(/Nalezen(?:o|y)?\s*<b>(\d+)<\/b>\s*výsled(?:ek|ky|ků)/i);
  invariant(totalMatch, `Official archive ${source.id} did not expose its result count`);
  const records = [];
  const itemPattern = /<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*\bcard__basic\s+card__horizontal\b[^"]*"[^>]*>[\s\S]*?<span\b[^>]*class="one-line-heading"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span\b[^>]*class="card__basic-date"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<div\b[^>]*class="card__basic-text"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/a>/gi;
  const itemMatches = [...html.matchAll(itemPattern)];
  for (const match of itemMatches) {
    const occurredAt = parseCzechDate(match[3]);
    invariant(occurredAt, `Archive item from ${source.id} has an unsupported Czech date: ${cleanText(match[3])}`);
    if (occurredAt.slice(0, 10) < since) continue;
    const url = allowedUrl(match[1], source);
    if (!url) continue;
    const title = cleanText(match[2]);
    invariant(title.length > 0, `Archive item from ${source.id} has no title`);
    records.push(createCollectedRecord({
      id: `${source.id}--press-${sha256(url).slice(0, 20)}`,
      sourceId: source.id,
      kind: "official-publication",
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      occurredAt,
      timeZone: "Europe/Prague",
      title,
      publisher: source.publisher,
      url,
      payload: { excerptCz: cleanText(match[4], source.maxExcerptChars ?? 500) }
    }));
  }
  return { total: Number(totalMatch[1]), records, recognizedItemCount: itemMatches.length };
}

export function parseMpsvPressArchive(html, source, options) {
  return parseMpsvPressArchivePage(html, source, options).records;
}

export async function collectMpsvPressArchive(source, { since, collectedAt }) {
  invariant(Array.isArray(source.archiveEndpoints) && source.archiveEndpoints.length > 0, `Source ${source.id} needs archiveEndpoints`);
  const records = [];
  const snapshots = [];
  for (const configuredEndpoint of source.archiveEndpoints) {
    let collectedForEndpoint = 0;
    let expectedTotal = null;
    for (let page = 1; page <= (source.maxPagesPerArchive ?? 20); page += 1) {
      const endpoint = new URL(configuredEndpoint);
      endpoint.searchParams.set("pageSize", "100");
      endpoint.searchParams.set("page", String(page));
      const fetched = await fetchVerified(source, endpoint.href, { maxBytes: 5_000_000, expectedContentTypes: ["text/html"] });
      invariant(!snapshots.some(({ contentHash }) => contentHash === fetched.contentHash), `Official archive ${source.id} repeated a page before collecting every result`);
      const parsed = parseMpsvPressArchivePage(new TextDecoder().decode(fetched.bytes), source, { since });
      expectedTotal ??= parsed.total;
      invariant(parsed.total === expectedTotal, `Official archive ${source.id} changed its result count during pagination`);
      invariant(parsed.recognizedItemCount > 0 || parsed.total === 0, `Official archive ${source.id} yielded no structurally valid items`);
      collectedForEndpoint += parsed.recognizedItemCount;
      records.push(...parsed.records);
      snapshots.push(snapshotOf(fetched));
      if (collectedForEndpoint >= expectedTotal) break;
      invariant(page < (source.maxPagesPerArchive ?? 20), `Official archive ${source.id} exceeded its page safety limit before collecting every result`);
    }
  }
  return { sourceId: source.id, collector: source.collector, retrievedAt: collectedAt, snapshots, records, warnings: [], referenceData: null };
}

export function parseMsmtNewsApiPage(value, source, { since }) {
  invariant(value?.success === true, `Official API ${source.id} returned an unsuccessful response`);
  const collection = value?.data?.aktuality;
  invariant(collection && Array.isArray(collection.edges), `Official API ${source.id} returned an invalid collection`);
  invariant(typeof collection.pageInfo?.hasNextPage === "boolean", `Official API ${source.id} returned invalid pagination metadata`);
  invariant(Number.isInteger(collection.pageInfo?.total), `Official API ${source.id} returned an invalid total`);
  const records = [];
  const itemDates = [];
  for (const edge of collection.edges) {
    const item = edge?.node;
    invariant(typeof item?.id === "string" && typeof item?.slug === "string", `Official API ${source.id} returned an item without an id or slug`);
    invariant(!/[\u0000-\u001f/\\?#]/u.test(item.slug) && item.slug.length <= 300, `Official API ${source.id} returned an unsafe slug`);
    const occurredAt = item.date && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(item.date) ? item.date : null;
    invariant(occurredAt, `Official API ${source.id} returned an unsupported date`);
    itemDates.push(occurredAt);
    if (occurredAt.slice(0, 10) < since) continue;
    const url = allowedUrl(`/aktuality/${encodeURIComponent(item.slug)}`, source);
    invariant(url, `Official API ${source.id} produced a URL outside its allowlist`);
    const title = cleanText(item.title);
    invariant(title.length > 0, `Official API ${source.id} returned an item without a title`);
    records.push(createCollectedRecord({
      id: `${source.id}--news-${sha256(item.id).slice(0, 20)}`,
      sourceId: source.id,
      kind: "official-publication",
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      occurredAt,
      timeZone: "Europe/Prague",
      title,
      publisher: source.publisher,
      url,
      payload: {
        excerptCz: cleanText(item.excerpt, source.maxExcerptChars ?? 500),
        apiNodeId: item.id,
        tags: Array.isArray(item.tagsmain?.nodes) ? item.tagsmain.nodes.map(({ name }) => cleanText(name)).filter(Boolean) : []
      }
    }));
  }
  return { records, itemDates, pageInfo: collection.pageInfo };
}

export async function collectMsmtNewsApi(source, { since, collectedAt }) {
  invariant(/^https:\/\//.test(source.apiEndpoint), `Source ${source.id} needs an HTTPS apiEndpoint`);
  const records = [];
  const snapshots = [];
  let cursor = null;
  let previousOldest = null;
  for (let page = 1; page <= (source.maxPages ?? 100); page += 1) {
    const endpoint = new URL(source.apiEndpoint);
    endpoint.searchParams.set("field", "date");
    endpoint.searchParams.set("order", "desc");
    if (cursor) endpoint.searchParams.set("after", cursor);
    const fetched = await fetchVerified(source, endpoint.href, { maxBytes: 5_000_000, expectedContentTypes: ["application/json"] });
    const parsed = parseMsmtNewsApiPage(JSON.parse(new TextDecoder().decode(fetched.bytes)), source, { since });
    invariant(parsed.itemDates.length > 0, `Official API ${source.id} returned an empty page before the archive ended`);
    const newest = parsed.itemDates.slice().sort().at(-1);
    const oldest = parsed.itemDates.slice().sort()[0];
    if (previousOldest) invariant(newest <= previousOldest, `Official API ${source.id} is not ordered newest first across pages`);
    previousOldest = oldest;
    records.push(...parsed.records);
    snapshots.push(snapshotOf(fetched));
    if (!parsed.pageInfo.hasNextPage || oldest.slice(0, 10) < since) break;
    invariant(typeof parsed.pageInfo.endCursor === "string" && parsed.pageInfo.endCursor.length > 0, `Official API ${source.id} omitted its next cursor`);
    invariant(parsed.pageInfo.endCursor !== cursor, `Official API ${source.id} repeated its cursor`);
    cursor = parsed.pageInfo.endCursor;
    invariant(page < (source.maxPages ?? 100), `Official API ${source.id} exceeded its page safety limit before reaching the cutoff`);
  }
  return { sourceId: source.id, collector: source.collector, retrievedAt: collectedAt, snapshots, records, warnings: [], referenceData: null };
}

export function parseOfficialHtmlArchive(html, source, { since }) {
  const records = [];
  let recognizedItemCount = 0;
  const articlePattern = /<article\b[^>]*class="[^"]*b-article\s+link-mask[^"]*"[^>]*>[\s\S]*?<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*b-article__link[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span\b[^>]*class="[^"]*b-article__date[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/article>/gi;
  for (const match of html.matchAll(articlePattern)) {
    const occurredAt = parseCzechDate(match[3]);
    invariant(occurredAt, `Archive item from ${source.id} has an unsupported Czech date: ${cleanText(match[3])}`);
    const url = allowedUrl(match[1], source);
    if (!url) continue;
    recognizedItemCount += 1;
    if (occurredAt.slice(0, 10) < since) continue;
    const title = cleanText(match[2]);
    invariant(title.length > 0, `Archive item from ${source.id} has no title`);
    records.push(createCollectedRecord({
      id: `${source.id}--archive-${sha256(url).slice(0, 20)}`,
      sourceId: source.id,
      kind: "official-publication",
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      occurredAt,
      timeZone: "Europe/Prague",
      title,
      publisher: source.publisher,
      url,
      payload: { excerptCz: "", archiveIndex: true }
    }));
  }
  invariant(recognizedItemCount > 0, `Official archive ${source.id} yielded no structurally valid items`);
  return records;
}

export async function collectOfficialHtmlArchive(source, { since, collectedAt }) {
  invariant(Array.isArray(source.archiveEndpoints) && source.archiveEndpoints.length > 0, `Source ${source.id} needs archiveEndpoints`);
  const records = [];
  const snapshots = [];
  for (const endpoint of source.archiveEndpoints) {
    const fetched = await fetchVerified(source, endpoint, { maxBytes: 5_000_000, expectedContentTypes: ["text/html"] });
    records.push(...parseOfficialHtmlArchive(new TextDecoder().decode(fetched.bytes), source, { since }));
    snapshots.push({ url: fetched.finalUrl, contentType: fetched.contentType, lastModified: fetched.lastModified, etag: fetched.etag, contentHash: fetched.contentHash });
  }
  return { sourceId: source.id, collector: source.collector, retrievedAt: collectedAt, snapshots, records, warnings: [], referenceData: null };
}

export function parseWordPressRestPage(items, source, { since }) {
  invariant(Array.isArray(items), `WordPress source ${source.id} returned a non-array response`);
  const records = [];
  for (const item of items) {
    invariant(Number.isInteger(item.id), `WordPress source ${source.id} returned an item without an integer id`);
    if (source.wordpressCategoryId !== undefined) {
      invariant(Array.isArray(item.categories) && item.categories.includes(source.wordpressCategoryId), `WordPress source ${source.id} returned an item outside its configured category`);
    }
    const occurredAt = new Date(`${item.date_gmt}Z`).toISOString();
    if (occurredAt.slice(0, 10) < since) continue;
    const url = new URL(item.link);
    invariant(url.protocol === "https:" && source.expectedHosts.includes(url.hostname), `WordPress item from ${source.id} is outside the source host allowlist`);
    records.push(createCollectedRecord({
      id: `${source.id}--post-${item.id}`,
      sourceId: source.id,
      kind: "official-publication",
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      occurredAt,
      timeZone: "UTC",
      title: cleanText(item.title?.rendered),
      publisher: source.publisher,
      url: url.href,
      payload: {
        excerptCz: cleanText(item.excerpt?.rendered, source.maxExcerptChars ?? 500),
        wordpressPostId: item.id,
        wordpressCategoryIds: Array.isArray(item.categories) ? item.categories : [],
        ...(source.wordpressCategorySlug ? { wordpressCategorySlug: source.wordpressCategorySlug } : {})
      }
    }));
  }
  return records;
}

export async function collectWordPressRest(source, { since, collectedAt }) {
  invariant(/^https:\/\//.test(source.apiEndpoint), `Source ${source.id} needs an HTTPS apiEndpoint`);
  const records = [];
  const snapshots = [];
  const after = `${since}T00:00:00Z`;
  for (let page = 1; page <= 100; page += 1) {
    const endpoint = new URL(source.apiEndpoint);
    endpoint.searchParams.set("after", after);
    endpoint.searchParams.set("per_page", "100");
    endpoint.searchParams.set("page", String(page));
    if (source.wordpressCategoryId !== undefined) endpoint.searchParams.set("categories", String(source.wordpressCategoryId));
    endpoint.searchParams.set("_fields", "id,date_gmt,link,title,excerpt,categories");
    const fetched = await fetchVerified(source, endpoint.href, { maxBytes: 5_000_000, expectedContentTypes: ["application/json"] });
    const items = JSON.parse(new TextDecoder().decode(fetched.bytes));
    records.push(...parseWordPressRestPage(items, source, { since }));
    snapshots.push({ url: fetched.finalUrl, contentType: fetched.contentType, lastModified: fetched.lastModified, etag: fetched.etag, contentHash: fetched.contentHash });
    if (items.length < 100) break;
    invariant(page < 100, `WordPress source ${source.id} exceeded the 100-page safety limit`);
  }
  return { sourceId: source.id, collector: source.collector, retrievedAt: collectedAt, snapshots, records, warnings: [], referenceData: null };
}
