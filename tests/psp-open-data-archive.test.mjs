import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { createOpenDataArchiveCache, readArchive } from "../scripts/lib/psp-open-data-archive.mjs";

const archive = (files) => zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])), { level: 6 });
const text = (entries, name) => new TextDecoder().decode(entries[name]);
// The bytes of an archive with the compressed data of one file overwritten,
// as in the poslanci.zip psp.cz served on 19 October 2026.
function damaged(bytes, name) {
  const copy = new Uint8Array(bytes);
  const file = readArchive(copy).findIndex((entry) => entry.name === name);
  const view = new DataView(copy.buffer);
  let offset = 0;
  for (let index = 0; index <= file; index += 1) {
    while (view.getUint32(offset, true) !== 0x04034b50) offset += 1;
    if (index < file) offset += 4;
  }
  const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
  copy.fill(0xff, start, start + 8);
  return copy;
}

const members = { "poslanec.unl": "1|2|3|\n".repeat(200), "osoby.unl": "2|Novák|Jan|\n".repeat(200) };

test("reads every file of an archive and marks the one that does not inflate to its size and CRC-32", () => {
  const files = readArchive(damaged(archive(members), "poslanec.unl"));
  assert.deepEqual(files.map(({ name, data }) => [name, Boolean(data)]), [["poslanec.unl", false], ["osoby.unl", true]]);
});

test("keeps a valid archive and repairs a damaged file of the same size and CRC-32 from it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-open-data-"));
  const valid = archive(members);
  const first = await createOpenDataArchiveCache(directory, "2026-10-18").resolve("members", async () => ({ bytes: valid, finalUrl: "https://www.psp.cz/eknih/cdrom/opendata/poslanci.zip" }));
  assert.equal(first.origin, "downloaded");
  assert.deepEqual(new Uint8Array(await readFile(join(directory, "members.zip"))), valid);
  const repaired = await createOpenDataArchiveCache(directory, "2026-10-19").resolve("members", async () => ({ bytes: damaged(valid, "poslanec.unl"), finalUrl: "x" }));
  assert.equal(repaired.origin, "repaired");
  assert.equal(text(repaired.entries, "poslanec.unl"), members["poslanec.unl"]);
  assert.match(repaired.note, /poslanec\.unl damaged .* valid copy of 2026-10-18/);
  // The damaged archive is not kept.
  assert.deepEqual(new Uint8Array(await readFile(join(directory, "members.zip"))), valid);
});

test("fails on a damaged file whose content changed, without a copy, and on a failed download", async () => {
  const directory = await mkdtemp(join(tmpdir(), "psp-open-data-"));
  await createOpenDataArchiveCache(directory, "2026-10-18").resolve("members", async () => ({ bytes: archive(members), finalUrl: "x" }));
  const changed = damaged(archive({ ...members, "poslanec.unl": "1|2|4|\n".repeat(200) }), "poslanec.unl");
  const cache = createOpenDataArchiveCache(directory, "2026-10-19");
  await assert.rejects(cache.resolve("members", async () => ({ bytes: changed, finalUrl: "x" })), /no file of the same size and CRC-32 for poslanec\.unl/);
  // A proxy refusal, or any other failed download, still fails the run.
  await assert.rejects(cache.resolve("members", async () => {
    throw new Error("psp.cz proxy refused the request (HTTP 407)");
  }), /HTTP 407/);
  const empty = await mkdtemp(join(tmpdir(), "psp-open-data-"));
  await assert.rejects(createOpenDataArchiveCache(empty, "2026-10-19").resolve("members", async () => ({ bytes: changed, finalUrl: "x" })), /no valid copy of it/);
});

test("the first copy of poslanci.zip in the repository is valid", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../automation/psp-open-data/members.zip", import.meta.url)));
  const files = readArchive(bytes);
  assert.ok(files.every(({ data }) => data));
  assert.ok(files.some(({ name }) => name === "poslanec.unl"));
});
