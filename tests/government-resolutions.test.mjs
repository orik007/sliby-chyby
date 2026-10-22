import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { attributionStatusForRecord, isPotentiallyAttributable, versionConcerned } from "../scripts/lib/attribution.mjs";
import { lawChangeOfResolution } from "../scripts/lib/print-parts.mjs";
import { lawChangeText } from "../scripts/lib/law-change-screening.mjs";
import { GovernmentOfficeBlockedError, createGovernmentOfficeFetcher, createResolutionCache, duplicateOf, parseResolutionPage, readEklepTypes, readResolutions, resolutionParagraphs, resolutionRecords } from "../scripts/lib/government-resolutions.mjs";
import { extractXlsxRows } from "../scripts/lib/xlsx-rows.mjs";

// The bodies of five real zVlády pages (read on 17 October 2026): 1013/2025,
// the current government's first, with an annex; 1017/2025, with a DOC file;
// 17/2026, whose annex is published only as XLSX; 64/2026, classified; and
// 158/2026. And the error page of a number not yet used.
const page = (name) => readFile(new URL(`./fixtures/government-resolutions/${name}.html`, import.meta.url), "utf8");
const governmentPeriods = JSON.parse(await readFile(new URL("../automation/attribution/government-periods.json", import.meta.url), "utf8"));
const source = { id: "zvlady-resolutions" };

// A minimal DOCX with these paragraphs.
function docx(paragraphs) {
  const body = paragraphs.map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`).join("");
  return zipSync({ "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`) });
}

test("a resolution's page states its date, files, and material; a classified one has no files", async () => {
  assert.deepEqual(parseResolutionPage(await page("2025-1013"), { year: 2025, number: 1013 }), {
    year: 2025,
    number: 1013,
    adoptedOn: "2025-12-15",
    titleCz: "Návrh na jmenování ministra pro sport, prevenci a zdraví",
    ova: null,
    pid: null,
    classified: false,
    files: [
      { label: "Usnesení", format: "docx", url: "https://odok.gov.cz/portal/services/download/attachment/2025/1013/docx/", formats: ["docx", "pdf"] },
      { label: "Příloha č. 1", format: "docx", url: "https://odok.gov.cz/portal/services/download/attachment/2025/1013/1/docx/", formats: ["docx", "pdf"] }
    ]
  });
  const doc = parseResolutionPage(await page("2025-1017"), { year: 2025, number: 1017 });
  assert.deepEqual([doc.adoptedOn, doc.ova, doc.pid, doc.files[0].format], ["2025-12-16", "1083/25", "ALBSDPEG2HYX", "doc"]);
  // An annex published only as a spreadsheet is read from its XLSX file.
  assert.deepEqual(parseResolutionPage(await page("2026-17"), { year: 2026, number: 17 }).files[1], { label: "Příloha č. 1", format: "xlsx", url: "https://odok.gov.cz/portal/services/download/attachment/2026/17/1/xlsx/", formats: ["xlsx"] });
  const classified = parseResolutionPage(await page("2026-64"), { year: 2026, number: 64 });
  assert.deepEqual([classified.classified, classified.titleCz, classified.files], [true, "čj. V14/2026-UVCR", []]);
  // An annex listed without any file is kept, so its absence can be named.
  const emptyAnnex = (await page("2026-17")).replace(/href="\/portal\/services\/download\/attachment\/2026\/17\/1\/xlsx\/"[^>]*>XLSX<\/a>/u, "");
  assert.deepEqual(parseResolutionPage(emptyAnnex, { year: 2026, number: 17 }).files[1], { label: "Příloha č. 1", format: null, url: null, formats: [] });
  // The resolution itself is read only from a Word file, never a workbook.
  const workbookOnly = (await page("2026-17")).replace(/attachment\/2026\/17\/docx\//gu, "attachment/2026/17/xlsx/");
  assert.deepEqual(parseResolutionPage(workbookOnly, { year: 2026, number: 17 }).files[0], { label: "Usnesení", format: null, url: null, formats: ["xlsx", "pdf"] });
  const html = await page("2026-158");
  assert.throws(() => parseResolutionPage(html, { year: 2026, number: 159 }), /names resolution 158/);
  assert.throws(() => parseResolutionPage(html, { year: 2025, number: 158 }), /is dated in 2026/);
});

test("requests take turns at least 6 s apart, a lost connection is retried, and a firewall block stops at once", async () => {
  let clock = 0;
  const waits = [];
  const sleep = async (ms) => { waits.push(ms); clock += ms; };
  // The firewall's answer to a client that does not say who it is, as seen
  // on 17 October 2026 (HTTP 200, 323 bytes).
  const block = "<html><head><title>Požadavek byl zablokován</title></head><body>Požadovaná URL byla zablokována. Obraťte se na správce systému.<br><br>Na adresu <b>administrator@vlada.cz</b> pošlete zprávu, kam zkopírujete ID zablokovaného požadavku.<br><br>ID zablokovaného požadavku je: <5079556984121549320></body></html>";
  assert.equal(new TextEncoder().encode(block).byteLength, 323);
  const answers = [new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }), new Response("x".repeat(323), { status: 200 }), new Response(block, { status: 200 })];
  const log = [];
  const fetcher = createGovernmentOfficeFetcher({
    now: () => clock,
    sleep,
    onRequest: (entry) => log.push(entry),
    fetchImpl: async () => {
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return next;
    }
  });
  // Another answer of 323 bytes is no block.
  const answer = await fetcher.get("https://odok.gov.cz/portal/zvlady/usneseni/2026/1/", { purpose: "resolution page" });
  assert.equal(answer.status, 200);
  // The retry waits 1 s and then the rest of the 6 s since the last request.
  assert.deepEqual(waits, [1_000, 5_000]);
  assert.deepEqual(log.map(({ attempt, error, status }) => [attempt, error ?? status]), [[0, "ECONNRESET"], [1, 200]]);
  await assert.rejects(fetcher.get("https://odok.gov.cz/portal/zvlady/usneseni/2026/2/", { purpose: "resolution page" }), GovernmentOfficeBlockedError);
  assert.equal(fetcher.stats.retried, 1);
});

