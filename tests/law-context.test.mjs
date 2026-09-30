import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createESbirkaClient, createLawContextCache, createLawContextReader, eSbirkaRequestSettings, ESbirkaUnavailableError, plainText } from "../scripts/lib/e-sbirka.mjs";
import { citationOfPath, contextStatusCounts, contextText, locateTarget, resolveLawChangeContext, withContext, wordingOn } from "../scripts/lib/law-context.mjs";
import { lawChangeText } from "../scripts/lib/law-change-screening.mjs";

// A clock and sleep that only move when the client waits, so pacing and
// retries are checked without real time passing.
function fakeTime() {
  let time = 0;
  const sleeps = [];
  return { now: () => time, sleep: async (ms) => { sleeps.push(ms); time += ms; }, advance: (ms) => { time += ms; }, sleeps };
}

const answer = (body, { status = 200 } = {}) => ({ ok: status === 200, status, text: async () => body });
const notFound = () => answer(JSON.stringify({ chyby: [{ kod: "DOKUMENT_NENALEZEN", popis: "Dokument nenalezen" }] }), { status: 400 });

test("sends one request at a time, at least 250 ms apart, and retries a failure after 1, 2, 4, 8, 16 s and then 32 s", async () => {
  const clock = fakeTime();
  const statuses = [502, 429, 200];
  const requests = [];
  const client = createESbirkaClient({
    apiKey: "key",
    now: clock.now,
    sleep: clock.sleep,
    onRequest: (entry) => requests.push(entry),
    fetchImpl: async (url, { headers }) => {
      assert.equal(headers["esel-api-access-key"], "key");
      return answer("{}", { status: statuses.shift() });
    }
  });
  assert.deepEqual(await client.get("/typy-aktu", { purpose: "test" }), {});
  assert.deepEqual(requests.map(({ ok, status }) => [ok, status]), [[false, 502], [false, 429], [true, 200]]);
  assert.deepEqual(clock.sleeps, [1_000, 2_000]);
  assert.deepEqual(eSbirkaRequestSettings.retryDelaysMs, [1, 2, 4, 8, 16, 32, 32, 32, 32, 32].map((seconds) => seconds * 1_000));
  // The next request waits for the 250 ms interval: never more than 4 a second.
  await client.get("/typy-aktu");
  assert.equal(clock.sleeps.at(-1), 250);
  assert.ok(eSbirkaRequestSettings.minIntervalMs >= 200);
});

test("a technical failure after every retry is ESbirkaUnavailableError; a missing document is not one", async () => {
  const failing = createESbirkaClient({ apiKey: "key", ...fakeTime(), fetchImpl: async () => { throw new Error("socket hang up"); } });
  await assert.rejects(failing.get("/x", { purpose: "wordings 1/2000" }), (error) => error instanceof ESbirkaUnavailableError && /11 attempts \(wordings 1\/2000\): socket hang up/.test(error.message));
  const unreadable = createESbirkaClient({ apiKey: "key", ...fakeTime(), fetchImpl: async () => answer("<html>Proxy Error</html>") });
  await assert.rejects(unreadable.get("/x"), ESbirkaUnavailableError);
  // A rejected key is not retried.
  const keyClock = fakeTime();
  const invalidKey = createESbirkaClient({ apiKey: "key", now: keyClock.now, sleep: keyClock.sleep, fetchImpl: async () => answer(JSON.stringify({ chyby: [{ kod: "NEPLATNY_API_KLIC" }] }), { status: 401 }) });
  await assert.rejects(invalidKey.get("/x"), /rejected the key \(request\): HTTP 401 NEPLATNY_API_KLIC/);
  assert.deepEqual(keyClock.sleeps, []);
  // Also when the rejection is not JSON.
  const htmlClock = fakeTime();
  const htmlRejection = createESbirkaClient({ apiKey: "key", now: htmlClock.now, sleep: htmlClock.sleep, fetchImpl: async () => answer("<html>Forbidden</html>", { status: 403 }) });
  await assert.rejects(htmlRejection.get("/x"), /rejected the key \(request\): HTTP 403/);
  assert.deepEqual(htmlClock.sleeps, []);
  const missing = createESbirkaClient({ apiKey: "key", ...fakeTime(), fetchImpl: async () => notFound() });
  assert.equal(await missing.get("/x"), null);
  const keyless = createESbirkaClient({ apiKey: "", ...fakeTime(), fetchImpl: async () => answer("{}") });
  await assert.rejects(keyless.get("/x"), /ESEL_API_ACCESS_KEY is not set/);
});

