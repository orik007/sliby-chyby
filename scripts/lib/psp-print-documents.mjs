import { subscribe, unsubscribe } from "node:diagnostics_channel";
import { unzipSync } from "fflate";
import { Agent, ProxyAgent } from "undici";
import WordExtractor from "word-extractor";
import { fetchVerified, invariant, requestFailureCode } from "./collector-core.mjs";

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// The limits of every psp.cz request, and why (docs/evidence-pipeline.md,
// Chamber data rules). A request keeps its slot while it waits to retry, so
// when psp.cz stops answering, every download pauses rather than adding
// connections.
export const pspDownloadSettings = { concurrency: 1, retryAttempts: 6, retryDelayMs: 5_000, minIntervalMs: 3_000, connectTimeoutMs: 3_000 };

/**
 * The proxy every psp.cz request goes through, from PSP_PROXY_URL, or null
 * when it is not set (a direct connection). Only an http(s) URL with a host
 * is accepted. The URL carries the proxy's credentials, so it is never
 * logged, and an invalid value fails without echoing it.
 */
export function pspProxyUrl(env = process.env) {
  const value = env.PSP_PROXY_URL?.trim();
  if (!value) return null;
  let url = null;
  try {
    url = new URL(value);
  } catch {
    // Reported below without the value.
  }
  invariant(url && (url.protocol === "http:" || url.protocol === "https:") && url.hostname, "PSP_PROXY_URL must be an http(s) URL with a host");
  return url.href;
}

