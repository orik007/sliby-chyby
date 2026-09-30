import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Reads the wording of acts from the open data of e-Sbírka, the official
 * electronic Collection of Laws, through its SPARQL endpoint, and keeps
 * everything read in a permanent per-act cache (docs/evidence-pipeline.md,
 * Law-change context). Only direct queries are sent, one at a time.
 */
export const sparqlEndpoint = "https://opendata.eselpoint.gov.cz/sparql";
export const eliBase = "https://opendata.eselpoint.gov.cz/esel-esb/eli/cz/sb/";
const vocabulary = "PREFIX s: <https://slovník.gov.cz/datový/sbírka/pojem/>\n";

export const eSbirkaRequestSettings = {
  minIntervalMs: 2_000,
  retryDelaysMs: [30_000, 90_000],
  // The endpoint returns partial results as its limit of about 60 s nears;
  // an answer this slow is never trusted.
  slowAnswerMs: 30_000,
  timeoutMs: 60_000,
  // Every node list is requested with this limit; an answer that fills it may
  // have been cut and is a technical failure. The largest act measured (the
  // civil code) has 10,472 nodes.
  maxRows: 50_000,
  textBatchSize: 100
};

/** A technical failure of e-Sbírka after every retry: it fails the run. */
export class ESbirkaUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "ESbirkaUnavailableError";
  }
}

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

/**
 * A SPARQL client that sends one request at a time, at least
 * `minIntervalMs` apart, retries a technical failure after each delay of
 * `retryDelaysMs`, and then throws ESbirkaUnavailableError. A technical
 * failure is no answer, an HTTP error, an answer after `slowAnswerMs` or
 * more, or an answer that cannot be read. `onRequest` receives every
 * attempt (time, duration, outcome, bytes).
 */
export function createSparqlClient({ endpoint = sparqlEndpoint, fetchImpl = fetch, sleep = wait, now = Date.now, onRequest = () => {}, ...overrides } = {}) {
  const settings = { ...eSbirkaRequestSettings, ...overrides };
  let chain = Promise.resolve();
  let lastStartedAt = -Infinity;

  async function attempt(query, accept, purpose) {
    const pause = lastStartedAt + settings.minIntervalMs - now();
    if (pause > 0) await sleep(pause);
    lastStartedAt = now();
    const startedAt = lastStartedAt;
    const entry = { at: new Date(startedAt).toISOString(), purpose, ok: false };
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { accept, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query }).toString(),
        signal: AbortSignal.timeout(settings.timeoutMs)
      });
      const body = await response.text();
      entry.status = response.status;
      entry.bytes = Buffer.byteLength(body);
      entry.durationMs = now() - startedAt;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (entry.durationMs >= settings.slowAnswerMs) throw new Error(`answer after ${entry.durationMs} ms may be partial`);
      const parsed = accept === "text/csv" ? parseCsvColumn(body) : JSON.parse(body).results.bindings;
      if (!Array.isArray(parsed)) throw new Error("unreadable answer");
      entry.ok = true;
      entry.rows = parsed.length;
      return parsed;
    } catch (error) {
      entry.durationMs ??= now() - startedAt;
      entry.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      onRequest(entry);
    }
  }

  async function run(query, accept, purpose) {
    let lastError;
    for (let index = 0; index <= settings.retryDelaysMs.length; index += 1) {
      if (index > 0) await sleep(settings.retryDelaysMs[index - 1]);
      try {
        return await attempt(query, accept, purpose);
      } catch (error) {
        lastError = error;
      }
    }
    throw new ESbirkaUnavailableError(`e-Sbírka SPARQL failed after ${settings.retryDelaysMs.length + 1} attempts (${purpose}): ${lastError?.message ?? lastError}`);
  }

  return {
    settings,
    query(query, { accept = "application/sparql-results+json", purpose = "query" } = {}) {
      const result = chain.then(() => run(query, accept, purpose));
      chain = result.catch(() => {});
      return result;
    }
  };
}

// The only column of a SPARQL CSV answer, without its header.
function parseCsvColumn(body) {
  const lines = body.split(/\r?\n/u);
  if (lines[0]?.trim() !== "\"z\"" && lines[0]?.trim() !== "z") return null;
  return lines.slice(1).filter((line) => line.trim() !== "").map((line) => line.trim().replace(/^"(.*)"$/u, "$1"));
}

/** The identifier of the wording of an act as it was promulgated. */
export const promulgatedWording = "0000-00-00";

export function actEliBase(act) {
  const [number, year] = act.split("/");
  return `${eliBase}${year}/${number}/`;
}