// A stand-in for the e-Sbírka REST API holding one act, 110/2019, with two
// wordings, answering the three requests the reader sends: the history of
// an act, the nodes of a wording page by page, and the detail of an act.
function endpointFor(act, { pageSize = 1000 } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const { pathname, searchParams } = new URL(url);
    calls.push(`${pathname}${searchParams.size ? `?${searchParams}` : ""}`);
    const feed = /^\/dokumenty-sbirky\/(zmeny-zneni|depublikovana-zneni)$/.exec(pathname)?.[1];
    if (feed) {
      assert.equal(searchParams.get("pocet"), "10000");
      const listed = (act.changes?.[feed] ?? []).map(([actId, wording]) => ({ kodSbirky: "sb", rok: Number(actId.split("/")[1]), cisloPredpisu: actId.split("/")[0], ...(wording ? { datumUcinnostiZneniOd: wording } : {}) }));
      return answer(JSON.stringify({ pocetCelkem: listed.length + (act.changes?.uncounted ?? 0), seznamZneniPravnichPredpisu: listed }));
    }
    const [, segment, rest = ""] = /^\/dokumenty-sbirky\/([^/]+)(\/.*)?$/.exec(pathname);
    const staleUrl = decodeURIComponent(segment);
    const [, year, number, wording] = /^\/sb\/(\d{4})\/(\d+)(?:\/([\d-]+))?$/.exec(staleUrl);
    const actId = `${number}/${year}`;
    if (rest === "/historie") {
      if (actId !== "110/2019") return notFound();
      const promulgatedOn = act.promulgations["110/2019"];
      return answer(JSON.stringify({
        historie: [
          ...act.wordings.map(({ wording: id, from, to }) => ({ staleUrl: `/sb/2019/110/${id}`, datumUcinnostiZneniOd: from, ...(to ? { datumUcinnostiZneniDo: to } : {}), novely: (act.amendments[id] ?? []).map((amendment) => ({ staleUrl: `/sb/${amendment.split("/")[1]}/${amendment.split("/")[0]}`, kodDokumentuSbirky: `${amendment} Sb.` })) })),
          { staleUrl: "/sb/2019/110/3000-01-27", typZneni: "BUDOUCI", poznamky: ["Účinnost uvedena v textové podobě"], novely: [] },
          ...(promulgatedOn ? [{ staleUrl: "/sb/2019/110/0000-00-00", datumUcinnostiZneniOd: promulgatedOn, datumCasVyhlaseni: `${promulgatedOn}T00:00:00.000+02:00`, typZneni: "VYHLASENE", novely: [] }] : [])
        ]
      }));
    }
    if (rest === "/fragmenty") {
      const paths = act.structures[wording];
      if (!paths) return notFound();
      const page = Number(searchParams.get("cisloStranky"));
      const pages = Math.max(1, Math.ceil(paths.length / pageSize));
      const seznam = paths.slice(page * pageSize, (page + 1) * pageSize).map((path) => ({ eli: `/eli/cz/sb/2019/110/${act.pageWording?.[wording] ?? wording}/${path}`, xhtml: act.texts[`${wording}/${path}`] ?? "" }));
      if (page === 0) seznam.unshift(...(act.unnamed?.[wording] ?? []).map((xhtml) => ({ id: 7, eli: "", xhtml })));
      return answer(JSON.stringify({ seznam, pocetStranek: pages }));
    }
    const promulgatedOn = act.promulgations[actId];
    return promulgatedOn ? answer(JSON.stringify({ staleUrl, datumCasVyhlaseni: `${promulgatedOn}T09:00:00.000+02:00` })) : notFound();
  };
  return { fetchImpl, calls };
}