test("a request redirected away from the Government Office fails, and a lost connection fails after its last retry", async () => {
  // A stand-in answer carries the address it was redirected to.
  const moved = createGovernmentOfficeFetcher({ sleep: async () => {}, minIntervalMs: 0, fetchImpl: async () => ({ status: 200, url: "https://example.com/", arrayBuffer: async () => new ArrayBuffer(0) }) });
  await assert.rejects(moved.get("https://odok.gov.cz/", { purpose: "test" }), /outside its hosts/);
  let attempts = 0;
  const failing = createGovernmentOfficeFetcher({ sleep: async () => {}, minIntervalMs: 0, retryDelaysMs: [1, 1], fetchImpl: async () => { attempts += 1; return new Response("", { status: 503 }); } });
  await assert.rejects(failing.get("https://odok.gov.cz/", { purpose: "test" }), /failed after 3 attempts: HTTP 503/);
  assert.equal(attempts, 3);
  // An answer larger than the limit stops as soon as it passes it, without
  // a retry.
  const log = [];
  let pulled = 0;
  const endless = new ReadableStream({ pull: (controller) => { pulled += 1; controller.enqueue(new Uint8Array(1_000)); } });
  const large = createGovernmentOfficeFetcher({ sleep: async () => {}, minIntervalMs: 0, maxBytes: 2_500, onRequest: (entry) => log.push(entry), fetchImpl: async () => new Response(endless, { status: 200 }) });
  await assert.rejects(large.get("https://odok.gov.cz/", { purpose: "test" }), /larger than 2500 bytes/);
  assert.ok(pulled <= 5);
  assert.deepEqual(log.map(({ error }) => error), ["too-large"]);
});

// A portal with these pages and Word files; every other number answers the
// error page with HTTP 500, or with `rejected` the firewall's rejection page
// with HTTP 200, as it has since 22 October 2026.
async function portal(pages, files = {}, { rejected = false, rejectAll = false } = {}) {
  const missing = await page("missing");
  const rejection = await page("rejected");
  const requests = [];
  return {
    requests,
    fetcher: createGovernmentOfficeFetcher({
      minIntervalMs: 0,
      sleep: async () => {},
      fetchImpl: async (url) => {
        requests.push(url);
        const [, year, number] = /usneseni\/(\d+)\/(\d+)\/$/.exec(url) ?? [];
        if (year && rejectAll) return new Response(rejection, { status: 200 });
        if (year) return pages[`${year}-${number}`] ? new Response(pages[`${year}-${number}`], { status: 200 }) : rejected ? new Response(rejection, { status: 200 }) : new Response(missing, { status: 500 });
        if (files[url]) return new Response(files[url], { status: 200 });
        throw new Error(`unexpected request ${url}`);
      }
    })
  };
}

