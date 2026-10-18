import { appendFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanText, createCollectedRecord, invariant, sha256 } from "./collector-core.mjs";
import { readJournal } from "./e-sbirka.mjs";
import { extractDocParagraphs, extractDocxParagraphs } from "./psp-print-documents.mjs";
import { extractXlsxRows } from "./xlsx-rows.mjs";
import { governmentPartiesOn } from "./psp-collector.mjs";

/**
 * Government resolutions from the Government Office's portal zVlády
 * (docs/evidence-pipeline.md, Government resolution data rules): which
 * resolutions there are, their adoption date, material, and text, read one
 * request at a time and cached for good in the audit state. A resolution that
 * only approves what another row of the conduct table records (a government
 * bill, treaty, opinion, or regulation) is left out. Each other one is a
 * record of its adoption, attributed to every governing party on that day
 * (docs/scoring.md), and carries its text, from which it is one law change.
 */

export { resolutionKind, resolutionSourceId } from "./government-resolution-kind.mjs";
import { resolutionKind, resolutionSourceId } from "./government-resolution-kind.mjs";

const portalOrigin = "https://odok.gov.cz";
const allowedHosts = new Set(["odok.gov.cz", "www.odok.gov.cz"]);
export const governmentOfficeUserAgent = "Slibomer/1.0 (+https://slibomer.cz)";

export function resolutionPageUrl(year, number) {
  return `${portalOrigin}/portal/zvlady/usneseni/${year}/${number}/`;
}

export function eklepRequestsUrl(year) {
  return `https://www.odok.gov.cz/opendata/dataset/odok/requests_${year}.json`;
}

/** The identifier of a resolution's print-like unit (`uv-2026-330`). */
export function resolutionPrintId(year, number) {
  return `uv-${year}-${number}`;
}

/** The public name of a resolution: “Usnesení vlády č. 330/2026”. */
export function resolutionNumberCz(year, number) {
  return `Usnesení vlády č. ${number}/${year}`;
}

// The Government Office's firewall answers a client that does not say who it
// is with HTTP 200 and a short page with this title (323 bytes, seen on 17
// October 2026).
const firewallBlockTitle = "<title>Požadavek byl zablokován</title>";

function isFirewallBlock({ bytes }) {
  return bytes !== undefined && bytes.byteLength < 4_096 && new TextDecoder("utf-8").decode(bytes).includes(firewallBlockTitle);
}

/** A request the Government Office's firewall blocked; never retried. */
export class GovernmentOfficeBlockedError extends Error {}

class ResponseTooLargeError extends Error {}

