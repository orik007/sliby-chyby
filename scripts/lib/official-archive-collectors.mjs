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

function allowedUrl(value, source) {
  const url = new URL(value, source.archiveEndpoints[0]);
  if (url.protocol !== "https:" || !source.expectedHosts.includes(url.hostname)) return null;
  if (source.itemPathPrefix && !url.pathname.startsWith(source.itemPathPrefix)) return null;
  return url.href;
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
    endpoint.searchParams.set("_fields", "id,date_gmt,link,title,excerpt");
    const fetched = await fetchVerified(source, endpoint.href, { maxBytes: 5_000_000, expectedContentTypes: ["application/json"] });
    const items = JSON.parse(new TextDecoder().decode(fetched.bytes));
    invariant(Array.isArray(items), `WordPress source ${source.id} returned a non-array response`);
    snapshots.push({ url: fetched.finalUrl, contentType: fetched.contentType, lastModified: fetched.lastModified, etag: fetched.etag, contentHash: fetched.contentHash });
    for (const item of items) {
      invariant(Number.isInteger(item.id), `WordPress source ${source.id} returned an item without an integer id`);
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
        payload: { excerptCz: cleanText(item.excerpt?.rendered, source.maxExcerptChars ?? 500), wordpressPostId: item.id }
      }));
    }
    if (items.length < 100) break;
    invariant(page < 100, `WordPress source ${source.id} exceeded the 100-page safety limit`);
  }
  return { sourceId: source.id, collector: source.collector, retrievedAt: collectedAt, snapshots, records, warnings: [], referenceData: null };
}