test("resolutions are read until three numbers in a row are not held, cached at once, and never requested again", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await page("2026-158");
  const pages = { "2026-1": first.replaceAll("č. 158", "č. 1"), "2026-2": (await page("2026-64")).replaceAll("č. 64", "č. 2"), "2026-4": first.replaceAll("č. 158", "č. 4").replaceAll("/158/", "/4/") };
  const files = {
    "https://odok.gov.cz/portal/services/download/attachment/2026/158/docx/": docx(["USNESENÍ", "Vláda", "souhlasí s účastí České republiky"]),
    "https://odok.gov.cz/portal/services/download/attachment/2026/4/docx/": docx(["USNESENÍ", "Vláda", "schvaluje"])
  };
  const { fetcher, requests } = await portal(pages, files);
  const read = await readResolutions({ fetcher, cache: createResolutionCache(directory), firstResolution: "1/2026", today: "2026-10-17" });
  assert.deepEqual(read.resolutions.map(({ number }) => number), [1, 4]);
  assert.deepEqual(read.quality.classified, ["2/2026"]);
  // 3/2026 lies between two held resolutions.
  assert.deepEqual(read.quality.gaps, ["3/2026"]);
  assert.deepEqual(read.resolutions[0].files[0].paragraphs, ["USNESENÍ", "Vláda", "souhlasí s účastí České republiky"]);
  assert.equal(read.quality.fromPortal, 2);
  // 1, its file, 2, 3, 4, its file, and 5 to 7.
  assert.equal(requests.length, 9);
  const again = await portal(pages, files);
  const second = await readResolutions({ fetcher: again.fetcher, cache: createResolutionCache(directory), firstResolution: "1/2026", today: "2026-10-17" });
  assert.equal(second.quality.fromCache, 2);
  // Only the classified resolution, the gap, and the numbers after the last.
  assert.deepEqual(again.requests.map((url) => url.replace("https://odok.gov.cz/portal/zvlady/usneseni/2026/", "")), ["2/", "3/", "5/", "6/", "7/"]);
  assert.deepEqual(second.resolutions, read.resolutions);
});

test("the firewall's rejection page is a number not held, once a held page shows the portal still serves pages", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pages = { "2026-158": await page("2026-158") };
  const files = { "https://odok.gov.cz/portal/services/download/attachment/2026/158/docx/": docx(["USNESENÍ", "Vláda", "souhlasí"]) };
  const { fetcher, requests } = await portal(pages, files, { rejected: true });
  const read = await readResolutions({ fetcher, cache: createResolutionCache(directory), firstResolution: "158/2026", today: "2026-10-22" });
  assert.deepEqual(read.resolutions.map(({ number }) => number), [158]);
  assert.deepEqual(read.quality.rejected, ["159/2026", "160/2026", "161/2026"]);
  // 158, its file, 159, the check of 158, then 160 and 161.
  assert.deepEqual(requests.map((url) => url.replace("https://odok.gov.cz/portal/", "")), ["zvlady/usneseni/2026/158/", "services/download/attachment/2026/158/docx/", "zvlady/usneseni/2026/159/", "zvlady/usneseni/2026/158/", "zvlady/usneseni/2026/160/", "zvlady/usneseni/2026/161/"]);
  // When the held page is rejected too, the run fails.
  const blocked = await portal(pages, files, { rejectAll: true });
  await assert.rejects(readResolutions({ fetcher: blocked.fetcher, cache: createResolutionCache(directory), firstResolution: "158/2026", today: "2026-10-22" }), /firewall rejects the run: the page of resolution 158\/2026, which is held, was rejected too/);
});

test("a file the firewall rejects stops the run instead of counting as unreadable", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = { "https://odok.gov.cz/portal/services/download/attachment/2026/158/docx/": new TextEncoder().encode(await page("rejected")) };
  const { fetcher } = await portal({ "2026-158": await page("2026-158") }, files);
  await assert.rejects(readResolutions({ fetcher, cache: createResolutionCache(directory), firstResolution: "158/2026", today: "2026-10-22" }), /attachment\/2026\/158\/docx\/ was rejected by the Government Office's firewall/);
});

