import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLawContextCache, createLawContextReader, createSparqlClient, ESbirkaUnavailableError, plainText } from "../scripts/lib/e-sbirka.mjs";
import { citationOfPath, contextStatusCounts, contextText, locateTarget, resolveLawChangeContext, withContext, wordingOn } from "../scripts/lib/law-context.mjs";
import { lawChangeText } from "../scripts/lib/law-change-screening.mjs";

// A clock and sleep that only move when the client waits, so pacing and
// retries are checked without real time passing.
function fakeTime() {
  let time = 0;
  const sleeps = [];
  return { now: () => time, sleep: async (ms) => { sleeps.push(ms); time += ms; }, advance: (ms) => { time += ms; }, sleeps };
}

const json = (bindings) => JSON.stringify({ head: { vars: [] }, results: { bindings } });
const answer = (body, { status = 200 } = {}) => ({ ok: status === 200, status, text: async () => body });

test("sends one request at a time, at least 2 s apart, and retries a failure after 30 s and 90 s", async () => {
  const clock = fakeTime();
  const statuses = [502, 502, 200];
  const requests = [];
  const client = createSparqlClient({
    now: clock.now,
    sleep: clock.sleep,
    onRequest: (entry) => requests.push(entry),
    fetchImpl: async () => answer(json([]), { status: statuses.shift() })
  });
  assert.deepEqual(await client.query("SELECT 1", { purpose: "test" }), []);
  assert.deepEqual(requests.map(({ ok, status }) => [ok, status]), [[false, 502], [false, 502], [true, 200]]);
  assert.deepEqual(clock.sleeps, [30_000, 90_000]);
  // The next request waits for the 2 s interval.
  await client.query("SELECT 2");
  assert.equal(clock.sleeps.at(-1), 2_000);
});

test("a technical failure after every retry is ESbirkaUnavailableError, and a slow answer is never trusted", async () => {
  const clock = fakeTime();
  const failing = createSparqlClient({ now: clock.now, sleep: clock.sleep, fetchImpl: async () => { throw new Error("socket hang up"); } });
  await assert.rejects(failing.query("SELECT 1", { purpose: "wordings 1/2000" }), (error) => error instanceof ESbirkaUnavailableError && /3 attempts \(wordings 1\/2000\): socket hang up/.test(error.message));
  // The endpoint returns partial results near its limit: an answer after
  // 30 s counts as a failure even when it is well formed.
  const slowClock = fakeTime();
  const slow = createSparqlClient({ now: slowClock.now, sleep: slowClock.sleep, fetchImpl: async () => { slowClock.advance(31_000); return answer(json([])); } });
  await assert.rejects(slow.query("SELECT 1"), /may be partial/);
  const unreadable = createSparqlClient({ ...fakeTime(), fetchImpl: async () => answer("<html>Proxy Error</html>") });
  await assert.rejects(unreadable.query("SELECT 1"), ESbirkaUnavailableError);
});

// A stand-in for the SPARQL endpoint holding one act, 110/2019, with two
// wordings, answering the three queries the reader sends.
function endpointFor(act) {
  const calls = [];
  const fetchImpl = async (url, { body, headers }) => {
    const query = new URLSearchParams(body).get("query");
    calls.push(query);
    if (query.includes("s:znění-právního-aktu")) {
      return answer(json(act.wordings.map(({ wording, from, to }) => ({ zn: { value: `https://opendata.eselpoint.gov.cz/esel-esb/eli/cz/sb/2019/110/${wording}` }, od: { value: from }, ...(to ? { do: { value: to } } : {}) }))));
    }
    if (query.includes("s:má-předka+")) {
      assert.equal(headers.accept, "text/csv");
      const wording = /sb\/2019\/110\/([\d-]+)\/dokument>/.exec(query)[1];
      return answer(`"z"\n${act.structures[wording].map((path) => `"https://opendata.eselpoint.gov.cz/esel-esb/eli/cz/sb/2019/110/${wording}/${path}"`).join("\n")}\n`);
    }
    const rows = [...query.matchAll(/<(https:[^>]+)>/g)].map((match) => match[1]).filter((iri) => act.texts[iri.split("/sb/2019/110/")[1]]).map((iri) => {
      const [text, order] = act.texts[iri.split("/sb/2019/110/")[1]];
      return { z: { value: iri }, text: { value: text }, order: { value: order } };
    });
    return answer(json(rows));
  };
  return { fetchImpl, calls };
}