const act110 = {
  wordings: [{ wording: "2025-01-01", from: "2025-01-01", to: "2026-06-11" }, { wording: "2026-06-12", from: "2026-06-12", to: null }],
  // Every node of each wording, in document order.
  structures: {
    "2025-01-01": ["dokument", "dokument/norma", "dokument/norma/cast_1/hlava_5/par_8", "dokument/norma/cast_1/hlava_5/par_52", "dokument/norma/cast_1/hlava_5/par_52/odst_1", "dokument/norma/cast_1/hlava_5/par_52/odst_2"],
    // The change itself in force: § 8a it inserts exists in this later
    // wording, and must still be named a new provision.
    "2026-06-12": ["dokument", "dokument/norma", "dokument/norma/cast_1/hlava_5/par_8", "dokument/norma/cast_1/hlava_5/par_8a", "dokument/norma/cast_1/hlava_5/par_8a/odst_2", "dokument/norma/cast_1/hlava_5/par_32d", "dokument/norma/cast_1/hlava_5/par_52", "dokument/norma/cast_1/hlava_5/par_52/odst_1"]
  },
  texts: {
    "2025-01-01/dokument/norma/cast_1/hlava_5/par_52/odst_1": "<var>(1)</var> Úřad řídí předseda. Předseda Úřadu se považuje za služební orgán.",
    "2025-01-01/dokument/norma/cast_1/hlava_5/par_52/odst_2": "(2) Funkční období je 5 let.",
    "2025-01-01/dokument/norma/cast_1/hlava_5/par_8": "§ 8 text",
    "2026-06-12/dokument/norma/cast_1/hlava_5/par_32d": "§ 32d text"
  },
  // The later wording was made by 300/2025 Sb., promulgated before the
  // conduct on 2025-12-29.
  amendments: { "2026-06-12": ["300/2025"] },
  promulgations: { "300/2025": "2025-09-02" }
};

async function readerFor(directory, endpoint, { clock = fakeTime(), at = () => new Date().toISOString() } = {}) {
  const client = createESbirkaClient({ apiKey: "key", now: clock.now, sleep: clock.sleep, fetchImpl: endpoint.fetchImpl });
  return createLawContextReader({ client, cache: createLawContextCache(directory), clock: at });
}

const change = {
  changeId: "43184-22",
  printId: "43184",
  printNumber: 77,
  printKindId: "2",
  printTitleCz: "Návrh zákona o státních zaměstnancích - související",
  heading: "ČÁST DVACÁTÁ DRUHÁ",
  titleCz: "Změna zákona o zpracování osobních údajů",
  acts: [{ act: "110/2019", name: "o zpracování osobních údajů" }],
  addedIn: "proposed",
  versions: {
    proposed: {
      textCz: [
        "Zákon č. 110/2019 Sb., o zpracování osobních údajů, se mění takto:",
        "1. V § 52 odst. 1 se věta poslední zrušuje.",
        "2. V § 52 odst. 7 se slova „a“ zrušují.",
        "3. Za § 8 se vkládá nový § 8a, který zní:",
        "„§ 8a",
        "Text.“",
        "4. V § 8a odst. 2 se slovo „a“ zrušuje.",
        "5. V § 32d odst. 1 se slovo „a“ zrušuje.",
        "6. V § 99 se slovo „a“ zrušuje.",
        "7. V části třetí se hlava IV zrušuje."
      ].join("\n"),
      amendedAct: { act: "110/2019", name: "o zpracování osobních údajů" },
      effectiveCz: ""
    },
    approved: { sameAs: "proposed", amendedAct: { act: "110/2019", name: "o zpracování osobních údajů" }, effectiveCz: "" }
  }
};
// A submission concerns the proposed version; this print has no decisive vote.
const records = [{ id: "r1", kind: "legislative-step", occurredAt: "2025-12-29T10:00:00Z", payload: {} }];

