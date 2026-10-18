import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPspDocumentCache, pspDocumentId } from "../scripts/lib/psp-document-cache.mjs";

const url = (id) => `https://www.psp.cz/sqw/text/orig2.sqw?idd=${id}`;
const bytesOf = (text) => new TextEncoder().encode(text);

test("reads a file under a document ID once and keeps its text for every later run", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-documents-"));
  let downloads = 0;
  const download = (text) => async () => {
    downloads += 1;
    return bytesOf(text);
  };
  const extract = (bytes) => new TextDecoder().decode(bytes).split("\n");
  const first = createPspDocumentCache(directory, "2026-10-18");
  assert.deepEqual((await first.read(url(1), "lines-v1", extract, download("a\nb"))).value, ["a", "b"]);
  const second = createPspDocumentCache(directory, "2026-10-19");
  const cached = await second.read(url(1), "lines-v1", extract, download("a\nb"));
  assert.deepEqual({ value: cached.value, downloaded: cached.downloaded }, { value: ["a", "b"], downloaded: false });
  assert.equal(downloads, 1);
  // Another extraction reads the file again, which must still be the same.
  assert.deepEqual((await second.read(url(1), "upper-v1", (bytes) => new TextDecoder().decode(bytes).toUpperCase(), download("a\nb"))).value, "A\nB");
  await assert.rejects(second.read(url(1), "other-v1", extract, download("changed")), /changed under the same ID/);
  // An extraction that fails is kept with its reason, like a text.
  const unreadable = await second.read(url(2), "lines-v1", () => {
    throw new Error("no paragraphs");
  }, download("x"));
  assert.deepEqual({ value: unreadable.value, error: unreadable.error }, { value: null, error: "no paragraphs" });
  assert.deepEqual((await readdir(directory)).sort(), ["1.json", "2.json"]);
  const entry = JSON.parse(await readFile(join(directory, "1.json"), "utf8"));
  assert.deepEqual(Object.keys(entry.extractions).sort(), ["lines-v1", "upper-v1"]);
  assert.equal(entry.readOn, "2026-10-18");
});

test("downloads again the files checked longest ago and fails when one changed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-documents-"));
  const cache = createPspDocumentCache(directory, "2026-10-18");
  for (const id of [3, 1, 2]) await cache.read(url(id), "v1", () => "text", async () => bytesOf(`file ${id}`));
  const later = createPspDocumentCache(directory, "2026-10-19");
  assert.deepEqual(await later.checkSample(async (fileUrl) => bytesOf(`file ${pspDocumentId(fileUrl)}`), 2), ["1", "2"]);
  // The next check starts with the one checked longest ago.
  const next = createPspDocumentCache(directory, "2026-10-20");
  await assert.rejects(next.checkSample(async () => bytesOf("another file"), 1), /psp\.cz document 3 changed under the same ID/);
});

test("refuses a damaged cache entry before anything is read", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-documents-"));
  await writeFile(join(directory, "5.json"), "{}\n");
  assert.throws(() => createPspDocumentCache(directory, "2026-10-18"), /Invalid psp\.cz document cache entry/);
});