const act110 = {
  wordings: [{ wording: "2025-01-01", from: "2025-01-01", to: "2026-06-11" }, { wording: "2026-06-12", from: "2026-06-12", to: null }],
  structures: {
    "2025-01-01": ["dokument/norma", "dokument/norma/cast_1/hlava_5/par_52", "dokument/norma/cast_1/hlava_5/par_52/odst_1", "dokument/norma/cast_1/hlava_5/par_52/odst_2", "dokument/norma/cast_1/hlava_5/par_8"],
    "2026-06-12": ["dokument/norma", "dokument/norma/cast_1/hlava_5/par_52", "dokument/norma/cast_1/hlava_5/par_52/odst_1", "dokument/norma/cast_1/hlava_5/par_32d", "dokument/norma/cast_1/hlava_5/par_8"]
  },
  texts: {
    "2025-01-01/dokument/norma/cast_1/hlava_5/par_52/odst_1": ["<var>(1)</var> Úřad řídí předseda. Předseda Úřadu se považuje za služební orgán.", "6AE58D60"],
    "2025-01-01/dokument/norma/cast_1/hlava_5/par_52/odst_2": ["(2) Funkční období je 5 let.", "6AE58DA0"],
    "2025-01-01/dokument/norma/cast_1/hlava_5/par_8": ["§ 8 text", "6AE50000"],
    "2026-06-12/dokument/norma/cast_1/hlava_5/par_32d": ["§ 32d text", "6AE60000"]
  }
};

async function readerFor(directory, endpoint, clock = fakeTime()) {
  const client = createSparqlClient({ now: clock.now, sleep: clock.sleep, fetchImpl: endpoint.fetchImpl });
  return createLawContextReader({ client, cache: createLawContextCache(directory) });
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
  assert.deepEqual(contextStatusCounts([context]), { found: 2, "later-wording": 1, "paragraph-not-found": 1, "new-provision": 2, "not-found": 1, "not-recognised": 1 });

  // The model reads the context after the version's text, and the version
  // with the same text and no conduct names no context.
  const text = lawChangeText(withContext(change, context));
  assert.match(text, /Version: proposed text\nZákon č\. 110\/2019 Sb\.[\s\S]*1\. V § 52[\s\S]*Context from the Collection of Laws \(e-Sbírka\): the provisions this version amends, as in force on 2025-12-29/);
  assert.match(text, /§ 52 zákona č\. 110\/2019 Sb\. \(wording from 2025-01-01\):\n\(1\) Úřad řídí předseda/);
  assert.match(text, /Named provisions: § 52 odst\. 1: found; § 52 odst\. 7: whole provision; § 8: found; § 8a: new; § 8a odst\. 2: new; § 32d odst\. 1: later wording \(wording from 2026-06-12\); § 99: not found; not recognised: "7\. V části třetí se hlava IV zrušuje\."\./);
    assert.doesNotMatch(text.split("Version: text approved")[1] ?? "", /Context/);
});