test("every run of rejected numbers is checked: a gap between held pages and the end of each year", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const held = (number, year) => page("2026-158").then((html) => html.replaceAll("č. 158", `č. ${number}`).replaceAll("/2026/158/", `/${year}/${number}/`).replace(/ze dne\s*(<a[^>]*>)\s*[\d. ]+2026/u, `ze dne $1 1. 1. ${year}`));
  const pages = { "2025-1": await held(1, 2025), "2025-3": await held(3, 2025), "2026-1": await held(1, 2026) };
  const files = Object.fromEntries(Object.keys(pages).map((key) => [`https://odok.gov.cz/portal/services/download/attachment/${key.replace("-", "/")}/docx/`, docx(["USNESENÍ", "Vláda", "schvaluje"])]));
  const { fetcher, requests } = await portal(pages, files, { rejected: true });
  const read = await readResolutions({ fetcher, cache: createResolutionCache(directory), firstResolution: "1/2025", today: "2026-10-22" });
  assert.deepEqual(read.resolutions.map(({ year, number }) => `${number}/${year}`), ["1/2025", "3/2025", "1/2026"]);
  assert.deepEqual(read.quality.gaps, ["2/2025"]);
  // The gap, the end of 2025, and the end of 2026 are each checked.
  const checks = requests.filter((url, index) => /usneseni/.test(url) && requests.indexOf(url) < index);
  assert.deepEqual(checks.map((url) => url.replace("https://odok.gov.cz/portal/zvlady/usneseni/", "")), ["2025/1/", "2025/3/", "2026/1/"]);
});

test("a rejection after the portal's error page in the same run of numbers is still checked", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const [html, missing, rejection] = await Promise.all([page("2026-158"), page("missing"), page("rejected")]);
  const requests = [];
  const fetcher = createGovernmentOfficeFetcher({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.endsWith("/docx/")) return new Response(docx(["USNESENÍ", "Vláda", "souhlasí"]), { status: 200 });
      if (url.endsWith("/2026/158/")) return new Response(html, { status: 200 });
      return url.endsWith("/2026/159/") ? new Response(missing, { status: 500 }) : new Response(rejection, { status: 200 });
    }
  });
  const read = await readResolutions({ fetcher, cache: createResolutionCache(directory), firstResolution: "158/2026", today: "2026-10-22" });
  assert.deepEqual(read.quality.rejected, ["160/2026", "161/2026"]);
  assert.deepEqual(requests.filter((url) => url.endsWith("/2026/158/")).length, 2);
});

test("a held page that answers another status when it is read to check the portal names that status", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const html = await page("2026-158");
  let served = 0;
  const fetcher = createGovernmentOfficeFetcher({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.endsWith("/docx/")) return new Response(docx(["USNESENÍ", "Vláda", "souhlasí"]), { status: 200 });
      if (url.endsWith("/2026/158/")) return (served += 1) === 1 ? new Response(html, { status: 200 }) : new Response("Not found", { status: 404 });
      return new Response(await page("rejected"), { status: 200 });
    }
  });
  await assert.rejects(readResolutions({ fetcher, cache: createResolutionCache(directory), firstResolution: "158/2026", today: "2026-10-22" }), /resolution 158\/2026, read to check the portal, answered HTTP 404/);
});

test("a resolution whose Word file cannot be read as text is reported and read again in the next run", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pages = { "2026-158": await page("2026-158") };
  const files = { "https://odok.gov.cz/portal/services/download/attachment/2026/158/docx/": new TextEncoder().encode("not a DOCX") };
  const first = await portal(pages, files);
  const read = await readResolutions({ fetcher: first.fetcher, cache: createResolutionCache(directory), firstResolution: "158/2026", today: "2026-10-17" });
  assert.deepEqual([read.resolutions, read.quality.unreadableFiles], [[], ["158/2026 (Usnesení)"]]);
  const again = await portal(pages, files);
  await readResolutions({ fetcher: again.fetcher, cache: createResolutionCache(directory), firstResolution: "158/2026", today: "2026-10-17" });
  assert.ok(again.requests.includes("https://odok.gov.cz/portal/services/download/attachment/2026/158/docx/"));
});