/**
 * The cache of one act: an append-only JSON Lines journal
 * `automation/law-context/<year>-<number>.jsonl` whose lines are
 * `{ kind: "wordings", readOn, wordings }` (a later line replaces an earlier
 * one), `{ kind: "structure", wording, paths }`,
 * `{ kind: "text", wording, path, text, order }` (text null when the node has
 * none; order is the fragment's position in the wording, a hexadecimal key
 * that sorts in document order), `{ kind: "amendments", wording, acts }` (the
 * acts whose amendments took effect in that wording), and
 * `{ kind: "promulgated", date }` (the day the act itself was promulgated,
 * null when e-Sbírka has no promulgated wording of it). None of these
 * change, so they are never requested or checked again (docs/decisions.md).
 * The list of an act's wordings grows when an amendment is promulgated, so
 * it is trusted only for dates before the day it was read.
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
    const entry = { wordings: null, refreshed: false, structures: new Map(), texts: new Map(), amendments: new Map(), promulgated: undefined };
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
        else if (value.kind === "structure") entry.structures.set(value.wording, value.paths);
        else if (value.kind === "text") entry.texts.set(`${value.wording}\n${value.path}`, { text: value.text, order: value.order ?? null });
        else if (value.kind === "amendments") entry.amendments.set(value.wording, value.acts);
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
 * The wordings of acts, their structures, and node texts. A wording is
 * `{ wording, from, to }` with the ISO dates of its effect (`to` null when
 * open); the list leaves out the promulgated wording (`0000-00-00`), whose
 * structure and texts are read only when asked for by that identifier. Structures and texts are read
 * once and then taken from the cache. The list of wordings is taken from the
 * cache for a date before the day it was read (`for`), and is otherwise read
 * again, at most once per run and act; `later: true` asks for wordings after
 * the date, which a list read on or before it may lack. `today` is the date
 * of reading.
 */