test("everything read is cached for good: a second run sends no request", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "law-context-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = endpointFor(act110);
  const firstContext = await resolveLawChangeContext(change, records, await readerFor(directory, first));
  assert.ok(first.calls.length > 0);
  const lines = (await readFile(join(directory, "2019-110.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual([...new Set(lines.map(({ kind }) => kind))].sort(), ["structure", "text", "wordings"]);
  const second = endpointFor(act110);
  const reader = await readerFor(directory, second);
  assert.deepEqual(await resolveLawChangeContext(change, records, reader), firstContext);
  assert.equal(second.calls.length, 0);
  assert.equal(reader.stats.requests, 0);
});

test("an empty or cut structure of an existing wording is a technical failure, not a missing provision", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "law-context-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const empty = endpointFor({ ...act110, structures: { "2025-01-01": [], "2026-06-12": [] } });
  await assert.rejects(resolveLawChangeContext(change, records, await readerFor(directory, empty)), /no structure for the existing wording 110\/2019 2025-01-01/);
  const cut = endpointFor(act110);
  const clock = fakeTime();
  const client = createSparqlClient({ now: clock.now, sleep: clock.sleep, fetchImpl: cut.fetchImpl, maxRows: 3 });
  const reader = createLawContextReader({ client, cache: createLawContextCache(join(directory, "cut")) });
  await assert.rejects(reader.structure("110/2019", "2025-01-01"), /filled the row limit 3/);
});

test("locates provisions by their ELI paths only", () => {
  const paths = ["dokument/norma/cast_1/par_28", "dokument/norma/cast_1/par_28/frag_1", "dokument/novela/cast_1/cl_2", "dokument/novela/cast_1/cl_2/bod_5", "dokument/prilohy/priloha_0", "dokument/prilohy/priloha_0/cast_1/pol_18", "dokument/poznamkypodcarou/ppc_79"];
  assert.deepEqual(locateTarget(paths, { kind: "section", section: "28", paragraph: null }), { roots: ["dokument/norma/cast_1/par_28"], partial: false });
  assert.deepEqual(locateTarget(paths, { kind: "article", article: "2", point: "5", paragraph: null }), { roots: ["dokument/novela/cast_1/cl_2/bod_5"], partial: false });
  assert.deepEqual(locateTarget(paths, { kind: "annex", annex: null, item: { kind: "pol", number: "18" } }), { roots: ["dokument/prilohy/priloha_0/cast_1/pol_18"], partial: false });
  assert.equal(locateTarget(paths, { kind: "annex", annex: null, item: { kind: "pol", number: "19" } }), null);
  assert.deepEqual(locateTarget(paths, { kind: "footnote", footnote: "79" }), { roots: ["dokument/poznamkypodcarou/ppc_79"], partial: false });
  assert.equal(locateTarget(paths, { kind: "section", section: "2", paragraph: null }), null);
  assert.equal(citationOfPath("dokument/norma/cast_1/par_52/odst_1/pism_a"), "§ 52 odst. 1 písm. a)");
  assert.equal(citationOfPath("dokument/novela/cast_1/cl_2/bod_5"), "čl. II bod 5");
  assert.deepEqual(wordingOn([{ wording: "a", from: "2025-01-01", to: "2025-12-31" }, { wording: "b", from: "2026-01-01", to: null }], "2026-03-01"), { wording: "b", from: "2026-01-01", to: null });
  assert.equal(plainText("<var>(1)</var> Text&nbsp;a <a href=\"#\">odkaz</a>"), "(1) Text a odkaz");
  assert.equal(contextText(null), null);
});

test("the list of wordings is read again for conduct on or after the day it was read, once per run", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "law-context-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const read = async (today) => {
    const endpoint = endpointFor(act110);
    const clock = fakeTime();
    const client = createSparqlClient({ now: clock.now, sleep: clock.sleep, fetchImpl: endpoint.fetchImpl });
    const reader = createLawContextReader({ client, cache: createLawContextCache(directory), today });
    await reader.wordings("110/2019", { for: "2025-12-29" });
    await reader.wordings("110/2019", { for: "2025-12-29" });
    return endpoint.calls.filter((query) => query.includes("s:znění-právního-aktu")).length;
  };
  // Read on the day of the conduct: a wording promulgated later that day
  // could be missing, so the next run reads the list again, once.
  assert.equal(await read("2025-12-29"), 1);
  assert.equal(await read("2025-12-30"), 1);
  // Read after the conduct: every wording in force on that day is known.
  assert.equal(await read("2025-12-31"), 0);
});
