import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPspDocumentRecorder, loadPspDocumentHashes, pspDocumentId, recordPspDocument } from "../scripts/lib/psp-document-hashes.mjs";

const url = (id) => `https://www.psp.cz/sqw/text/orig2.sqw?idd=${id}`;
const empty = () => loadPspDocumentHashes("/nonexistent/hashes.json");
const temporaryPath = async () => join(await mkdtemp(join(tmpdir(), "psp-documents-")), "nested", "hashes.json");
const outcome = (hashes, download) => recordPspDocument(hashes, download)?.outcome ?? null;

test("the same file under one document ID keeps one observation and extends its last date", () => {
  const hashes = empty();
  assert.deepEqual(recordPspDocument(hashes, { url: url(266237), bytes: Buffer.from("a"), paragraphs: ["ZÁKON"], seenOn: "2026-10-01" }), { id: "266237", outcome: "new", modified: true });
  assert.deepEqual(recordPspDocument(hashes, { url: url(266237), bytes: Buffer.from("a"), paragraphs: ["ZÁKON"], seenOn: "2026-10-03" }), { id: "266237", outcome: "same", modified: true });
  assert.deepEqual(recordPspDocument(hashes, { url: url(266237), bytes: Buffer.from("a"), paragraphs: ["ZÁKON"], seenOn: "2026-10-03" }), { id: "266237", outcome: "same", modified: false }, "a second download the same day changes nothing");
  assert.deepEqual(hashes.documents["266237"].map(({ firstSeen, lastSeen }) => [firstSeen, lastSeen]), [["2026-10-01", "2026-10-03"]]);
});

test("a changed file and a text changed under the same file are told apart", () => {
  const hashes = empty();
  outcome(hashes, { url: url(1), bytes: Buffer.from("a"), paragraphs: ["x"], seenOn: "2026-10-01" });
  assert.equal(outcome(hashes, { url: url(1), bytes: Buffer.from("b"), paragraphs: ["x"], seenOn: "2026-10-02" }), "file-changed");
  assert.equal(outcome(hashes, { url: url(1), bytes: Buffer.from("b"), paragraphs: ["y"], seenOn: "2026-10-03" }), "text-changed");
  assert.equal(hashes.documents["1"].length, 3);
  assert.equal(outcome(hashes, { url: url(2), bytes: Buffer.from("c"), paragraphs: null, seenOn: "2026-10-01" }), "new");
  assert.equal(hashes.documents["2"][0].textSha256, null);
});

test("content that changes back to an earlier one under the same ID is a change", () => {
  const hashes = empty();
  outcome(hashes, { url: url(5), bytes: Buffer.from("a"), paragraphs: ["x"], seenOn: "2026-10-01" });
  assert.equal(outcome(hashes, { url: url(5), bytes: Buffer.from("b"), paragraphs: ["x"], seenOn: "2026-10-02" }), "file-changed");
  assert.equal(outcome(hashes, { url: url(5), bytes: Buffer.from("a"), paragraphs: ["x"], seenOn: "2026-10-03" }), "file-changed");
  assert.equal(outcome(hashes, { url: url(5), bytes: Buffer.from("a"), paragraphs: ["x"], seenOn: "2026-10-03" }), "same", "a second download in the same run");
  assert.deepEqual(hashes.documents["5"].map(({ firstSeen, lastSeen }) => [firstSeen, lastSeen]), [["2026-10-02", "2026-10-02"], ["2026-10-01", "2026-10-03"]]);
});