// The bytes of an answer, read as they arrive and given up as soon as they
// pass `maxBytes`, so an oversized file is never held whole in memory.
async function boundedBody(response, maxBytes) {
  if (!response.body) return new Uint8Array(0);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    // Leaving the loop cancels the rest of the stream.
    if (length > maxBytes) throw new ResponseTooLargeError();
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Requests to the Government Office, one at a time and at least
 * `minIntervalMs` apart (docs/evidence-pipeline.md, Government resolution
 * data rules, Requests). A lost connection, an answer that did not come in
 * time, and HTTP 429, 502, 503, or 504 are retried after each of
 * `retryDelaysMs`, never sooner than the interval; a firewall block stops at
 * once. Returns the status and bytes of any other answer; `onRequest`
 * receives every attempt.
 */
export function createGovernmentOfficeFetcher({
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  now = Date.now,
  onRequest = () => {},
  minIntervalMs = 6_000,
  retryDelaysMs = [1, 2, 4, 8, 16, 32, 32, 32, 32, 32].map((seconds) => seconds * 1_000),
  timeoutMs = 60_000,
  maxBytes = 40_000_000
} = {}) {
  let last = null;
  let chain = Promise.resolve();
  const stats = { requests: 0, retried: 0 };

  async function attempt(url, purpose, attemptNumber) {
    if (last !== null) {
      const wait = last + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
    }
    last = now();
    stats.requests += 1;
    const startedAt = now();
    const entry = { at: new Date(startedAt).toISOString(), purpose, url, attempt: attemptNumber };
    let response;
    let bytes;
    try {
      response = await fetchImpl(url, { headers: { "user-agent": governmentOfficeUserAgent }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      bytes = await boundedBody(response, maxBytes);
    } catch (error) {
      if (error instanceof ResponseTooLargeError) {
        onRequest({ ...entry, status: response.status, error: "too-large", ms: now() - startedAt });
        throw new Error(`${url} is larger than ${maxBytes} bytes`);
      }
      const code = error?.name === "TimeoutError" || error?.name === "AbortError" ? `timeout-${timeoutMs / 1_000}s` : error?.cause?.code ?? error?.code ?? String(error?.message ?? error);
      onRequest({ ...entry, error: code, ms: now() - startedAt });
      return { error: code };
    }
    onRequest({ ...entry, status: response.status, bytes: bytes.byteLength, ms: now() - startedAt });
    invariant(allowedHosts.has(new URL(response.url || url).hostname), `The Government Office redirected ${url} outside its hosts: ${response.url}`);
    return { status: response.status, bytes };
  }

  async function get(url, { purpose }) {
    for (let attemptNumber = 0; ; attemptNumber += 1) {
      const answer = await attempt(url, purpose, attemptNumber);
      if (isFirewallBlock(answer)) {
        throw new GovernmentOfficeBlockedError(`The Government Office's firewall blocked ${url} (“Požadavek byl zablokován”); the run stops`);
      }
      const transient = answer.error !== undefined || [429, 502, 503, 504].includes(answer.status);
      if (!transient) return answer;
      if (attemptNumber >= retryDelaysMs.length) {
        throw new Error(`${url} failed after ${attemptNumber + 1} attempts: ${answer.error ?? `HTTP ${answer.status}`}`);
      }
      stats.retried += 1;
      await sleep(retryDelaysMs[attemptNumber]);
    }
  }

  return {
    stats,
    get: (url, options) => {
      const result = chain.then(() => get(url, options));
      chain = result.catch(() => {});
      return result;
    }
  };
}

function textOf(html) {
  return cleanText(String(html).replace(/<[^>]*>/g, " "), 2_000);
}

/**
 * What a resolution's page states (docs/evidence-pipeline.md, Government
 * resolution data rules, Page): its number and adoption date, each file under
 * “Soubory” (its label and the file read: `docx` or `doc`, or for an annex
 * also `xlsx`), and its material's
 * title, reference number (`ova`), and eKLEP identifier (`pid`). A page with
 * no files whose title is a reference number of the Government Office is
 * `classified`.
 */
export function parseResolutionPage(html, { year, number }) {
  const heading = /Usnesení vlády č\.\s*(\d+)\s+ze dne\s*<a[^>]*>\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*<\/a>/u.exec(html);
  invariant(heading, `The page of resolution ${number}/${year} states no number and date`);
  invariant(Number(heading[1]) === Number(number), `The page of resolution ${number}/${year} names resolution ${heading[1]}`);
  // A year's resolutions are adopted in that year (all 695 pages of 17
  // October 2026 agreed).
  invariant(Number(heading[4]) === Number(year), `The page of resolution ${number}/${year} is dated in ${heading[4]}`);
  const adoptedOn = `${heading[4]}-${heading[3].padStart(2, "0")}-${heading[2].padStart(2, "0")}`;
  const rows = [...html.matchAll(/<div class="row odok-row">\s*<label[^>]*>([\s\S]*?)<\/label>\s*<div class="col-12 col-md-8">([\s\S]*?)<\/div>\s*<\/div>/gu)]
    .map(([, label, value]) => ({ label: textOf(label), value }));
  const valueOf = (label) => {
    const row = rows.find((candidate) => candidate.label === label);
    invariant(row, `The page of resolution ${number}/${year} has no “${label}”`);
    return textOf(row.value) || null;
  };
  const files = [];
  for (const { label, value } of rows) {
    if (label !== "Usnesení" && !/^Příloha č\. \d+$/u.test(label)) continue;
    const links = [...value.matchAll(/href="(\/portal\/services\/download\/attachment\/[^"]+\/([a-z]+)\/)"/gu)].map(([, path, format]) => ({ format, url: `${portalOrigin}${path}` }));
    // The file read: the Word file, or else, for an annex (a table), an XLSX
    // workbook; a PDF or an XLS file is never read, and the resolution itself
    // is read only from its Word file.
    const readFormats = label === "Usnesení" ? ["docx", "doc"] : ["docx", "doc", "xlsx"];
    const readable = readFormats.map((format) => links.filter((link) => link.format === format)).find((found) => found.length > 0) ?? [];
    invariant(readable.length <= 1, `The page of resolution ${number}/${year} lists several ${readable[0]?.format} files for “${label}”`);
    files.push({ label, format: readable[0]?.format ?? null, url: readable[0]?.url ?? null, formats: links.map(({ format }) => format) });
  }
  invariant(files.some(({ label }) => label === "Usnesení"), `The page of resolution ${number}/${year} lists no resolution file row`);
  const titleCz = valueOf("Název materiálu");
  const classified = files.every(({ formats }) => formats.length === 0) && /^čj\. [A-Z]\d+\/\d{4}-UVCR$/u.test(titleCz ?? "");
  return {
    year,
    number,
    adoptedOn,
    titleCz,
    ova: valueOf("Čj. OVA"),
    pid: valueOf("PID"),
    classified,
    // An annex is kept even without a file, so the text can name it; an
    // empty row of the resolution itself is a classified page's.
    files: files.filter(({ label, formats }) => formats.length > 0 || label !== "Usnesení")
  };
}

// A number not yet used answers HTTP 500 with the portal's error page.
function isMissingNumberPage({ status, bytes }) {
  return status === 500 && /<title>\s*ODok Portál - chyba\s*<\/title>/u.test(new TextDecoder().decode(bytes));
}

/**
 * The permanent cache of published resolutions, one append-only file per
 * year (`<year>.jsonl`); each line is written as soon as a resolution is read,
 * so a stopped run keeps it.
 */
export function createResolutionCache(directory) {
  const entries = new Map();
  let loaded = false;
  async function load() {
    if (loaded) return;
    loaded = true;
    if (!existsSync(directory)) return;
    for (const name of (await readdir(directory)).filter((file) => /^\d{4}\.jsonl$/u.test(file)).sort()) {
      for (const { value, line } of await readJournal(resolve(directory, name))) {
        invariant(Number.isInteger(value.year) && Number.isInteger(value.number) && Array.isArray(value.files), `Invalid resolution cache ${name} line ${line}`);
        entries.set(`${value.number}/${value.year}`, value);
      }
    }
  }
  return {
    load,
    get: (year, number) => entries.get(`${number}/${year}`) ?? null,
    async put(entry) {
      await mkdir(directory, { recursive: true });
      await appendFile(resolve(directory, `${entry.year}.jsonl`), `${JSON.stringify(entry)}\n`, "utf8");
      entries.set(`${entry.number}/${entry.year}`, entry);
    }
  };
}

async function fileParagraphs(bytes, format) {
  try {
    if (format === "xlsx") return extractXlsxRows(bytes);
    return format === "docx" ? extractDocxParagraphs(bytes) : await extractDocParagraphs(bytes);
  } catch {
    return null;
  }
}

// How many numbers in a row must not be held before a year's resolutions are
// taken to end: the government numbers them of each year without gaps.
const missingInARow = 3;

/**
 * Reads every resolution from `firstResolution` ("1013/2025") to the last
 * one held: from the cache when it is there, otherwise its page and Word
 * files, which are cached at once. A classified resolution, a number not
 * yet held, and a resolution with a file that cannot be read as text are
 * read again in every run. Reading stops with an error once
 * `budgetMs` has passed, so a long first collection continues in the next
 * run.
 */
export async function readResolutions({ fetcher, cache, firstResolution, today, budgetMs = 120 * 60_000, now = Date.now, onResolution = () => {} }) {
  await cache.load();
  const [firstNumber, firstYear] = firstResolution.split("/").map(Number);
  const startedAt = now();
  const resolutions = [];
  const quality = { fromCache: 0, fromPortal: 0, classified: [], gaps: [], unexpectedPages: [], unreadableFiles: [] };
  for (let year = firstYear; year <= Number(today.slice(0, 4)); year += 1) {
    const missing = [];
    for (let number = year === firstYear ? firstNumber : 1; missing.length < missingInARow; number += 1) {
      const cached = cache.get(year, number);
      if (cached) {
        if (missing.length > 0) quality.gaps.push(...missing.map((gap) => `${gap}/${year}`));
        missing.length = 0;
        quality.fromCache += 1;
        resolutions.push(cached);
        continue;
      }
      if (now() - startedAt > budgetMs) {
        throw new Error(`Reading government resolutions stopped after ${Math.round(budgetMs / 60_000)} minutes at ${number}/${year}, with ${quality.fromPortal} read from the portal and cached; run the workflow again to continue`);
      }
      const page = await fetcher.get(resolutionPageUrl(year, number), { purpose: "resolution page" });
      if (isMissingNumberPage(page)) {
        missing.push(number);
        continue;
      }
      invariant(page.status === 200, `The page of resolution ${number}/${year} answered HTTP ${page.status}`);
      if (missing.length > 0) quality.gaps.push(...missing.map((gap) => `${gap}/${year}`));
      missing.length = 0;
      const parsed = parseResolutionPage(new TextDecoder("utf-8").decode(page.bytes), { year, number });
      if (parsed.classified) {
        quality.classified.push(`${number}/${year}`);
        onResolution({ resolution: `${number}/${year}`, outcome: "classified" });
        continue;
      }
      if (!parsed.files.some(({ label, url }) => label === "Usnesení" && url)) {
        quality.unexpectedPages.push(`${number}/${year}`);
        onResolution({ resolution: `${number}/${year}`, outcome: "no Word file of the resolution" });
        continue;
      }
      const files = [];
      for (const file of parsed.files) {
        if (!file.url) {
          files.push({ ...file, sha256: null, paragraphs: null });
          continue;
        }
        const answer = await fetcher.get(file.url, { purpose: `resolution ${file.label}` });
        invariant(answer.status === 200, `${file.url} answered HTTP ${answer.status}`);
        files.push({ ...file, sha256: sha256(answer.bytes), paragraphs: await fileParagraphs(answer.bytes, file.format) });
      }
      // A file that cannot be read as text is not cached, so a later
      // run, perhaps with a better reader, tries it again.
      const unreadable = files.filter(({ url, paragraphs }) => url && paragraphs === null);
      if (unreadable.length > 0) {
        quality.unreadableFiles.push(...unreadable.map(({ label }) => `${number}/${year} (${label})`));
        onResolution({ resolution: `${number}/${year}`, outcome: "a file cannot be read as text" });
        continue;
      }
      const entry = { year, number, readAt: new Date(now()).toISOString(), adoptedOn: parsed.adoptedOn, titleCz: parsed.titleCz, ova: parsed.ova, pid: parsed.pid, files };
      // A resolution with an annex in no format that is read (a PDF or XLS
      // file, or none) is read again in every run, so it is used once a
      // readable file appears (resolutionRecords holds it back until then).
      if (isWhollyRead(entry)) await cache.put(entry);
      quality.fromPortal += 1;
      resolutions.push(entry);
      onResolution({ resolution: `${number}/${year}`, outcome: "read" });
    }
  }
  return { resolutions, quality };
}

// The eKLEP material types whose resolution another row of the conduct table
// records: a draft government regulation, a draft bill (a government
// proposal), and a bill of members, the Senate, or a regional assembly (a
// government opinion).
const duplicateEklepTypes = { NNV: "regulation", NZ: "government-bill", PNZ: "government-opinion", SNZ: "government-opinion", NKZ: "government-opinion" };
// Print kinds a government proposal has (tisky.zip druh_tisku.unl): a
// government bill, the state budget, and an international treaty; and the
// sub-print kind of a government opinion.
const proposalPrintKinds = { 1: "government-bill", 3: "state-budget", 4: "treaty" };
const governmentOpinionSubPrintKind = "7";

/**
 * The eKLEP type of each material (`requests[].pid`, `requests[].type.id`)
 * in the official open data of each year from `fromYear` to the current one
 * (schema material_schema_v2.json), read in every run because it changes.
 * The current year's file can be missing early in a year (requests_2027.json
 * answered HTTP 404 on 18 October 2026); it is then named in
 * `notYetPublished`.
 */
export async function readEklepTypes({ fetcher, fromYear, today }) {
  const types = new Map();
  const notYetPublished = [];
  const currentYear = Number(today.slice(0, 4));
  for (let year = fromYear; year <= currentYear; year += 1) {
    const answer = await fetcher.get(eklepRequestsUrl(year), { purpose: "eKLEP open data" });
    if (year === currentYear && answer.status === 404) {
      notYetPublished.push(year);
      continue;
    }
    invariant(answer.status === 200, `The eKLEP open data of ${year} answered HTTP ${answer.status}`);
    const data = JSON.parse(new TextDecoder("utf-8").decode(answer.bytes));
    invariant(Array.isArray(data?.requests), `The eKLEP open data of ${year} has no requests`);
    for (const request of data.requests) {
      invariant(typeof request?.pid === "string" && typeof request?.type?.id === "string", `The eKLEP open data of ${year} has a material without a PID or type`);
      types.set(request.pid, request.type.id);
    }
  }
  return { types, notYetPublished };
}

/**
 * Why a resolution only approves what another row of the conduct table
 * records, or null: its material's PID is linked by the Chamber to a
 * government proposal or a government opinion (`eklepLinks`, the links of
 * tisk_eklep.unl and tz_eklep.unl by PID), or eKLEP names its type as a
 * draft regulation or bill.
 */
export function duplicateOf(pid, { eklepLinks, eklepTypes }) {
  if (!pid) return null;
  for (const link of eklepLinks.get(pid) ?? []) {
    if (link.kind === "print" && proposalPrintKinds[link.printKindId]) return proposalPrintKinds[link.printKindId];
    if (link.kind === "sub-print" && link.printKindId === governmentOpinionSubPrintKind) return "government-opinion";
  }
  return duplicateEklepTypes[eklepTypes.get(pid)] ?? null;
}

/**
 * The text of a resolution: the resolution, then each annex after its label.
 * Only a resolution whose every file was read has one (resolutionRecords).
 */
export function resolutionParagraphs(entry) {
  return entry.files.flatMap(({ label, paragraphs }) => (label === "Usnesení" ? paragraphs : [label, ...paragraphs]));
}

/** Whether every file of a resolution, its annexes included, was read. */
export function isWhollyRead(entry) {
  return entry.files.every(({ paragraphs }) => Array.isArray(paragraphs));
}

/**
 * The records of the resolutions read: those that are not duplicates of
 * other conduct and were adopted while a tracked government governed; with
 * the run's quality figures. A resolution adopted in a year whose eKLEP open
 * data is not yet published (`eklepYearsMissing`) is held back, because
 * whether it only approves a draft regulation or bill is not yet known. So
 * is one with an annex published only in a format that is not read (a PDF or
 * an XLS file), because what it approves may be in that annex.
 */
export function resolutionRecords({ resolutions, eklepLinks, eklepTypes, eklepYearsMissing = [], governmentPeriods, source }) {
  const quality = { duplicates: {}, heldWithoutEklep: 0, heldUnreadAnnex: [], beforeGovernment: 0, used: 0 };
  const records = [];
  const linksByPid = Map.groupBy(eklepLinks, ({ pid }) => pid);
  for (const entry of resolutions) {
    if (eklepYearsMissing.includes(Number(entry.adoptedOn.slice(0, 4)))) {
      quality.heldWithoutEklep += 1;
      continue;
    }
    const duplicate = duplicateOf(entry.pid, { eklepLinks: linksByPid, eklepTypes });
    if (duplicate) {
      quality.duplicates[duplicate] = (quality.duplicates[duplicate] ?? 0) + 1;
      continue;
    }
    const partyIds = governmentPartiesOn(governmentPeriods, entry.adoptedOn);
    if (partyIds.length === 0) {
      quality.beforeGovernment += 1;
      continue;
    }
    if (!isWhollyRead(entry)) {
      quality.heldUnreadAnnex.push(`${entry.number}/${entry.year}`);
      continue;
    }
    quality.used += 1;
    records.push(resolutionRecord({ entry, partyIds, paragraphs: resolutionParagraphs(entry), source }));
  }
  return { records, quality };
}

function resolutionRecord({ entry, partyIds, paragraphs, source }) {
  const numberCz = resolutionNumberCz(entry.year, entry.number);
  return createCollectedRecord({
    id: `${resolutionSourceId}--${entry.year}-${entry.number}`,
    sourceId: source.id,
    kind: resolutionKind,
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: `${entry.adoptedOn}T00:00:00`,
    timeZone: "Europe/Prague",
    title: `${numberCz}${entry.titleCz ? `: ${entry.titleCz}` : ""}`,
    publisher: "Government Office of the Czech Republic (zVlády)",
    url: resolutionPageUrl(entry.year, entry.number),
    payload: {
      externalPrintId: resolutionPrintId(entry.year, entry.number),
      resolution: `${entry.number}/${entry.year}`,
      numberCz,
      titleCz: entry.titleCz,
      adoptedOn: entry.adoptedOn,
      ova: entry.ova,
      pid: entry.pid,
      files: entry.files.map(({ label, format, formats, url, sha256: hash }) => ({ label, format, formats, url, sha256: hash })),
      proposal: { kind: resolutionKind, proposerPartyIds: partyIds },
      paragraphs
    }
  });
}
