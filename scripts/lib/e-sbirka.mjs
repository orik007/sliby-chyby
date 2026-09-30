import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Reads the wording of acts from the public REST API of e-Sbírka, the
 * official electronic Collection of Laws, and keeps everything read in a
 * permanent per-act cache (docs/evidence-pipeline.md, Law-change context).
 * Requests are sent one at a time, below the API's limit of 5 per second.
 */
export const eSbirkaApi = "https://api.e-sbirka.gov.cz";
export const apiKeyVariable = "ESEL_API_ACCESS_KEY";

export const eSbirkaRequestSettings = {
  // The API allows at most 5 requests per second per key; requests start at
  // least 250 ms apart, one at a time, so a run never exceeds 4.
  minIntervalMs: 250,
  retryDelaysMs: [30_000, 90_000],
  timeoutMs: 60_000
};

/** A technical failure of e-Sbírka after every retry: it fails the run. */
export class ESbirkaUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "ESbirkaUnavailableError";
  }
}

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

/** The path of an act or of one of its wordings in the API (`/sb/2025/175/2026-07-01`), encoded as one path segment. */
export function staleUrlSegment(act, wording = null) {
  const [number, year] = act.split("/");
  return encodeURIComponent(`/sb/${year}/${number}${wording ? `/${wording}` : ""}`);
}

/**
 * A REST client that sends one request at a time, at least `minIntervalMs`
 * apart, retries a technical failure after each delay of `retryDelaysMs`,
 * and then throws ESbirkaUnavailableError. A technical failure is no answer,
 * an HTTP error, or an answer that cannot be read; an answer that the
 * document does not exist (`DOKUMENT_NENALEZEN`) is not one and returns
 * null. The key is sent in the `esel-api-access-key` header. `onRequest`
 * receives every attempt (time, duration, outcome, bytes).
 */
export function createESbirkaClient({ base = eSbirkaApi, apiKey = process.env[apiKeyVariable], fetchImpl = fetch, sleep = wait, now = Date.now, onRequest = () => {}, ...overrides } = {}) {
  const settings = { ...eSbirkaRequestSettings, ...overrides };
  let chain = Promise.resolve();
  let lastStartedAt = -Infinity;

  async function attempt(path, purpose) {
    const pause = lastStartedAt + settings.minIntervalMs - now();
    if (pause > 0) await sleep(pause);
    lastStartedAt = now();
    const startedAt = lastStartedAt;
    const entry = { at: new Date(startedAt).toISOString(), purpose, path, ok: false };
    try {
      const response = await fetchImpl(`${base}${path}`, {
        headers: { accept: "application/json", "esel-api-access-key": apiKey },
        signal: AbortSignal.timeout(settings.timeoutMs)
      });
      const body = await response.text();
      entry.status = response.status;
      entry.bytes = Buffer.byteLength(body);
      entry.durationMs = now() - startedAt;
      const parsed = JSON.parse(body);
      if (!response.ok) {
        const codes = Array.isArray(parsed?.chyby) ? parsed.chyby.map(({ kod }) => kod) : [];
        if (response.status === 400 && codes.length > 0 && codes.every((code) => code === "DOKUMENT_NENALEZEN")) {
          entry.ok = true;
          entry.notFound = true;
          return null;
        }
        throw new Error(`HTTP ${response.status}${codes.length > 0 ? ` ${codes.join(", ")}` : ""}`);
      }
      if (parsed === null || typeof parsed !== "object") throw new Error("unreadable answer");
      entry.ok = true;
      return parsed;
    } catch (error) {
      entry.durationMs ??= now() - startedAt;
      entry.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      onRequest(entry);
    }
  }

  async function run(path, purpose) {
    if (!apiKey) throw new Error(`${apiKeyVariable} is not set; the e-Sbírka REST API needs its key`);
    let lastError;
    for (let index = 0; index <= settings.retryDelaysMs.length; index += 1) {
      if (index > 0) await sleep(settings.retryDelaysMs[index - 1]);
      try {
        return await attempt(path, purpose);
      } catch (error) {
        lastError = error;
      }
    }
    throw new ESbirkaUnavailableError(`e-Sbírka failed after ${settings.retryDelaysMs.length + 1} attempts (${purpose}): ${lastError?.message ?? lastError}`);
  }

  return {
    settings,
    get(path, { purpose = "request" } = {}) {
      const result = chain.then(() => run(path, purpose));
      chain = result.catch(() => {});
      return result;
    }
  };
}

