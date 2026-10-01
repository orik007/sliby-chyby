import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPspDocumentRecorder, loadPspDocumentHashes, pspDocumentId, recordPspDocument } from "../scripts/lib/psp-document-hashes.mjs";

const url = (id) => `https://www.psp.cz/sqw/text/orig2.sqw?idd=${id}`;
const empty = () => loadPspDocumentHashes("/nonexistent/hashes.json");
const temporaryPath = async () => join(await mkdtemp(join(tmpdir(), "psp-documents-")), "nested", "hashes.json");

test("the same file under one document ID keeps one observation and extends its last date", () => {
  const hashes = empty();
  assert.equal(recordPspDocument(hashes, { url: url(266237), bytes: Buffer.from("a"), paragraphs: ["ZÁKON"], seenOn: "2026-10-01" }), "new");
  assert.equal(recordPspDocument(hashes, { url: url(266237), bytes: Buffer.from("a"), paragraphs: ["ZÁKON"], seenOn: "2026-10-03" }), "same");
  assert.deepEqual(hashes.documents["266237"].map(({ firstSeen, lastSeen }) => [firstSeen, lastSeen]), [["2026-10-01", "2026-10-03"]]);
});

test("a changed file and a text changed under the same file are told apart", () => {
  const hashes = empty();
  recordPspDocument(hashes, { url: url(1), bytes: Buffer.from("a"), paragraphs: ["x"], seenOn: "2026-10-01" });
  assert.equal(recordPspDocument(hashes, { url: url(1), bytes: Buffer.from("b"), paragraphs: ["x"], seenOn: "2026-10-02" }), "file-changed");
  assert.equal(recordPspDocument(hashes, { url: url(1), bytes: Buffer.from("b"), paragraphs: ["y"], seenOn: "2026-10-03" }), "text-changed");
  assert.equal(hashes.documents["1"].length, 3);
  assert.equal(recordPspDocument(hashes, { url: url(2), bytes: Buffer.from("c"), paragraphs: null, seenOn: "2026-10-01" }), "new");
  assert.equal(hashes.documents["2"][0].textSha256, null);
});

test("a file without a numeric document ID is left out of the record", () => {
  assert.equal(pspDocumentId(`${url(269526)}&x=1`), "269526");
  const hashes = empty();
  assert.equal(recordPspDocument(hashes, { url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=", bytes: Buffer.from("a"), paragraphs: null, seenOn: "2026-10-01" }), null);
  assert.deepEqual(hashes.documents, {});
});

test("the recorder saves after every download and reports only this run's changes", async () => {
  const path = await temporaryPath();
  const first = createPspDocumentRecorder(path, "2026-10-01");
  first.record({ url: url(20), bytes: Buffer.from("a"), paragraphs: ["x"] });
  // Saved at once, before the run ends, so a stopped step keeps it.
  assert.deepEqual(Object.keys(loadPspDocumentHashes(path).documents), ["20"]);
  first.record({ url: url(3), bytes: Buffer.from("b"), paragraphs: ["y"] });
  first.record({ url: url(3), bytes: Buffer.from("c"), paragraphs: ["y"] });
  assert.deepEqual(first.summary(), { documents: 2, added: 2, fileChanged: ["3"], textChanged: [] });
  assert.deepEqual(Object.keys(JSON.parse(await readFile(path, "utf8")).documents), ["3", "20"]);

  const second = createPspDocumentRecorder(path, "2026-10-02");
  second.record({ url: url(3), bytes: Buffer.from("c"), paragraphs: ["y"] });
  second.record({ url: url(20), bytes: Buffer.from("a"), paragraphs: ["z"] });
  assert.deepEqual(second.summary(), { documents: 2, added: 0, fileChanged: [], textChanged: ["20"] });
  assert.equal(loadPspDocumentHashes(path).documents["3"][1].lastSeen, "2026-10-02");
});

test("a damaged record fails when it is loaded, before any download", async () => {
  const path = await temporaryPath();
  const recorder = createPspDocumentRecorder(path, "2026-10-01");
  recorder.record({ url: url(1), bytes: Buffer.from("a"), paragraphs: ["x"] });
  const valid = JSON.parse(await readFile(path, "utf8"));
  for (const documents of [[], { 1: {} }, { 1: [] }, { 1: [{ ...valid.documents[1][0], lastSeen: undefined }] }, { x: valid.documents[1] }]) {
    await writeFile(path, JSON.stringify({ ...valid, documents }));
    assert.throws(() => createPspDocumentRecorder(path, "2026-10-02"), /Invalid psp\.cz document hashes/);
  }
});