test("a resolution with an annex in no format that is read is returned but not cached, so a later run reads it again", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pdfAnnex = (await page("2026-17")).replace("/2026/17/1/xlsx/", "/2026/17/1/pdf/").replace(">XLSX<", ">PDF<");
  const files = { "https://odok.gov.cz/portal/services/download/attachment/2026/17/docx/": docx(["USNESENÍ", "Vláda", "souhlasí s převodem"]) };
  const first = await portal({ "2026-17": pdfAnnex }, files);
  const read = await readResolutions({ fetcher: first.fetcher, cache: createResolutionCache(directory), firstResolution: "17/2026", today: "2026-10-17" });
  assert.deepEqual(read.resolutions.map(({ number, files: entryFiles }) => [number, entryFiles[1].formats, entryFiles[1].paragraphs]), [[17, ["pdf"], null]]);
  const again = await portal({ "2026-17": pdfAnnex }, files);
  const second = await readResolutions({ fetcher: again.fetcher, cache: createResolutionCache(directory), firstResolution: "17/2026", today: "2026-10-17" });
  assert.equal(second.quality.fromCache, 0);
  assert.ok(again.requests.includes("https://odok.gov.cz/portal/zvlady/usneseni/2026/17/"));
});

test("reading stops with an error once its time is up, keeping what it cached", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "resolutions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let clock = 0;
  const { fetcher } = await portal({ "2026-1": (await page("2026-64")).replaceAll("č. 64", "č. 1") });
  await assert.rejects(readResolutions({ fetcher, cache: createResolutionCache(directory), firstResolution: "1/2026", today: "2026-10-17", budgetMs: 10, now: () => (clock += 6) }), /stopped after 0 minutes at 2\/2026.*run the workflow again/);
});

test("the eKLEP open data gives each material's type, the current year's file may be missing, and a malformed file fails", async () => {
  const data = (requests) => new TextEncoder().encode(JSON.stringify({ requests }));
  const answers = { "https://www.odok.gov.cz/opendata/dataset/odok/requests_2025.json": data([{ pid: "KORNDPDDEYDL", type: { id: "PNZ", name: "Návrh zákona předložený PS" } }]), "https://www.odok.gov.cz/opendata/dataset/odok/requests_2026.json": data([{ pid: "KORNDQ2CQRQP", type: { id: "NNV", name: "Návrh nařízení vlády" } }]) };
  // A year's file not yet published answers HTTP 404, as requests_2027.json
  // did on 18 October 2026.
  const fetcher = createGovernmentOfficeFetcher({ minIntervalMs: 0, sleep: async () => {}, fetchImpl: async (url) => new Response(answers[url] ?? "{}", { status: answers[url] ? 200 : 404 }) });
  const read = await readEklepTypes({ fetcher, fromYear: 2025, today: "2026-10-17" });
  assert.deepEqual([[...read.types], read.notYetPublished], [[["KORNDPDDEYDL", "PNZ"], ["KORNDQ2CQRQP", "NNV"]], []]);
  assert.deepEqual((await readEklepTypes({ fetcher, fromYear: 2026, today: "2027-01-01" })).notYetPublished, [2027]);
  await assert.rejects(readEklepTypes({ fetcher, fromYear: 2024, today: "2026-10-17" }), /The eKLEP open data of 2024 answered HTTP 404/);
  answers["https://www.odok.gov.cz/opendata/dataset/odok/requests_2026.json"] = data([{ pid: "X" }]);
  await assert.rejects(readEklepTypes({ fetcher, fromYear: 2026, today: "2026-10-17" }), /without a PID or type/);
});

