import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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
  // A failed request is retried 10 times, after 1, 2, 4, 8, 16 s and then
  // 32 s each (about 3 minutes in all), before the run fails; a run can be
  // started again, and keeps everything it cached.
  retryDelaysMs: Array.from({ length: 10 }, (_, index) => 1_000 * 2 ** Math.min(index, 5)),
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
      if (!response.ok) {
        // An error body need not be JSON; its status alone decides.
        let codes = [];
        try {
          const failure = JSON.parse(body);
          if (Array.isArray(failure?.chyby)) codes = failure.chyby.map(({ kod }) => kod);
        } catch {}
        if (response.status === 400 && codes.length > 0 && codes.every((code) => code === "DOKUMENT_NENALEZEN")) {
          entry.ok = true;
          entry.notFound = true;
          return null;
        }
        const error = new Error(`HTTP ${response.status}${codes.length > 0 ? ` ${codes.join(", ")}` : ""}`);
        // A rejected key stays rejected; waiting for it only delays the run.
        error.final = response.status === 401 || response.status === 403;
        throw error;
      }
      const parsed = JSON.parse(body);
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
        if (error?.final) throw new ESbirkaUnavailableError(`e-Sbírka rejected the key (${purpose}): ${error.message}`);
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

// Reads an append-only JSON Lines journal. Only the last line can be cut
// short, by a run stopped mid-write; it is removed, so the next line is
// appended on a line of its own, and what it held is requested again.
async function readJournal(file) {
  if (!existsSync(file)) return [];
  const content = await readFile(file, "utf8");
  const lines = content.split("\n");
  const lastLine = lines.findLastIndex((line) => line.trim() !== "");
  const values = [];
  let validLength = content.length;
  let offset = 0;
  for (const [index, line] of lines.entries()) {
    const lineStart = offset;
    offset += line.length + 1;
    if (line.trim() === "") continue;
    try {
      values.push({ value: JSON.parse(line), line: index + 1 });
    } catch {
      if (index !== lastLine) throw new Error(`Corrupt law-context cache ${file} line ${index + 1}`);
      validLength = lineStart;
    }
  }
  const repaired = content.slice(0, validLength);
  const normalized = repaired === "" || repaired.endsWith("\n") ? repaired : `${repaired}\n`;
  if (normalized !== content) await writeFile(file, normalized, "utf8");
  return values;
}

/** The journal of what e-Sbírka reported as changed, in the cache directory. */
export const changesJournal = "changes.jsonl";

/**
 * The cache of acts in one directory. Each act has an append-only JSON Lines
 * journal `<year>-<number>.jsonl` whose lines, each with `readAt` (the UTC
 * time of the answer it holds), are `{ kind: "wordings", wordings }` (each
 * wording `{ wording, from, to, amendments }`, `amendments` the acts
 * e-Sbírka names as having taken effect in it), `{ kind: "wording", wording,
 * nodes }` (every node of a wording in document order, each `[path, text]`,
 * text null when the node has none), and `{ kind: "promulgated", date }` (the
 * day the act itself was promulgated, null when e-Sbírka does not hold the
 * act); a later line replaces an earlier one. `changes.jsonl` records each
 * check of what e-Sbírka changed since the previous one (see
 * createLawContextReader).
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
    const entry = { wordings: null, nodes: new Map(), promulgated: null };
    const file = fileOf(act);
    for (const { value, line } of await readJournal(file)) {
      if (value.kind === "wordings") entry.wordings = { readAt: value.readAt ?? "", wordings: value.wordings };
      else if (value.kind === "wording") entry.nodes.set(value.wording, { readAt: value.readAt ?? "", nodes: value.nodes });
      else if (value.kind === "promulgated") entry.promulgated = { readAt: value.readAt ?? "", date: value.date };
      else throw new Error(`Invalid law-context cache ${file} line ${line}`);
    }
    acts.set(act, entry);
    return entry;
  }

  async function loadChanges() {
    return (await readJournal(resolve(directory, changesJournal))).map(({ value }) => value);
  }

  /** The earliest time any cached answer was read, or null for an empty cache. */
  async function earliestReadAt() {
    if (!existsSync(directory)) return null;
    let earliest = null;
    for (const name of (await readdir(directory)).filter((file) => /^\d{4}-\d+\.jsonl$/u.test(file)).sort()) {
      for (const { value } of await readJournal(resolve(directory, name))) {
        const readAt = value.readAt ?? "";
        if (readAt !== "" && (earliest === null || readAt < earliest)) earliest = readAt;
      }
    }
    return earliest;
  }

  function appendTo(file, value) {
    const line = `${JSON.stringify(value)}\n`;
    chain = chain.then(async () => {
      await mkdir(directory, { recursive: true });
      await appendFile(file, line, "utf8");
    });
    return chain;
  }

  return {
    load,
    loadChanges,
    earliestReadAt,
    append: (act, value) => appendTo(fileOf(act), value),
    appendChanges: (value) => appendTo(resolve(directory, changesJournal), value),
    flush: () => chain
  };
}