test("resolves every target with one status, in the wording on the conduct date or a later one", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "law-context-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const endpoint = endpointFor(act110);
  const context = await resolveLawChangeContext(change, records, await readerFor(directory, endpoint));
  // Only the proposed version has conduct; the approved one gets no context.
  assert.deepEqual(Object.keys(context.versions), ["proposed"]);
  const proposed = context.versions.proposed;
  assert.equal(proposed.conductDate, "2025-12-29");
  assert.deepEqual(proposed.instructions.map(({ targets }) => targets.map(({ target, status }) => `${target ?? "-"}: ${status}`)), [
    ["§ 52 odst. 1: found"],
    ["§ 52 odst. 7: paragraph-not-found"],
    ["§ 8: found", "§ 8a: new-provision"],
    ["§ 8a odst. 2: new-provision"],
    ["§ 32d odst. 1: later-wording"],
    ["§ 99: not-found"],
    ["-: not-recognised"]
  ]);
  // Paragraphs are joined in document order, without markup.
  const provision = proposed.provisions["110/2019@2025-01-01#dokument/norma/cast_1/hlava_5/par_52"];
  assert.equal(provision.textCz, "(1) Úřad řídí předseda. Předseda Úřadu se považuje za služební orgán.\n(2) Funkční období je 5 let.");
  assert.equal(proposed.provisions["110/2019@2026-06-12#dokument/norma/cast_1/hlava_5/par_32d"].textCz, "§ 32d text");
  // § 52 odst. 1 lies inside the whole § 52 supplied for the missing
  // paragraph 7, so it is supplied once.
  assert.deepEqual(Object.keys(proposed.provisions).sort(), [
    "110/2019@2025-01-01#dokument/norma/cast_1/hlava_5/par_52",
    "110/2019@2025-01-01#dokument/norma/cast_1/hlava_5/par_8",
    "110/2019@2026-06-12#dokument/norma/cast_1/hlava_5/par_32d"
  ]);
  assert.deepEqual(proposed.instructions[0].targets[0].provisionIds, ["110/2019@2025-01-01#dokument/norma/cast_1/hlava_5/par_52"]);
  assert.deepEqual(contextStatusCounts([context]), { found: 2, "later-wording": 1, "promulgated-wording": 0, "unverified-later-wording": 0, "paragraph-not-found": 1, "new-provision": 2, "not-found": 1, "not-recognised": 1 });

  // The model reads the context after the version's text, and the version
  // with the same text and no conduct names no context.
  const text = lawChangeText(withContext(change, context));
  assert.match(text, /Version: proposed text\nZákon č\. 110\/2019 Sb\.[\s\S]*1\. V § 52[\s\S]*Context from the Collection of Laws \(e-Sbírka\): the provisions this version amends, as in force on 2025-12-29/);
  assert.match(text, /§ 52 zákona č\. 110\/2019 Sb\. \(wording from 2025-01-01\):\n\(1\) Úřad řídí předseda/);
  assert.match(text, /Named provisions: § 52 odst\. 1: found; § 52 odst\. 7: whole provision; § 8: found; § 8a: new; § 8a odst\. 2: new; § 32d odst\. 1: later wording \(wording from 2026-06-12\); § 99: not found; not recognised: "7\. V části třetí se hlava IV zrušuje\."\./);
    assert.doesNotMatch(text.split("Version: text approved")[1] ?? "", /Context/);
});