test("a resolution that only approves a government proposal, opinion, or regulation is a duplicate", () => {
  const eklepLinks = [
    { pid: "KORNDS2HT779", kind: "print", printKindId: "1" },
    { pid: "TREATY", kind: "print", printKindId: "4" },
    { pid: "FUND", kind: "print", printKindId: "5" },
    { pid: "KORNDPDDEYDL", kind: "sub-print", printKindId: "7" },
    { pid: "SENATE", kind: "sub-print", printKindId: "11" }
  ];
  const eklepTypes = new Map([["NNV1", "NNV"], ["NZ1", "NZ"], ["SNZ1", "SNZ"], ["NV1", "NV"]]);
  const of = (pid) => duplicateOf(pid, { eklepLinks: Map.groupBy(eklepLinks, ({ pid: linked }) => linked), eklepTypes });
  assert.deepEqual(["KORNDS2HT779", "TREATY", "KORNDPDDEYDL", "NNV1", "NZ1", "SNZ1"].map(of), ["government-bill", "treaty", "government-opinion", "regulation", "government-bill", "government-opinion"]);
  // A state fund's budget and a Senate resolution are not conduct; a decree
  // is not the government's; a material without a PID is no duplicate.
  assert.deepEqual(["FUND", "SENATE", "NV1", null, "OTHER"].map(of), [null, null, null, null, null]);
});

const entry = (overrides = {}) => ({
  year: 2026,
  number: 17,
  readAt: "2026-10-17T15:00:00.000Z",
  adoptedOn: "2026-01-12",
  titleCz: "Žádost o souhlas vlády s převodem nepotřebného majetku",
  ova: "1099/25",
  pid: "KORNDLZCWVE9",
  files: [
    { label: "Usnesení", format: "docx", formats: ["docx", "pdf"], url: "https://odok.gov.cz/portal/services/download/attachment/2026/17/docx/", sha256: "a".repeat(64), paragraphs: ["Vláda", "souhlasí s převodem"] },
    { label: "Příloha č. 1", format: "xlsx", formats: ["xlsx"], url: "https://odok.gov.cz/portal/services/download/attachment/2026/17/1/xlsx/", sha256: "b".repeat(64), paragraphs: ["Poř. | číslo | katastrální území", "1 | S006376/24 | Božetice"] }
  ],
  ...overrides
});

test("the text has every annex after its label; a resolution with an annex that is not read is held back", () => {
  assert.deepEqual(resolutionParagraphs(entry()), ["Vláda", "souhlasí s převodem", "Příloha č. 1", "Poř. | číslo | katastrální území", "1 | S006376/24 | Božetice"]);
  // 179/2026: its annex 1, a committee's statute, is published only as a PDF.
  const pdfOnly = entry({ number: 179, files: [entry().files[0], { label: "Příloha č. 1", format: null, formats: ["pdf"], url: null, sha256: null, paragraphs: null }] });
  const { records, quality } = resolutionRecords({ resolutions: [entry(), pdfOnly, entry({ number: 1012, year: 2025, adoptedOn: "2025-12-10" }), entry({ number: 330, pid: "NZ1" })], eklepLinks: [], eklepTypes: new Map([["NZ1", "NZ"]]), governmentPeriods, source });
  assert.deepEqual(quality, { duplicates: { "government-bill": 1 }, heldWithoutEklep: 0, heldUnreadAnnex: ["179/2026"], beforeGovernment: 1, used: 1 });
  assert.equal(records.length, 1);
  // Without the eKLEP open data of 2026, its resolutions wait.
  assert.deepEqual(resolutionRecords({ resolutions: [entry()], eklepLinks: [], eklepTypes: new Map(), eklepYearsMissing: [2026], governmentPeriods, source }).quality, { duplicates: {}, heldWithoutEklep: 1, heldUnreadAnnex: [], beforeGovernment: 0, used: 0 });
});