// How far before the previous check the next one starts, so that no change
// is missed between two clocks.
const changesOverlapMs = 60 * 60 * 1000;
// The most changes the API returns for one request ((start + 1) * pocet may
// not exceed 10,000).
const changesPageSize = 10_000;

/**
 * The wordings of acts, their structures and nodes (`nodes`, every
 * `[path, text]` in document order), and the day an act was promulgated. A wording is `{ wording, from, to, amendments }` with the
 * ISO dates of its effect (`to` null when open) and the acts ("314/2025")
 * e-Sbírka names as having taken effect in it; the list leaves out the
 * promulgated wording (`0000-00-00`), which is read only when asked for by
 * that identifier.
 *
 * Nothing cached is requested again unless e-Sbírka reports it changed.
 * Before its first read, the reader asks once per run for the wordings
 * e-Sbírka changed or withdrew since its previous check (an hour earlier, to
 * cover the difference of clocks), and records the answer in the changes
 * journal. A cached answer is out of date when it was read before a check
 * that reported: for an act's list of wordings, any wording of the act; for
 * a wording, that wording; for everything, a check that could not list every
 * change. Only what is out of date is requested again, when it is needed.
 * The first check of a cache starts from its earliest answer; an empty cache
 * needs none. `clock` gives the time of each answer, stored with it.
 */
