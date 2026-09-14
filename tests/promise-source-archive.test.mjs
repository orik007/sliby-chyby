import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { z } from "zod";

const root = new URL("../", import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"));
const manifestSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  entries: z.array(z.object({
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    originalUrl: httpsUrl,
    retrievedUrl: httpsUrl,
    retrievedAt: z.string().datetime(),
    mediaType: z.literal("application/pdf"),
    byteLength: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    path: z.string().regex(/^archive\/promise-sources\/\d{4}\/[a-z0-9-]+\/[a-f0-9]{64}\.pdf$/),
  }).strict()).min(1),
}).strict();

function validateEntrySource(entry, required) {
  assert.ok(required.has(entry.sourceId), `Unknown archive source: ${entry.sourceId}`);
  assert.equal(entry.originalUrl, required.get(entry.sourceId), `Source URL mismatch: ${entry.sourceId}`);
}

function validateInventory(actual, expected) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), "Archive files must match the manifest");
}

async function archiveFiles(directory) {
  const paths = [];
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...await archiveFiles(path));
    else if (!["archive/promise-sources/README.md", "archive/promise-sources/manifest.json"].includes(path)) paths.push(path);
  }
  return paths;
}

test("archive rejects unknown sources, mismatched URLs, and unmanifested files", () => {
  const required = new Map([["source", "https://example.org/programme.pdf"]]);
  assert.throws(() => validateEntrySource({ sourceId: "unknown", originalUrl: required.get("source") }, required), /Unknown archive source/);
  assert.throws(() => validateEntrySource({ sourceId: "source", originalUrl: "https://example.org/other.pdf" }, required), /Source URL mismatch/);
  assert.throws(() => validateInventory(["listed.pdf", "unlisted.pdf"], ["listed.pdf"]), /Archive files must match/);
});

test("promise source archive is complete and preserves verified original bytes", async () => {
  const manifest = manifestSchema.parse(await json("archive/promise-sources/manifest.json"));
  const research = await json("research/2025-election/promises.json");
  const required = new Map(research.sources.map((source) => [source.id, source.url]));
  for (const filename of await readdir(new URL("data/promises/", root))) {
    if (!filename.endsWith(".json")) continue;
    const promise = await json(`data/promises/${filename}`);
    const source = await json(`data/sources/${promise.primarySourceId}.json`);
    if (required.has(source.id)) assert.equal(required.get(source.id), source.url);
    required.set(source.id, source.url);
  }
  const paths = new Set();
  for (const entry of manifest.entries) {
    validateEntrySource(entry, required);
    assert.equal(paths.has(entry.path), false, `Duplicate archive path: ${entry.path}`);
    paths.add(entry.path);
    assert.ok(entry.path.endsWith(`/${entry.sourceId}/${entry.sha256}.pdf`));
    const bytes = await readFile(new URL(entry.path, root));
    assert.equal(bytes.length, entry.byteLength, entry.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.path);
    assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-", entry.path);
    assert.match(bytes.subarray(-1024).toString("ascii"), /%%EOF/, entry.path);
  }
  validateInventory(await archiveFiles("archive/promise-sources"), paths);
  for (const [sourceId, url] of required) {
    assert.ok(manifest.entries.some((entry) => entry.sourceId === sourceId && entry.originalUrl === url),
      `Missing archived original for ${sourceId}: ${url}`);
  }
});