/** The identifier of the wording of an act as it was promulgated. */
export const promulgatedWording = "0000-00-00";

const isoDate = /^\d{4}-\d{2}-\d{2}$/u;

// "585/2006" from a stale URL of the Collection of Laws ("/sb/2006/585"),
// null for another collection.
function actOfStaleUrl(staleUrl) {
  const [, year, number] = /^\/sb\/(\d{4})\/(\d+)(?:\/|$)/u.exec(String(staleUrl)) ?? [];
  return year ? `${number}/${year}` : null;
}

// The Prague calendar day of an API timestamp ("2025-06-16T12:59:44.220+02:00").
function dayOf(timestamp) {
  const day = String(timestamp ?? "").slice(0, 10);
  return isoDate.test(day) ? day : null;
}

/**
 * The cache of one act: an append-only JSON Lines journal
 * `automation/law-context/<year>-<number>.jsonl` whose lines are
 * `{ kind: "wordings", readOn, wordings }` (a later line replaces an earlier
 * one; each wording is `{ wording, from, to, amendments }`, `amendments` the
 * acts e-Sbírka names as having taken effect in it),
 * `{ kind: "wording", wording, nodes }` (every node of a wording in document
 * order, each `[path, text]`, text null when the node has none), and
 * `{ kind: "promulgated", date }` (the day the act itself was promulgated,
 * null when e-Sbírka does not hold the act). A wording and a promulgation day
 * do not change, so they are never requested or checked again
 * (docs/decisions.md). The list of an act's wordings grows when an amendment
 * is promulgated, so it is trusted only for dates before the day it was read.
 */
export function createLawContextCache(directory) {
  const acts = new Map();
  const fileOf = (act) => {
    const [number, year] = act.split("/");
    return resolve(directory, `${year}-${number}.jsonl`);
  };
  let chain = Promise.resolve();

  async function load(act) {
    if (acts.has(act)) return acts.get(act);
    const entry = { wordings: null, refreshed: false, nodes: new Map(), promulgated: undefined };
    const file = fileOf(act);
    if (existsSync(file)) {
      const content = await readFile(file, "utf8");
      const lines = content.split("\n");
      const lastLine = lines.findLastIndex((line) => line.trim() !== "");
      let validLength = content.length;
      let offset = 0;
      for (const [index, line] of lines.entries()) {
        const lineStart = offset;
        offset += line.length + 1;
        if (line.trim() === "") continue;
        let value;
        try {
          value = JSON.parse(line);
        } catch {
          // Only the last line can be cut short, by a run stopped mid-write;
          // it is removed, so the next line is appended on a line of its own,
          // and what it held is requested again.
          if (index !== lastLine) throw new Error(`Corrupt law-context cache ${file} line ${index + 1}`);
          validLength = lineStart;
          continue;
        }
        if (value.kind === "wordings") entry.wordings = { readOn: value.readOn, wordings: value.wordings };
        else if (value.kind === "wording") entry.nodes.set(value.wording, value.nodes);
        else if (value.kind === "promulgated") entry.promulgated = value.date;
        else throw new Error(`Invalid law-context cache ${file} line ${index + 1}`);
      }
      const repaired = content.slice(0, validLength);
      const normalized = repaired === "" || repaired.endsWith("\n") ? repaired : `${repaired}\n`;
      if (normalized !== content) await writeFile(file, normalized, "utf8");
    }
    acts.set(act, entry);
    return entry;
  }

  function append(act, value) {
    const line = `${JSON.stringify(value)}\n`;
    chain = chain.then(async () => {
      await mkdir(directory, { recursive: true });
      await appendFile(fileOf(act), line, "utf8");
    });
    return chain;
  }

  return { load, append, flush: () => chain };
}