export function createLawContextReader({ client, cache, clock = () => new Date().toISOString() }) {
  const stats = { requests: 0, cachedWordingLists: 0, cachedWordings: 0, cachedPromulgations: 0, changedWordings: 0 };
  let changes = null;

  async function request(path, purpose) {
    stats.requests += 1;
    return client.get(path, { purpose });
  }

  // Every wording of the Collection of Laws a change list names, as
  // [act, wording]; a wording without a date of effect names the whole act.
  async function changedSince(kind, from) {
    const answer = await request(`/dokumenty-sbirky/${kind}?datumCasOdberuOd=${encodeURIComponent(from)}&start=0&pocet=${changesPageSize}`, `changes ${kind} since ${from}`);
    const list = answer?.seznamZneniPravnichPredpisu;
    if (!Array.isArray(list) || !Number.isInteger(answer.pocetCelkem)) throw new ESbirkaUnavailableError(`e-Sbírka returned an unreadable list of ${kind}`);
    const wordings = list
      .filter(({ kodSbirky }) => kodSbirky === "sb")
      .map(({ rok, cisloPredpisu, datumUcinnostiZneniOd }) => [`${cisloPredpisu}/${rok}`, isoDate.test(datumUcinnostiZneniOd ?? "") ? datumUcinnostiZneniOd : null]);
    return { wordings, complete: answer.pocetCelkem <= list.length };
  }

  async function ready() {
    changes ??= (async () => {
      const journal = await cache.loadChanges();
      const from = journal.at(-1)?.readAt ?? await cache.earliestReadAt();
      const readAt = clock();
      if (from === null) {
        await cache.appendChanges({ kind: "changes", from: null, readAt, complete: true, wordings: [] });
        journal.push({ readAt, complete: true, wordings: [] });
      } else {
        const since = new Date(Date.parse(from) - changesOverlapMs).toISOString();
        const changed = await changedSince("zmeny-zneni", since);
        const withdrawn = await changedSince("depublikovana-zneni", since);
        const line = { kind: "changes", from: since, readAt, complete: changed.complete && withdrawn.complete, wordings: [...changed.wordings, ...withdrawn.wordings] };
        await cache.appendChanges(line);
        journal.push(line);
        stats.changedWordings = line.wordings.length;
      }
      const latest = (map, key, time) => { if (!map.has(key) || map.get(key) < time) map.set(key, time); };
      const state = { all: "", acts: new Map(), wholeActs: new Map(), wordings: new Map() };
      for (const { readAt: time, complete, wordings } of journal) {
        if (!complete && time > state.all) state.all = time;
        for (const [act, wording] of wordings) {
          latest(state.acts, act, time);
          if (wording === null) latest(state.wholeActs, act, time);
          else latest(state.wordings, `${act}\n${wording}`, time);
        }
      }
      return state;
    })();
    return changes;
  }

  // Whether a cached answer read at `readAt` is out of date; one without a
  // time of reading always is. The change lists name a wording by its date
  // of effect, and the promulgated wording (`0000-00-00`) by the day the act
  // was promulgated, so for it that day is checked too.
  async function outdated(readAt, act, wording = null) {
    const state = await ready();
    if (!readAt) return true;
    const keys = wording === null ? [] : [wording];
    if (wording === promulgatedWording) {
      const day = (await cache.load(act)).promulgated?.date;
      if (day) keys.push(day);
    }
    const times = [state.all, wording === null ? state.acts.get(act) : state.wholeActs.get(act), ...keys.map((key) => state.wordings.get(`${act}\n${key}`))];
    return times.some((time) => time && readAt < time);
  }

  async function wordings(act) {
    const entry = await cache.load(act);
    if (entry.wordings && !(await outdated(entry.wordings.readAt, act))) {
      stats.cachedWordingLists += 1;
      return entry.wordings.wordings;
    }
    await ready();
    const answer = await request(`/dokumenty-sbirky/${staleUrlSegment(act)}/historie`, `wordings ${act}`);
    const readAt = clock();
    if (answer !== null && !Array.isArray(answer.historie)) throw new ESbirkaUnavailableError(`e-Sbírka returned an unreadable history of ${act}`);
    const prefix = decodeURIComponent(staleUrlSegment(act));
    const list = [];
    for (const item of answer?.historie ?? []) {
      const wording = String(item.staleUrl ?? "").slice(prefix.length + 1);
      // A future wording whose effect the act states only in words has no
      // date of effect (e-Sbírka numbers it in the year 3000) and cannot be
      // placed in time.
      if (item.datumUcinnostiZneniOd == null && item.typZneni === "BUDOUCI") continue;
      if (!String(item.staleUrl).startsWith(`${prefix}/`) || !isoDate.test(wording) || !isoDate.test(item.datumUcinnostiZneniOd ?? "") || (item.datumUcinnostiZneniDo != null && !isoDate.test(item.datumUcinnostiZneniDo))) {
        throw new ESbirkaUnavailableError(`e-Sbírka returned an unreadable wording ${item.staleUrl} in the history of ${act}`);
      }
      if (wording === promulgatedWording) {
        // The history also names the day the act was promulgated.
        const day = dayOf(item.datumCasVyhlaseni);
        if (day && entry.promulgated?.date !== day) {
          entry.promulgated = { readAt, date: day };
          await cache.append(act, { kind: "promulgated", date: day, readAt });
        }
        continue;
      }
      const amendments = [...new Set((item.novely ?? []).map(({ staleUrl }) => actOfStaleUrl(staleUrl)).filter(Boolean))].sort();
      list.push({ wording, from: item.datumUcinnostiZneniOd, to: item.datumUcinnostiZneniDo ?? null, amendments });
    }
    list.sort((left, right) => left.from.localeCompare(right.from));
    entry.wordings = { readAt, wordings: list };
    await cache.append(act, { kind: "wordings", readAt, wordings: list });
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
    const cached = entry.nodes.get(wording);
    if (cached && !(await outdated(cached.readAt, act, wording))) {
      stats.cachedWordings += 1;
      return cached.nodes;
    }
    await ready();
    const segment = staleUrlSegment(act, wording);
    const prefix = `/eli/cz${decodeURIComponent(segment)}/`;
    const nodes = [];
    const seen = new Set();
    const sizes = [];
    let pages = 1;
    let readAt = null;
    for (let page = 0; page < pages; page += 1) {
      const answer = await request(`/dokumenty-sbirky/${segment}/fragmenty?cisloStranky=${page}`, `wording ${act} ${wording} page ${page + 1}`);
      readAt ??= clock();
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
        // A node listed twice means a page was served twice or out of
        // order, and another page may be missing.
        if (seen.has(path)) throw new ESbirkaUnavailableError(`e-Sbírka returned node ${path} twice for ${act} ${wording}`);
        seen.add(path);
        nodes.push([path, text === "" ? null : text]);
      }
    }
    if (sizes.slice(0, -1).some((size) => size === 0 || size !== sizes[0]) || sizes.at(-1) === 0 || sizes.at(-1) > sizes[0]) {
      throw new ESbirkaUnavailableError(`e-Sbírka returned pages of ${sizes.join(", ")} nodes for ${act} ${wording}`);
    }
    if (!nodes.some(([, text]) => text !== null)) throw new ESbirkaUnavailableError(`e-Sbírka returned no text for the wording ${act} ${wording}`);
    entry.nodes.set(wording, { readAt, nodes });
    await cache.append(act, { kind: "wording", wording, readAt, nodes });
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
    if (entry.promulgated && !(await outdated(entry.promulgated.readAt, act, promulgatedWording))) {
      stats.cachedPromulgations += 1;
      return entry.promulgated.date;
    }
    await ready();
    const answer = await request(`/dokumenty-sbirky/${staleUrlSegment(act)}`, `promulgated ${act}`);
    const readAt = clock();
    const date = answer === null ? null : dayOf(answer.datumCasVyhlaseni);
    if (answer !== null && date === null) throw new ESbirkaUnavailableError(`e-Sbírka returned no promulgation day of ${act}`);
    entry.promulgated = { readAt, date };
    await cache.append(act, { kind: "promulgated", date, readAt });
    return date;
  }

  return { wordings, structure, texts, nodes: nodesOf, promulgated, stats };
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
