import { createHash } from "node:crypto";
import { log } from "./run-log.mjs";

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  const input = value instanceof Uint8Array ? value : canonicalize(value);
  return createHash("sha256").update(input).digest("hex");
}

export function cleanText(value, maxLength = Number.POSITIVE_INFINITY) {
  if (value === undefined || value === null) return "";
  const raw = typeof value === "object" ? value["#text"] ?? value.__cdata ?? "" : String(value);
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&hellip;/gi, "…")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function validateRegistry(registry) {
  invariant(registry?.schemaVersion === "1.0.0", "Unsupported collector registry schemaVersion");
  invariant(Array.isArray(registry.sources), "Collector registry must contain sources");
  const ids = new Set();
  for (const source of registry.sources) {
    invariant(typeof source.id === "string" && source.id.length > 0, "Collector source is missing id");
    invariant(!ids.has(source.id), `Duplicate collector source id: ${source.id}`);
    ids.add(source.id);
    invariant(source.collector === "psp-open-data", `Unknown collector type: ${source.collector}`);
    invariant(source.primary === true && source.evidenceRole === "primary-record", `Source ${source.id} must be a primary official record; media, press releases, and party websites are not evidence sources`);
    invariant(typeof source.enabled === "boolean", `Source ${source.id} is missing enabled`);
    invariant(/^\d{4}-\d{2}-\d{2}$/.test(source.bootstrapFrom), `Source ${source.id} needs bootstrapFrom in YYYY-MM-DD format`);
    invariant(/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt), `Source ${source.id} has invalid verifiedAt`);
    invariant(/^https:\/\//.test(source.verificationUrl), `Source ${source.id} needs an HTTPS verificationUrl`);
    invariant(source.coverage?.mode === "term-snapshot", `Source ${source.id} needs a supported coverage mode`);
    invariant(typeof source.coverage?.note === "string" && source.coverage.note.length > 0, `Source ${source.id} needs a coverage note`);
    invariant(Array.isArray(source.expectedHosts) && source.expectedHosts.length > 0, `Source ${source.id} needs expectedHosts`);
  }
  return registry;
}

export function validateCollectedRecord(record) {
  invariant(record?.schemaVersion === "1.0.0", "Collected record has an unsupported schemaVersion");
  invariant(typeof record.id === "string" && record.id.length > 0, "Collected record is missing id");
  invariant(typeof record.sourceId === "string" && record.sourceId.length > 0, "Collected record is missing sourceId");
  invariant(["parliamentary-vote", "legislative-step"].includes(record.kind), `Unknown record kind: ${record.kind}`);
  invariant(typeof record.primary === "boolean", `Record ${record.id} is missing primary`);
  invariant(/^https:\/\//.test(record.url), `Record ${record.id} must use an HTTPS URL`);
  invariant(typeof record.title === "string" && record.title.length > 0, `Record ${record.id} is missing title`);
  invariant(/^[a-f0-9]{64}$/.test(record.contentHash), `Record ${record.id} has an invalid contentHash`);
  return record;
}

export function createCollectedRecord(fields) {
  const content = {
    schemaVersion: "1.0.0",
    id: fields.id,
    sourceId: fields.sourceId,
    kind: fields.kind,
    primary: fields.primary,
    evidenceRole: fields.evidenceRole,
    occurredAt: fields.occurredAt,
    timeZone: fields.timeZone ?? null,
    title: fields.title,
    publisher: fields.publisher,
    url: fields.url,
    payload: fields.payload ?? {}
  };
  return validateCollectedRecord({ ...content, contentHash: sha256(content) });
}

export function deduplicateRecords(records) {
  const byId = new Map();
  for (const record of records) {
    validateCollectedRecord(record);
    const existing = byId.get(record.id);
    if (!existing) byId.set(record.id, record);
    else invariant(existing.contentHash === record.contentHash, `Conflicting records share id ${record.id}`);
  }
  return [...byId.values()].sort((a, b) => `${a.occurredAt ?? ""}:${a.id}`.localeCompare(`${b.occurredAt ?? ""}:${b.id}`));
}

function allowedHostname(hostname, expectedHosts) {
  return expectedHosts.some((expected) => hostname === expected);
}

function isTransientResponse(response) {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchVerified(source, endpoint, { maxBytes, expectedContentTypes, retryAttempts = 4, retryDelayMs = 1_000 }) {
  const requested = new URL(endpoint);
  invariant(requested.protocol === "https:", `Source ${source.id} endpoint must use HTTPS`);
  invariant(allowedHostname(requested.hostname, source.expectedHosts), `Source ${source.id} endpoint host is not allowlisted`);

  let response;
  let bytes;
  invariant(Number.isInteger(retryAttempts) && retryAttempts > 0, "retryAttempts must be a positive integer");
  invariant(Number.isInteger(retryDelayMs) && retryDelayMs >= 0, "retryDelayMs must be a non-negative integer");
  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      response = await fetch(endpoint, {
        headers: { "User-Agent": "SlibyChyby/0.1 (+https://github.com/orik007/sliby-chyby)" },
        redirect: "follow",
        signal: controller.signal
      });
      if (response.ok) bytes = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      const reason = error?.name === "AbortError" ? "no answer within 45 s" : (error instanceof Error ? error.message : String(error));
      if (attempt === retryAttempts) {
        log(`download failed after ${attempt} attempts: ${endpoint} (${reason})`);
        throw error;
      }
      log(`download attempt ${attempt}/${retryAttempts} failed: ${endpoint} (${reason}); retrying`);
      await delay(retryDelayMs * 2 ** (attempt - 1));
      continue;
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok || !isTransientResponse(response) || attempt === retryAttempts) break;
    log(`download attempt ${attempt}/${retryAttempts} got HTTP ${response.status}: ${endpoint}; retrying`);
    await response.body?.cancel();
    await delay(retryDelayMs * 2 ** (attempt - 1));
  }

  invariant(response.ok, `Source ${source.id} returned HTTP ${response.status}`);
  const finalUrl = new URL(response.url);
  invariant(finalUrl.protocol === "https:" && allowedHostname(finalUrl.hostname, source.expectedHosts), `Source ${source.id} redirected outside its allowlist`);

  const contentType = response.headers.get("content-type") ?? "";
  invariant(expectedContentTypes.some((expected) => contentType.toLowerCase().includes(expected)), `Source ${source.id} returned unexpected content type: ${contentType}`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength) invariant(declaredLength <= maxBytes, `Source ${source.id} exceeds the declared size limit`);

  invariant(bytes.byteLength <= maxBytes, `Source ${source.id} exceeds the downloaded size limit`);
  return {
    bytes,
    finalUrl: response.url,
    contentType,
    lastModified: response.headers.get("last-modified"),
    etag: response.headers.get("etag"),
    contentHash: sha256(bytes)
  };
}