test("an XLSX annex is read row by row, as the workbook stores its cells", async () => {
  // The real annex of 207/2026 (land for the Cheb business park), as zVlády
  // published it on 17 October 2026.
  const rows = extractXlsxRows(await readFile(new URL("./fixtures/government-resolutions/2026-207-annex-1.xlsx", import.meta.url)));
  // The heading stands in the last column, so it keeps the empty positions
  // before it.
  assert.deepEqual(rows.slice(0, 5), [
    " |  |  |  |  |  | Příloha",
    " |  |  |  |  |  | usnesení vlády",
    " |  |  |  |  |  | ze dne 30. března 2026 č. 207",
    "číslo pozemku | katastrální území | vlastnické právo | příslušnost hospodařit | druh pozemku | výměra (m2) | důvod akvizice pozemku",
    "417/30 | Dřenice u Chebu | Česká republika | Státní pozemkový úřad | orná půda | 3148 | umístění zeleného izolačního pásu"
  ]);
  // A date-formatted number is its date, a time-formatted one its time of
  // day (also when it holds a date), an elapsed time ([h]) its hours, a
  // number loses its floating-point noise, a formula gives its value, an
  // empty cell keeps its position, and several sheets are named.
  const sheet = (cells) => `<worksheet><sheetData><row r="1">${cells}</row></sheetData></worksheet>`;
  const workbook = zipSync({
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Lety" sheetId="1" r:id="rId1"/><sheet name="Dary" sheetId="2" r:id="rId2"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8("<sst><si><t>Brusel &amp; Mnichov</t></si></sst>"),
    "xl/styles.xml": strToU8('<styleSheet><numFmts><numFmt numFmtId="164" formatCode="d\\.m\\.yyyy"/><numFmt numFmtId="165" formatCode="h:mm"/><numFmt numFmtId="166" formatCode="[h]:mm"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="20"/><xf numFmtId="165"/><xf numFmtId="22"/><xf numFmtId="166"/></cellXfs></styleSheet>'),
    "xl/worksheets/sheet1.xml": strToU8(sheet('<c r="A1" t="s"><v>0</v></c><c r="B1" s="1"><v>45706</v></c><c r="C1" s="2"><v>45706</v></c><c r="D1" s="3"><v>0.5</v></c><c r="E1" s="4"><v>0.75</v></c><c r="F1" s="5"><v>45706.5</v></c><c r="G1" s="4"><v>45706.5</v></c><c r="H1" s="6"><v>1.5</v></c>')),
    "xl/worksheets/sheet2.xml": strToU8(sheet('<c r="B1"><v>3448599.9999999991</v></c><c r="C1"/><c r="D1"><f>B1*2</f><v>6897200</v></c><c r="F1" t="inlineStr"><is><t>dar</t></is></c>'))
  });
  // An archive that would expand past the limit fails before it is
  // decompressed.
  const bomb = zipSync({ "xl/workbook.xml": new Uint8Array(41_000_000) }, { level: 9 });
  assert.ok(bomb.byteLength < 100_000);
  assert.throws(() => extractXlsxRows(bomb), /exceeds the uncompressed size limit/);
  assert.deepEqual(extractXlsxRows(workbook), ["List: Lety", "Brusel & Mnichov | 2025-02-18 | 2025-02-18 | 12:00:00 | 18:00:00 | 2025-02-18 12:00:00 | 12:00:00 | 36:00:00", "List: Dary", "3448600 |  | 6897200 |  | dar"]);
});

test("a resolution is conduct of every governing party on its adoption day, and one law change with one version", () => {
  const [record] = resolutionRecords({ resolutions: [entry()], eklepLinks: [], eklepTypes: new Map(), governmentPeriods, source }).records;
  assert.equal(record.id, "zvlady-resolutions--2026-17");
  assert.equal(record.kind, "government-resolution");
  assert.equal(record.url, "https://odok.gov.cz/portal/zvlady/usneseni/2026/17/");
  assert.equal(record.occurredAt, "2026-01-12T00:00:00");
  assert.deepEqual(record.payload.proposal, { kind: "government-resolution", proposerPartyIds: ["ano", "motoriste", "spd"] });
  assert.deepEqual(record.payload.files.map(({ label, format }) => [label, format]), [["Usnesení", "docx"], ["Příloha č. 1", "xlsx"]]);
  assert.equal(attributionStatusForRecord(record, { partyId: "spd" }).attributionStatus, "verified-government-resolution");
  assert.equal(isPotentiallyAttributable(record, ["ano"]), true);
  assert.equal(versionConcerned(record, "uv-2026-17").version, "adopted");
  const change = lawChangeOfResolution(record.payload, record.url);
  assert.deepEqual([change.changeId, change.printNumber, Object.keys(change.versions), change.identifiers], ["uv-2026-17", "Usnesení vlády č. 17/2026", ["adopted"], []]);
  assert.match(lawChangeText(change), /^Government resolution \(usnesení vlády\) adopted by the government: Usnesení vlády č\. 17\/2026, Žádost o souhlas vlády s převodem nepotřebného majetku\n\nVersion: text as adopted\nVláda\nsouhlasí s převodem\nPříloha č\. 1\nPoř\. \| číslo \| katastrální území\n1 \| S006376\/24 \| Božetice$/);
});