// Returns a fetch that sends every request through one shared limit. A
// request takes a slot only for itself, never while holding another, so the
// limit cannot deadlock. Attempts, retries included, take turns on one
// schedule, and each starts at least `minIntervalMs` after the previous one
// actually started. `close` releases the connection pool once every request
// has settled; it never waits on an unread answer.
// `onAttempt` receives every attempt's record (see fetchVerified). With
// `proxyUrl`, every request goes through that proxy, and the connect limit
// applies to the connection to the proxy and to psp.cz through it.
export function createPspFetcher({ concurrency, retryAttempts, retryDelayMs, minIntervalMs = 0, connectTimeoutMs = null, proxyUrl = null, onAttempt = null } = pspDownloadSettings) {
  invariant(Number.isInteger(minIntervalMs) && minIntervalMs >= 0, "minIntervalMs must be a non-negative integer");
  invariant(connectTimeoutMs === null || (Number.isInteger(connectTimeoutMs) && connectTimeoutMs > 0), "connectTimeoutMs must be a positive integer or null");
  let active = 0;
  const waiting = [];
  let lastStart = -Infinity;
  let turn = Promise.resolve();
  const beforeAttempt = () => {
    const mine = turn.then(async () => {
      const wait = lastStart + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolveWait) => setTimeout(resolveWait, wait));
      lastStart = Date.now();
    });
    turn = mine;
    return mine;
  };
  const connect = connectTimeoutMs ? { timeout: connectTimeoutMs } : undefined;
  // undici's ProxyAgent ignores `connect`: the connection to the proxy
  // takes its limit from `proxyTls`, the one to psp.cz through the tunnel
  // from `requestTls`.
  const dispatcher = proxyUrl ? new ProxyAgent({ uri: proxyUrl, proxyTls: connect, requestTls: connect }) : connect ? new Agent({ connect }) : undefined;
  const fetchPsp = async (source, url, options) => {
    if (active >= concurrency) await new Promise((resolveTurn) => waiting.push(resolveTurn));
    active += 1;
    try {
      return await fetchVerified(source, url, { ...options, retryAttempts, retryDelayMs, onAttempt, beforeAttempt, dispatcher });
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
  fetchPsp.close = async () => dispatcher?.destroy();
  return fetchPsp;
}

/**
 * Like Promise.all, but rejects only after every promise has settled, with
 * the first rejection in order. A failed download then never leaves another
 * request running unseen after the request log is closed.
 */
export async function allSettledOrThrow(promises) {
  const outcomes = await Promise.allSettled(promises);
  const failure = outcomes.find(({ status }) => status === "rejected");
  if (failure) throw failure.reason;
  return outcomes.map(({ value }) => value);
}

const connectChannels = ["undici:client:beforeConnect", "undici:client:connected", "undici:client:connectError"];

/**
 * Records how the run uses psp.cz, so its limits can be measured from the
 * run artifact: every download attempt (passed to `onAttempt`) and every new
 * connection Node's fetch opens to `hostname`, with how long connecting took
 * and why it failed. A request sent over a kept-alive connection opens none.
 * Connections are observed through the `undici:client:*` diagnostics
 * channels, which both Node's bundled client and the undici package the
 * fetcher's connection pool comes from publish; `stop` ends the observation. `onEntry`, when given,
 * receives each entry as soon as it is recorded, so it can be saved before
 * the process ends.
 */
export function createPspRequestLog({ hostname = "www.psp.cz", now = Date.now, onEntry = null } = {}) {
  const entries = [];
  const record = (entry) => {
    entries.push(entry);
    onEntry?.(entry);
  };
  // Node reports the start and the end of a connection in separate messages
  // that share only the client's connector, so starts wait in order per
  // connector; when two connections open at once, their durations may be
  // swapped, never their count.
  const connecting = new Map();
  const finish = ({ connector }, error) => {
    const startedAt = connecting.get(connector)?.shift();
    if (startedAt === undefined) return;
    record({ type: "connect", startedAt: new Date(startedAt).toISOString(), durationMs: now() - startedAt, error });
  };
  const handlers = {
    "undici:client:beforeConnect": ({ connectParams, connector }) => {
      if (connectParams?.hostname !== hostname) return;
      if (!connecting.has(connector)) connecting.set(connector, []);
      connecting.get(connector).push(now());
    },
    "undici:client:connected": (message) => finish(message, null),
    "undici:client:connectError": (message) => finish(message, requestFailureCode(message.error))
  };
  for (const name of connectChannels) subscribe(name, handlers[name]);
  return {
    entries,
    onAttempt: (attempt) => record({ type: "attempt", ...attempt }),
    stop: () => {
      for (const name of connectChannels) unsubscribe(name, handlers[name]);
    },
    summary: () => summarizePspRequests(entries)
  };
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

// The largest number of events that started within any 60 s.
function busiestMinute(entries) {
  const times = entries.map(({ startedAt }) => Date.parse(startedAt)).sort((a, b) => a - b);
  let most = 0;
  for (let first = 0, last = 0; last < times.length; last += 1) {
    while (times[last] - times[first] >= 60_000) first += 1;
    most = Math.max(most, last - first + 1);
  }
  return most;
}

/**
 * Totals of a psp.cz request log: attempts and connections, how many failed
 * and why, the most started within any 60 s, and the average per minute over
 * the time between the first and the last start (null below one minute).
 */
export function summarizePspRequests(entries) {
  const attempts = entries.filter(({ type }) => type === "attempt");
  const connections = entries.filter(({ type }) => type === "connect");
  const starts = entries.map(({ startedAt }) => Date.parse(startedAt));
  const minutes = starts.length > 1 ? (Math.max(...starts) - Math.min(...starts)) / 60_000 : 0;
  const perMinute = (count) => (minutes >= 1 ? Number((count / minutes).toFixed(1)) : null);
  const failedAttempts = attempts.filter(({ error, status }) => error || status !== 200);
  const failedConnections = connections.filter(({ error }) => error);
  return {
    minutes: Number(minutes.toFixed(1)),
    attempts: attempts.length,
    urls: new Set(attempts.map(({ url }) => url)).size,
    failedAttempts: failedAttempts.length,
    failedAttemptsBy: countBy(failedAttempts, ({ error, status }) => error ?? `HTTP ${status}`),
    attemptsPerMinute: perMinute(attempts.length),
    busiestMinuteAttempts: busiestMinute(attempts),
    connections: connections.length,
    failedConnections: failedConnections.length,
    failedConnectionsBy: countBy(failedConnections, ({ error }) => error),
    connectionsPerMinute: perMinute(connections.length),
    busiestMinuteConnections: busiestMinute(connections)
  };
}

export function officialPrintDocumentPageUrl(termNumber, printNumber, partNumber = 0) {
  return `https://www.psp.cz/sqw/text/tiskt.sqw?O=${termNumber}&CT=${printNumber}&CT1=${partNumber}`;
}

export function officialPrintHistoryUrl(termNumber, printNumber) {
  return `https://www.psp.cz/sqw/historie.sqw?o=${termNumber}&t=${printNumber}`;
}

export function extractDocxParagraphs(bytes) {
  const entries = unzipSync(bytes);
  const names = Object.keys(entries);
  invariant(names.length > 0 && names.length < 5_000, "DOCX archive has an unsafe entry count");
  const totalBytes = Object.values(entries).reduce((sum, entry) => sum + entry.byteLength, 0);
  invariant(totalBytes <= 40_000_000, "DOCX archive exceeds the uncompressed size limit");
  const documentName = names.find((name) => name.toLowerCase() === "word/document.xml");
  invariant(documentName, "DOCX archive is missing word/document.xml");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(entries[documentName]);
  const paragraphs = [];
  for (const paragraphMatch of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)) {
    const fragments = [];
    const content = paragraphMatch[1];
    const tokenPattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:br\b[^>]*\/?\s*>/gi;
    for (const token of content.matchAll(tokenPattern)) {
      if (token[1] !== undefined) fragments.push(decodeXml(token[1]));
      else fragments.push(" ");
    }
    const text = fragments.join("").replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
  }
  invariant(paragraphs.length > 0, "Official DOCX document contains no readable paragraphs");
  return paragraphs;
}

/**
 * The paragraphs of a Word 97-2003 (.doc) file, which psp.cz lists for some
 * prints instead of a DOCX. Quotation marks are kept as written
 * (`filterUnicode: false`), and white space is normalized as in a DOCX.
 */
export async function extractDocParagraphs(bytes) {
  const document = await new WordExtractor().extract(Buffer.from(bytes));
  const paragraphs = document.getBody({ filterUnicode: false }).split(/\r?\n/).map((paragraph) => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean);
  invariant(paragraphs.length > 0, "Official DOC document contains no readable paragraphs");
  return paragraphs;
}