test("everything read is cached: a second run only checks what e-Sbírka changed", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "law-context-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = endpointFor(act110);
  const firstContext = await resolveLawChangeContext(change, records, await readerFor(directory, first));
  assert.ok(first.calls.length > 0);
  const lines = (await readFile(join(directory, "2019-110.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual([...new Set(lines.map(({ kind }) => kind))].sort(), ["wording", "wordings"]);
  // Every line records when its answer was read.
  assert.ok(lines.every(({ readAt }) => !Number.isNaN(Date.parse(readAt)) && readAt.endsWith("Z")));
  assert.deepEqual(lines.find(({ kind }) => kind === "wordings").wordings[1], { wording: "2026-06-12", from: "2026-06-12", to: null, amendments: ["300/2025"] });
  assert.deepEqual((await readFile(join(directory, "2025-300.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line)).map(({ readAt, ...line }) => line), [{ kind: "promulgated", date: "2025-09-02" }]);
  const second = endpointFor(act110);
  const reader = await readerFor(directory, second);
  assert.deepEqual(await resolveLawChangeContext(change, records, reader), firstContext);
  // Only the check of what e-Sbírka changed since the first run.
  assert.deepEqual(second.calls.map((call) => call.split("?")[0]), ["/dokumenty-sbirky/zmeny-zneni", "/dokumenty-sbirky/depublikovana-zneni"]);
  assert.equal(reader.stats.requests, 2);
  const journal = (await readFile(join(directory, "changes.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  // The first run, on an empty cache, only marks where checking starts.
  assert.equal(journal[0].from, null);
  assert.equal(journal[1].from, new Date(Date.parse(journal[0].readAt) - 3_600_000).toISOString());
});

test("a later wording is used only when its amendments were promulgated by the conduct date", async (t) => {
  const contextOf32d = async (variant) => {
    const directory = await mkdtemp(join(tmpdir(), "law-context-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const context = await resolveLawChangeContext(change, records, await readerFor(directory, endpointFor({ ...act110, ...variant })));
    const proposed = context.versions.proposed;
    const target = proposed.instructions.flatMap(({ targets }) => targets).find(({ target: name }) => name === "§ 32d odst. 1");
    return { target, provision: proposed.provisions[target.provisionIds?.[0]], text: contextText(proposed) };
  };
  // Promulgated after the conduct: its text was not known then.
  assert.equal((await contextOf32d({ promulgations: { "300/2025": "2026-01-15" } })).target.status, "not-found");
  // Promulgated on the day of the conduct: already known.
  assert.equal((await contextOf32d({ promulgations: { "300/2025": "2025-12-29" } })).target.status, "later-wording");
  // No amendment named for the later wording: the act as it was itself
  // promulgated before the conduct, when it holds the provision.
  const promulgatedAct = { amendments: {}, promulgations: { "110/2019": "2019-04-24" }, structures: { ...act110.structures, "0000-00-00": ["dokument/norma", "dokument/norma/cast_1/hlava_5/par_32d"] }, texts: { ...act110.texts, "0000-00-00/dokument/norma/cast_1/hlava_5/par_32d": "§ 32d as promulgated" } };
  const fromAct = await contextOf32d(promulgatedAct);
  assert.equal(fromAct.target.status, "promulgated-wording");
  assert.equal(fromAct.provision.textCz, "§ 32d as promulgated");
  assert.match(fromAct.text, /§ 32d odst\. 1: as promulgated \(promulgated on 2019-04-24\)/);
  assert.match(fromAct.text, /§ 32d zákona č\. 110\/2019 Sb\. \(as promulgated on 2019-04-24\):\n§ 32d as promulgated/);
  // Otherwise the later wording, marked as not verified.
  const unverified = await contextOf32d({ amendments: {} });
  assert.equal(unverified.target.status, "unverified-later-wording");
  assert.match(unverified.text, /§ 32d odst\. 1: later wording, promulgation not verified \(wording from 2026-06-12\)/);
  assert.equal((await contextOf32d({ promulgations: {} })).target.status, "unverified-later-wording");
  // The act promulgated after the conduct is never used.
  assert.equal((await contextOf32d({ ...promulgatedAct, promulgations: { "110/2019": "2026-01-10" } })).target.status, "unverified-later-wording");
});

test("a wording is read page by page, and a missing, mixed, or textless one is a technical failure, never cached", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "law-context-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Pages of two nodes: every node, in document order.
  const paged = endpointFor(act110, { pageSize: 2 });
  const reader = await readerFor(join(directory, "paged"), paged);
  assert.deepEqual(await reader.structure("110/2019", "2025-01-01"), [...act110.structures["2025-01-01"]].sort());
  assert.deepEqual(paged.calls.map((call) => call.split("?")[1]), ["cisloStranky=0", "cisloStranky=1", "cisloStranky=2"]);
  const texts = await reader.texts("110/2019", "2025-01-01", ["dokument/norma/cast_1/hlava_5/par_52/odst_2", "dokument/norma/cast_1/hlava_5/par_99"]);
  assert.deepEqual(texts, { "dokument/norma/cast_1/hlava_5/par_52/odst_2": { text: "(2) Funkční období je 5 let.", order: 5 }, "dokument/norma/cast_1/hlava_5/par_99": { text: null, order: null } });
  assert.equal(paged.calls.length, 3);
  // A wording listed in the history must exist.
  const missing = endpointFor({ ...act110, structures: {} });
  await assert.rejects(resolveLawChangeContext(change, records, await readerFor(join(directory, "missing"), missing)), /holds no nodes of the existing wording 110\/2019 2025-01-01/);
  // Nodes of another wording than the one asked for.
  const mixed = endpointFor({ ...act110, pageWording: { "2025-01-01": "2026-06-12" } });
  await assert.rejects((await readerFor(join(directory, "mixed"), mixed)).structure("110/2019", "2025-01-01"), /returned node \/eli\/cz\/sb\/2019\/110\/2026-06-12\/dokument for 110\/2019 2025-01-01/);
  // A wrapping block without a path or text is skipped; a text without a
  // path would be lost.
  const wrapped = await readerFor(join(directory, "wrapped"), endpointFor({ ...act110, unnamed: { "2025-01-01": [""] } }));
  assert.deepEqual(await wrapped.structure("110/2019", "2025-01-01"), [...act110.structures["2025-01-01"]].sort());
  const unnamed = await readerFor(join(directory, "unnamed"), endpointFor({ ...act110, unnamed: { "2025-01-01": ["(1) Text"] } }));
  await assert.rejects(unnamed.structure("110/2019", "2025-01-01"), /returned node 7 without an ELI path for 110\/2019 2025-01-01/);
  // No text at all.
  const textless = endpointFor({ ...act110, texts: {} });
  await assert.rejects(resolveLawChangeContext(change, records, await readerFor(join(directory, "textless"), textless)), /no text for the wording 110\/2019 2025-01-01/);
  assert.equal((await readFile(join(directory, "textless", "2019-110.jsonl"), "utf8")).includes('"kind":"wording"'), false);
  // An act e-Sbírka does not hold has no wordings and no promulgation day.
  const unknown = await readerFor(join(directory, "unknown"), endpointFor(act110));
  assert.deepEqual(await unknown.wordings("1/2099"), []);
  assert.equal(await unknown.promulgated("1/2099"), null);
});

test("locates provisions by their ELI paths only", () => {
  const paths = ["dokument/norma/cast_1/par_28", "dokument/norma/cast_1/par_28/frag_1", "dokument/novela/cast_1/cl_2", "dokument/novela/cast_1/cl_2/bod_5", "dokument/prilohy/priloha_0", "dokument/prilohy/priloha_0/cast_1/pol_18", "dokument/poznamkypodcarou/ppc_79"];
  assert.deepEqual(locateTarget(paths, { kind: "section", section: "28", paragraph: null }), { roots: ["dokument/norma/cast_1/par_28"], partial: false });
  assert.deepEqual(locateTarget(paths, { kind: "article", article: "2", point: "5", paragraph: null }), { roots: ["dokument/novela/cast_1/cl_2/bod_5"], partial: false });
  assert.deepEqual(locateTarget(paths, { kind: "annex", annex: null, item: { kind: "pol", number: "18" } }), { roots: ["dokument/prilohy/priloha_0/cast_1/pol_18"], partial: false });
  assert.equal(locateTarget(paths, { kind: "annex", annex: null, item: { kind: "pol", number: "19" } }), null);
  assert.deepEqual(locateTarget(paths, { kind: "footnote", footnote: "79" }), { roots: ["dokument/poznamkypodcarou/ppc_79"], partial: false });
  assert.equal(locateTarget(paths, { kind: "section", section: "2", paragraph: null }), null);
  // A range holds every section numbered within it, with letters too.
  const ranged = ["dokument/norma/cast_1/par_5", "dokument/norma/cast_1/par_5a", "dokument/norma/cast_1/par_5a/odst_1", "dokument/norma/cast_1/par_6", "dokument/norma/cast_1/par_7", "dokument/norma/cast_1/par_50", "dokument/prilohy/priloha_0/par_6"];
  assert.deepEqual(locateTarget(ranged, { kind: "section", section: "5", sectionTo: "6", paragraph: null }), { roots: ["dokument/norma/cast_1/par_5", "dokument/norma/cast_1/par_5a", "dokument/norma/cast_1/par_6"], partial: false });
  assert.deepEqual(locateTarget(ranged, { kind: "section", section: "5a", sectionTo: "5c", paragraph: null }), { roots: ["dokument/norma/cast_1/par_5a"], partial: false });
  assert.equal(locateTarget(ranged, { kind: "section", section: "8", sectionTo: "9", paragraph: null }), null);
  assert.equal(citationOfPath("dokument/norma/cast_1/par_52/odst_1/pism_a"), "§ 52 odst. 1 písm. a)");
  assert.equal(citationOfPath("dokument/novela/cast_1/cl_2/bod_5"), "čl. II bod 5");
  assert.deepEqual(wordingOn([{ wording: "a", from: "2025-01-01", to: "2025-12-31" }, { wording: "b", from: "2026-01-01", to: null }], "2026-03-01"), { wording: "b", from: "2026-01-01", to: null });
  assert.equal(plainText("<var>(1)</var> Text&nbsp;a <a href=\"#\">odkaz</a>"), "(1) Text a odkaz");
  assert.equal(contextText(null), null);
});

test("only what e-Sbírka reports changed since it was read is requested again", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "law-context-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Answers are read at 10:00 on the first run and 12:00 on later ones.
  const run = async (changes, time) => {
    const endpoint = endpointFor({ ...act110, changes });
    const reader = await readerFor(directory, endpoint, { at: () => time });
    await reader.structure("110/2019", "2025-01-01");
    await reader.structure("110/2019", "2026-06-12");
    await reader.wordings("110/2019");
    await reader.promulgated("300/2025");
    return endpoint.calls.map((call) => call.replace(/\?.*/, "").replace("/dokumenty-sbirky/", "")).filter((call) => !call.includes("zneni"));
  };
  assert.deepEqual(await run({}, "2026-10-01T10:00:00.000Z"), ["%2Fsb%2F2019%2F110%2F2025-01-01/fragmenty", "%2Fsb%2F2019%2F110%2F2026-06-12/fragmenty", "%2Fsb%2F2019%2F110/historie", "%2Fsb%2F2025%2F300"]);
  // Nothing changed: everything comes from the cache.
  assert.deepEqual(await run({}, "2026-10-02T12:00:00.000Z"), []);
  // Another act changed: still nothing.
  assert.deepEqual(await run({ "zmeny-zneni": [["89/2012", "2027-01-01"]] }, "2026-10-03T12:00:00.000Z"), []);
  // A new or changed wording of the act: its list, and that wording only.
  assert.deepEqual(await run({ "zmeny-zneni": [["110/2019", "2026-06-12"]] }, "2026-10-04T12:00:00.000Z"), ["%2Fsb%2F2019%2F110%2F2026-06-12/fragmenty", "%2Fsb%2F2019%2F110/historie"]);
  // A withdrawn wording counts the same.
  assert.deepEqual(await run({ "depublikovana-zneni": [["110/2019", "2025-01-01"]] }, "2026-10-05T12:00:00.000Z"), ["%2Fsb%2F2019%2F110%2F2025-01-01/fragmenty", "%2Fsb%2F2019%2F110/historie"]);
  // The promulgated wording is listed by the act's promulgation day.
  const promulgatedRun = async (changes, time) => {
    const endpoint = endpointFor({ ...act110, changes, promulgations: { ...act110.promulgations, "300/2025": "2025-09-02" }, structures: { ...act110.structures }, texts: { ...act110.texts } });
    const reader = await readerFor(directory, endpoint, { at: () => time });
    await reader.promulgated("300/2025");
    return endpoint.calls.filter((call) => !call.includes("zneni")).length;
  };
  assert.equal(await promulgatedRun({}, "2026-10-05T13:00:00.000Z"), 0);
  assert.equal(await promulgatedRun({ "zmeny-zneni": [["300/2025", "2025-09-02"]] }, "2026-10-05T14:00:00.000Z"), 1);
  // A change list that could not name every change makes everything out of date.
  assert.deepEqual(await run({ uncounted: 1 }, "2026-10-06T12:00:00.000Z"), ["%2Fsb%2F2019%2F110%2F2025-01-01/fragmenty", "%2Fsb%2F2019%2F110%2F2026-06-12/fragmenty", "%2Fsb%2F2019%2F110/historie", "%2Fsb%2F2025%2F300"]);
  assert.deepEqual(await run({}, "2026-10-07T12:00:00.000Z"), []);
});

test("a cache line cut short by a stopped run is removed, and what it held is read again", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "law-context-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "2019-110.jsonl");
  const wordings = JSON.stringify({ kind: "wordings", readAt: "2026-09-28T09:00:00.000Z", wordings: act110.wordings.map((wording) => ({ ...wording, amendments: act110.amendments[wording.wording] ?? [] })) });
  await writeFile(file, `${wordings}\n{"kind":"wording","wording":"2025-01-01","nodes":[["dokum`);
  const endpoint = endpointFor(act110);
  const reader = await readerFor(directory, endpoint);
  assert.deepEqual(await reader.structure("110/2019", "2025-01-01"), [...act110.structures["2025-01-01"]].sort());
  assert.equal(endpoint.calls.filter((call) => call.includes("/fragmenty")).length, 1);
  await createLawContextCache(directory).load("110/2019");
  const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(lines.map(({ kind }) => kind), ["wordings", "wording"]);
  // A corrupt line before the last one is never skipped silently.
  await writeFile(file, `{"kind":"wor\n${wordings}\n`);
  await assert.rejects(createLawContextCache(directory).load("110/2019"), /Corrupt law-context cache .* line 1/);
});
