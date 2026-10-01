import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadPspDocumentHashes, pspDocumentId, recordPspDocument, savePspDocumentHashes, summarizePspDocumentHashes } from "../scripts/lib/psp-document-hashes.mjs";

const url = (id) => `https://www.psp.cz/sqw/text/orig2.sqw?idd=${id}`;

test("the same file under one document ID keeps one observation and extends its last date", () => {
  const hashes = loadPspDocumentHashes("/nonexistent/hashes.json");
  recordPspDocument(hashes, { url: url(266237), bytes: Buffer.from("a"), paragraphs: ["ZÁKON"], seenOn: "2026-10-01" });
  recordPspDocument(hashes, { url: url(266237), bytes: Buffer.from("a"), paragraphs: ["ZÁKON"], seenOn: "2026-10-03" });
  assert.equal(hashes.documents["266237"].length, 1);
  assert.equal(hashes.documents["266237"][0].firstSeen, "2026-10-01");
  assert.equal(hashes.documents["266237"][0].lastSeen, "2026-10-03");
  assert.deepEqual(summarizePspDocumentHashes(hashes), { documents: 1, fileChanged: [], textChanged: [] });
});

test("a changed file or text under one document ID is a new observation and is reported", () => {
  const hashes = loadPspDocumentHashes("/nonexistent/hashes.json");
  recordPspDocument(hashes, { url: url(1), bytes: Buffer.from("a"), paragraphs: ["x"], seenOn: "2026-10-01" });
  recordPspDocument(hashes, { url: url(1), bytes: Buffer.from("b"), paragraphs: ["x"], seenOn: "2026-10-02" });
  recordPspDocument(hashes, { url: url(2), bytes: Buffer.from("c"), paragraphs: ["x"], seenOn: "2026-10-01" });
  recordPspDocument(hashes, { url: url(2), bytes: Buffer.from("d"), paragraphs: ["y"], seenOn: "2026-10-02" });
  recordPspDocument(hashes, { url: url(3), bytes: Buffer.from("e"), paragraphs: null, seenOn: "2026-10-01" });
  assert.equal(hashes.documents["1"].length, 2);
  assert.equal(hashes.documents["3"][0].textSha256, null);
  assert.deepEqual(summarizePspDocumentHashes(hashes), { documents: 3, fileChanged: ["1", "2"], textChanged: ["2"] });
});

test("document hashes are saved sorted by ID and load back", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "psp-documents-")), "nested", "hashes.json");
  const hashes = loadPspDocumentHashes(path);
  recordPspDocument(hashes, { url: url(20), bytes: Buffer.from("a"), paragraphs: ["x"], seenOn: "2026-10-01" });
  recordPspDocument(hashes, { url: url(3), bytes: Buffer.from("b"), paragraphs: ["y"], seenOn: "2026-10-01" });
  savePspDocumentHashes(path, hashes);
  assert.deepEqual(Object.keys(JSON.parse(await readFile(path, "utf8")).documents), ["3", "20"]);
  assert.deepEqual(loadPspDocumentHashes(path).documents, hashes.documents);
});

test("a file without a numeric document ID is left out of the record", () => {
  assert.equal(pspDocumentId(`${url(269526)}&x=1`), "269526");
  const hashes = loadPspDocumentHashes("/nonexistent/hashes.json");
  recordPspDocument(hashes, { url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=", bytes: Buffer.from("a"), paragraphs: null, seenOn: "2026-10-01" });
  assert.deepEqual(hashes.documents, {});
});