export function createLawContextReader({ client, cache, today = new Date().toISOString().slice(0, 10) }) {
  const stats = { requests: 0, cachedWordings: 0, cachedStructures: 0, cachedTexts: 0, cachedAmendments: 0, cachedPromulgations: 0 };

  async function wordings(act, { for: date = null, later = false } = {}) {
    const entry = await cache.load(act);
    const readAfter = entry.wordings && date !== null && date < entry.wordings.readOn;
    if (entry.wordings && (entry.refreshed || readAfter)) {
      stats.cachedWordings += 1;
      return entry.wordings.wordings;
    }
    const base = actEliBase(act);
    // Direct: the wordings of one act by the prefix of their identifiers,
    // restricted to wordings (a small class), never a scan of fragments.
    const rows = await client.query(`${vocabulary}SELECT ?zn ?od ?do WHERE { ?zn a s:znění-právního-aktu ; s:účinnost-znění-od ?od . OPTIONAL { ?zn s:účinnost-znění-do ?do } FILTER(STRSTARTS(STR(?zn), "${base}")) }`, { purpose: `wordings ${act}` });
    stats.requests += 1;
    const list = rows
      .map((row) => ({ wording: row.zn.value.slice(base.length), from: row.od.value, to: row.do?.value ?? null }))
      .filter(({ wording }) => /^\d{4}-\d{2}-\d{2}$/u.test(wording) && wording !== promulgatedWording)
      .sort((left, right) => left.from.localeCompare(right.from));
    entry.wordings = { readOn: today, wordings: list };
    entry.refreshed = true;
    await cache.append(act, { kind: "wordings", readOn: today, wordings: list });
    return list;
  }

  async function structure(act, wording) {
    const entry = await cache.load(act);
    if (entry.structures.has(wording)) {
      stats.cachedStructures += 1;
      return entry.structures.get(wording);
    }
    const root = `${actEliBase(act)}${wording}`;
    const { maxRows } = client.settings;
    // The nodes of a time wording are reached from its document by their
    // ancestors; those of the promulgated wording (`0000-00-00`) are not,
    // and are listed by the wording itself (checked on 30 September 2026).
    const query = wording === promulgatedWording
      ? `${vocabulary}SELECT ?z WHERE { <${root}> s:má-fragment-znění ?z } LIMIT ${maxRows}`
      : `${vocabulary}SELECT ?z WHERE { ?z s:má-předka+ <${root}/dokument> } LIMIT ${maxRows}`;
    const rows = await client.query(query, { accept: "text/csv", purpose: `structure ${act} ${wording}` });
    stats.requests += 1;
    if (rows.length >= maxRows) throw new ESbirkaUnavailableError(`e-Sbírka structure of ${act} ${wording} filled the row limit ${maxRows} and may be cut`);
    // An existing wording always has nodes; none means the answer is wrong.
    if (rows.length === 0) throw new ESbirkaUnavailableError(`e-Sbírka returned no structure for the existing wording ${act} ${wording}`);
    const paths = rows.filter((iri) => iri.startsWith(`${root}/`)).map((iri) => iri.slice(root.length + 1)).sort();
    entry.structures.set(wording, paths);
    await cache.append(act, { kind: "structure", wording, paths });
    return paths;
  }

  /** The texts of exact nodes of one wording, `{ path: { text, order } }`. */
  async function texts(act, wording, paths) {
    const entry = await cache.load(act);
    const root = `${actEliBase(act)}${wording}`;
    const missing = paths.filter((path) => !entry.texts.has(`${wording}\n${path}`));
    stats.cachedTexts += paths.length - missing.length;
    for (let index = 0; index < missing.length; index += client.settings.textBatchSize) {
      const batch = missing.slice(index, index + client.settings.textBatchSize);
      const values = batch.map((path) => `<${root}/${path}>`).join(" ");
      const rows = await client.query(`${vocabulary}SELECT ?z ?text ?order WHERE { VALUES ?z { ${values} } ?z s:obsahuje-fragment ?f . ?f s:text-fragmentu ?text . OPTIONAL { ?z s:pořadí-fragmentu-znění-právního-aktu ?order } }`, { purpose: `texts ${act} ${wording}` });
      stats.requests += 1;
      // A single node can have no text, but the nodes of whole provisions
      // always have some; an answer with none means the endpoint lacks the
      // links from nodes to their texts, as while its data were reloaded on
      // 30 September 2026, and is never cached.
      if (rows.length === 0) throw new ESbirkaUnavailableError(`e-Sbírka returned no text for any of ${batch.length} nodes of ${act} ${wording}`);
      const found = new Map(rows.map((row) => [row.z.value.slice(root.length + 1), { text: plainText(row.text.value), order: row.order?.value ?? null }]));
      for (const path of batch) {
        const { text, order } = found.get(path) ?? { text: null, order: null };
        entry.texts.set(`${wording}\n${path}`, { text, order });
        await cache.append(act, { kind: "text", wording, path, text, order });
      }
    }
    return Object.fromEntries(paths.map((path) => [path, entry.texts.get(`${wording}\n${path}`)]));
  }

  /**
   * The acts ("314/2025") whose amendments took effect in a wording, from the
   * consolidation links of its nodes (`konsolidační-vazba`: `má-cíl` a node
   * of the wording, `má-fragment-novely` a node of the amending act). A
   * wording can have none, such as one where a later part of the act itself
   * took effect, or one whose links e-Sbírka does not hold.
   */
  async function amendingActs(act, wording) {
    const entry = await cache.load(act);
    if (entry.amendments.has(wording)) {
      stats.cachedAmendments += 1;
      return entry.amendments.get(wording);
    }
    const root = `${actEliBase(act)}${wording}/`;
    // Direct: the links that took effect on the wording's date (an indexed
    // value), then only those into this wording.
    const rows = await client.query(`${vocabulary}PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\nSELECT DISTINCT ?novela WHERE { ?v s:má-účinnost-konsolidační-vazby-od "${wording}"^^xsd:date ; s:má-cíl ?c ; s:má-fragment-novely ?novela . FILTER(STRSTARTS(STR(?c), "${root}")) }`, { purpose: `amendments ${act} ${wording}` });
    stats.requests += 1;
    const acts = [...new Set(rows.map((row) => {
      const [, year, number] = /\/eli\/cz\/sb\/(\d{4})\/(\d+)\//u.exec(row.novela.value) ?? [];
      return year ? `${number}/${year}` : null;
    }).filter(Boolean))].sort();
    entry.amendments.set(wording, acts);
    await cache.append(act, { kind: "amendments", wording, acts });
    return acts;
  }

  /**
   * The day an act was promulgated: the start of its promulgated wording
   * (`0000-00-00`, `účinnost-znění-od`), which is the promulgation day, not
   * the day of effect (89/2012 Sb.: 2012-03-22). Null when e-Sbírka holds no
   * promulgated wording of the act.
   */
  async function promulgated(act) {
    const entry = await cache.load(act);
    if (entry.promulgated !== undefined) {
      stats.cachedPromulgations += 1;
      return entry.promulgated;
    }
    const rows = await client.query(`${vocabulary}SELECT ?od WHERE { <${actEliBase(act)}${promulgatedWording}> s:účinnost-znění-od ?od }`, { purpose: `promulgated ${act}` });
    stats.requests += 1;
    const date = rows.map((row) => row.od.value).find((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value)) ?? null;
    entry.promulgated = date;
    await cache.append(act, { kind: "promulgated", date });
    return date;
  }

  return { wordings, structure, texts, amendingActs, promulgated, stats };
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