test("a file without a numeric document ID is left out of the record", async () => {
  assert.equal(pspDocumentId(`${url(269526)}&x=1`), "269526");
  const hashes = empty();
  assert.equal(recordPspDocument(hashes, { url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=", bytes: Buffer.from("a"), paragraphs: null, seenOn: "2026-10-01" }), null);
  assert.deepEqual(hashes.documents, {});
  const recorder = createPspDocumentRecorder(await temporaryPath(), "2026-10-01");
  assert.equal(recorder.record({ url: "https://www.psp.cz/sqw/text/orig2.sqw", bytes: Buffer.from("a"), paragraphs: null }), null);
  assert.deepEqual(recorder.summary(), { documents: 0, added: 0, fileChanged: [], textChanged: [] });
});

test("the recorder saves a change at most once per interval and at flush, and reports only this run's changes", async () => {
  const path = await temporaryPath();
  let clock = 0;
  const first = createPspDocumentRecorder(path, "2026-10-01", { saveIntervalMs: 30_000, now: () => clock });
  first.record({ url: url(20), bytes: Buffer.from("a"), paragraphs: ["x"] });
  assert.deepEqual(loadPspDocumentHashes(path).documents, {}, "not saved before the interval");
  clock = 30_000;
  first.record({ url: url(3), bytes: Buffer.from("b"), paragraphs: ["y"] });
  // Saved once the interval passed, so a stopped step keeps it.
  assert.deepEqual(Object.keys(loadPspDocumentHashes(path).documents), ["3", "20"]);
  first.record({ url: url(3), bytes: Buffer.from("c"), paragraphs: ["y"] });
  assert.equal(loadPspDocumentHashes(path).documents["3"].length, 1);
  first.flush();
  assert.equal(loadPspDocumentHashes(path).documents["3"].length, 2);
  assert.deepEqual(first.summary(), { documents: 2, added: 2, fileChanged: ["3"], textChanged: [] });

  const second = createPspDocumentRecorder(path, "2026-10-02", { saveIntervalMs: 0 });
  second.record({ url: url(3), bytes: Buffer.from("c"), paragraphs: ["y"] });
  second.record({ url: url(20), bytes: Buffer.from("a"), paragraphs: ["z"] });
  assert.deepEqual(second.summary(), { documents: 2, added: 0, fileChanged: [], textChanged: ["20"] });
  assert.equal(loadPspDocumentHashes(path).documents["3"][1].lastSeen, "2026-10-02");
});

test("a timer saves a change even when no further download comes", async () => {
  const path = await temporaryPath();
  const recorder = createPspDocumentRecorder(path, "2026-10-01", { saveIntervalMs: 40 });
  recorder.record({ url: url(9), bytes: Buffer.from("a"), paragraphs: ["x"] });
  assert.deepEqual(loadPspDocumentHashes(path).documents, {});
  await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  assert.deepEqual(Object.keys(loadPspDocumentHashes(path).documents), ["9"]);
  recorder.flush();
});

test("a record that cannot be saved never fails the download it describes, but fails flush", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-documents-"));
  const recorder = createPspDocumentRecorder(join(directory, "hashes.json"), "2026-10-01", { saveIntervalMs: 0 });
  // A directory in the place of the temporary file makes every save fail.
  await mkdir(join(directory, ".hashes.json.tmp"));
  assert.equal(recorder.record({ url: url(1), bytes: Buffer.from("a"), paragraphs: ["x"] }), "new");
  assert.deepEqual(recorder.summary(), { documents: 1, added: 1, fileChanged: [], textChanged: [] });
  assert.throws(() => recorder.flush(), /psp\.cz document hashes could not be saved/);
  const saved = createPspDocumentRecorder(join(directory, "other.json"), "2026-10-01");
  saved.record({ url: url(1), bytes: Buffer.from("a"), paragraphs: ["x"] });
  saved.flush();
});

test("an ID whose file changed in a run is never also listed as text-only", async () => {
  const recorder = createPspDocumentRecorder(await temporaryPath(), "2026-10-01");
  recorder.record({ url: url(7), bytes: Buffer.from("a"), paragraphs: ["x"] });
  recorder.record({ url: url(7), bytes: Buffer.from("b"), paragraphs: ["x"] });
  recorder.record({ url: url(7), bytes: Buffer.from("b"), paragraphs: ["y"] });
  recorder.record({ url: url(8), bytes: Buffer.from("c"), paragraphs: ["x"] });
  recorder.record({ url: url(8), bytes: Buffer.from("c"), paragraphs: ["y"] });
  recorder.record({ url: url(8), bytes: Buffer.from("d"), paragraphs: ["y"] });
  assert.deepEqual(recorder.summary(), { documents: 2, added: 2, fileChanged: ["7", "8"], textChanged: [] });
});

test("a damaged record fails when it is loaded, with its path, before any download", async () => {
  const path = await temporaryPath();
  const recorder = createPspDocumentRecorder(path, "2026-10-01");
  recorder.record({ url: url(1), bytes: Buffer.from("a"), paragraphs: ["x"] });
  recorder.flush();
  const valid = JSON.parse(await readFile(path, "utf8"));
  for (const documents of [[], { 1: {} }, { 1: [] }, { 1: [{ ...valid.documents[1][0], lastSeen: undefined }] }, { x: valid.documents[1] }]) {
    await writeFile(path, JSON.stringify({ ...valid, documents }));
    assert.throws(() => createPspDocumentRecorder(path, "2026-10-02"), /Invalid psp\.cz document hashes: .*hashes\.json/);
  }
  await writeFile(path, "{ truncated");
  assert.throws(() => createPspDocumentRecorder(path, "2026-10-02"), /Invalid psp\.cz document hashes: .*hashes\.json/);
});