/**
 * The wordings of acts, their structures and node texts, and the day an act
 * was promulgated. A wording is `{ wording, from, to, amendments }` with the
 * ISO dates of its effect (`to` null when open) and the acts ("314/2025")
 * e-Sbírka names as having taken effect in it; the list leaves out the
 * promulgated wording (`0000-00-00`), which is read only when asked for by
 * that identifier. A wording is read whole, once, and then taken from the
 * cache. The list of wordings is taken from the cache for a date before the
 * day it was read (`for`), and is otherwise read again, at most once per run
 * and act. `today` is the date of reading.
 */
export function createLawContextReader({ client, cache, today = new Date().toISOString().slice(0, 10) }) {
  const stats = { requests: 0, cachedWordingLists: 0, cachedWordings: 0, cachedPromulgations: 0 };

  async function request(path, purpose) {
    stats.requests += 1;
    return client.get(path, { purpose });
  }

  async function wordings(act, { for: date = null } = {}) {
    const entry = await cache.load(act);
    const readAfter = entry.wordings && date !== null && date < entry.wordings.readOn;
    if (entry.wordings && (entry.refreshed || readAfter)) {
      stats.cachedWordingLists += 1;
      return entry.wordings.wordings;
    }
    const answer = await request(`/dokumenty-sbirky/${staleUrlSegment(act)}/historie`, `wordings ${act}`);
    if (answer !== null && !Array.isArray(answer.historie)) throw new ESbirkaUnavailableError(`e-Sbírka returned an unreadable history of ${act}`);
    const prefix = decodeURIComponent(staleUrlSegment(act));
    const list = [];
    for (const item of answer?.historie ?? []) {
      const wording = String(item.staleUrl ?? "").slice(prefix.length + 1);
      if (!String(item.staleUrl).startsWith(`${prefix}/`) || !isoDate.test(wording) || !isoDate.test(item.datumUcinnostiZneniOd ?? "") || (item.datumUcinnostiZneniDo != null && !isoDate.test(item.datumUcinnostiZneniDo))) {
        throw new ESbirkaUnavailableError(`e-Sbírka returned an unreadable wording ${item.staleUrl} in the history of ${act}`);
      }
      if (wording === promulgatedWording) {
        // The history also names the day the act was promulgated.
        const day = dayOf(item.datumCasVyhlaseni);
        if (day && entry.promulgated === undefined) {
          entry.promulgated = day;
          await cache.append(act, { kind: "promulgated", date: day });
        }
        continue;
      }
      const amendments = [...new Set((item.novely ?? []).map(({ staleUrl }) => actOfStaleUrl(staleUrl)).filter(Boolean))].sort();
      list.push({ wording, from: item.datumUcinnostiZneniOd, to: item.datumUcinnostiZneniDo ?? null, amendments });
    }
    list.sort((left, right) => left.from.localeCompare(right.from));
    entry.wordings = { readOn: today, wordings: list };
    entry.refreshed = true;
    await cache.append(act, { kind: "wordings", readOn: today, wordings: list });
    return list;
  }

  /**
   * Every node of a wording in document order, `[path, text]`, read page by
   * page. Every page must be of the wording asked for, report the same
   * number of pages, and all but the last be full; an existing wording has
   * nodes and some text. Anything else is a technical failure, never cached.
   */
  async function nodesOf(act, wording) {
    const entry = await cache.load(act);
    if (entry.nodes.has(wording)) {
      stats.cachedWordings += 1;
      return entry.nodes.get(wording);
    }
    const segment = staleUrlSegment(act, wording);
    const prefix = `/eli/cz${decodeURIComponent(segment)}/`;
    const nodes = [];
    const seen = new Set();
    const sizes = [];
    let pages = 1;
    for (let page = 0; page < pages; page += 1) {
      const answer = await request(`/dokumenty-sbirky/${segment}/fragmenty?cisloStranky=${page}`, `wording ${act} ${wording} page ${page + 1}`);
      if (answer === null) throw new ESbirkaUnavailableError(`e-Sbírka holds no nodes of the existing wording ${act} ${wording}`);
      if (!Array.isArray(answer.seznam) || !Number.isInteger(answer.pocetStranek) || answer.pocetStranek < 1 || (page > 0 && answer.pocetStranek !== pages)) {
        throw new ESbirkaUnavailableError(`e-Sbírka returned an unreadable page ${page + 1} of ${act} ${wording}`);
      }
      pages = answer.pocetStranek;
      sizes.push(answer.seznam.length);
      for (const fragment of answer.seznam) {
        const eli = String(fragment.eli ?? "");
        const text = fragment.xhtml ? plainText(fragment.xhtml) : "";
        // A block that wraps repealing or effect provisions has no ELI path
        // and no text of its own; its content follows in nodes that have
        // both. A node with text but no path would lose that text.
        if (eli === "" && text === "") continue;
        if (!eli.startsWith(prefix)) throw new ESbirkaUnavailableError(`e-Sbírka returned node ${eli || `${fragment.id} without an ELI path`} for ${act} ${wording}`);
        const path = eli.slice(prefix.length);
        if (seen.has(path)) continue;
        seen.add(path);
        nodes.push([path, text === "" ? null : text]);
      }
    }
    if (sizes.slice(0, -1).some((size) => size === 0 || size !== sizes[0]) || sizes.at(-1) === 0 || sizes.at(-1) > sizes[0]) {
      throw new ESbirkaUnavailableError(`e-Sbírka returned pages of ${sizes.join(", ")} nodes for ${act} ${wording}`);
    }
    if (!nodes.some(([, text]) => text !== null)) throw new ESbirkaUnavailableError(`e-Sbírka returned no text for the wording ${act} ${wording}`);
    entry.nodes.set(wording, nodes);
    await cache.append(act, { kind: "wording", wording, nodes });
    return nodes;
  }

  /** The paths of every node of a wording, sorted. */
  async function structure(act, wording) {
    return (await nodesOf(act, wording)).map(([path]) => path).sort();
  }

  /** The texts of exact nodes of one wording, `{ path: { text, order } }`, order the position in the document. */
  async function texts(act, wording, paths) {
    const nodes = await nodesOf(act, wording);
    const byPath = new Map(nodes.map(([path, text], order) => [path, { text, order }]));
    return Object.fromEntries(paths.map((path) => [path, byPath.get(path) ?? { text: null, order: null }]));
  }

  /**
   * The day an act was promulgated (89/2012 Sb.: 2012-03-22), not the day of
   * its effect. Null when e-Sbírka does not hold the act.
   */
  async function promulgated(act) {
    const entry = await cache.load(act);
    if (entry.promulgated !== undefined) {
      stats.cachedPromulgations += 1;
      return entry.promulgated;
    }
    const answer = await request(`/dokumenty-sbirky/${staleUrlSegment(act)}`, `promulgated ${act}`);
    const date = answer === null ? null : dayOf(answer.datumCasVyhlaseni);
    if (answer !== null && date === null) throw new ESbirkaUnavailableError(`e-Sbírka returned no promulgation day of ${act}`);
    entry.promulgated = date;
    await cache.append(act, { kind: "promulgated", date });
    return date;
  }

  return { wordings, structure, texts, promulgated, stats };
}

/** The text of a fragment without its XHTML markup. */
export function plainText(xhtml) {
  return String(xhtml)
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;/gu, " ")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}
