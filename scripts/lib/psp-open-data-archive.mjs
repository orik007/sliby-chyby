import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { inflateSync } from "fflate";
import { invariant, sha256 } from "./collector-core.mjs";

/**
 * The Chamber's open-data archives and the last valid copy of each, kept in
 * the audit state under the rule in docs/evidence-pipeline.md (Chamber data
 * rules, Open-data files).
 */
export const openDataArchiveVersion = "psp-open-data-archive-v1";

/**
 * Every file of a ZIP archive by its central directory: `{ name, crc, size,
 * data }`, `data` null when the file cannot be inflated or its CRC-32 or size
 * differs from the directory's. Throws when the directory itself cannot be read.
 */
export function readArchive(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 22 - 65_535); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  invariant(end >= 0, "ZIP archive has no end of central directory");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  invariant(count > 0 && count < 100, "ZIP archive has an unsafe entry count");
  const files = [];
  for (let index = 0; index < count; index += 1) {
    invariant(offset + 46 <= bytes.byteLength && view.getUint32(offset, true) === 0x02014b50, "ZIP central directory is damaged");
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    invariant(size < 150_000_000, `ZIP archive file ${name} exceeds the size limit`);
    files.push({ name, crc, size, data: fileData(bytes, view, { method, crc, size, compressedSize, localOffset }) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function fileData(bytes, view, { method, crc, size, compressedSize, localOffset }) {
  try {
    if (localOffset + 30 > bytes.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) return null;
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const compressed = bytes.subarray(start, start + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? inflateSync(compressed, { out: new Uint8Array(size) }) : null;
    return data && data.byteLength === size && crc32(data) >>> 0 === crc ? data : null;
  } catch {
    return null;
  }
}

/**
 * The archives in `directory` on the run date `today`. `resolve(name,
 * download)` returns `{ entries, origin, note, response }` for the archive
 * `download()` returns (a failed download fails, as before): its files when
 * every one of them is valid, and that archive is saved as the last valid
 * copy (`origin` "downloaded"); otherwise each damaged file taken from the
 * last valid copy when that copy holds a file of the same name, CRC-32, and
 * size, which is the same content ("repaired"). Anything else fails.
 */
export function createOpenDataArchiveCache(directory, today) {
  const paths = (name) => ({ archive: join(directory, `${name}.zip`), record: join(directory, `${name}.json`) });
  // A copy whose record does not match it (a run stopped while saving it) is
  // no copy.
  const stored = (name) => {
    const { archive, record } = paths(name);
    if (!existsSync(archive) || !existsSync(record)) return null;
    const meta = JSON.parse(readFileSync(record, "utf8"));
    const bytes = new Uint8Array(readFileSync(archive));
    if (meta.schemaVersion !== openDataArchiveVersion || meta.sha256 !== sha256(bytes)) return null;
    const files = readArchive(bytes);
    return files.every(({ data }) => data) ? { meta, files } : null;
  };
  const save = (name, bytes, url) => {
    mkdirSync(directory, { recursive: true });
    const { archive, record } = paths(name);
    writeFileSync(`${archive}.tmp`, bytes);
    writeFileSync(`${record}.tmp`, `${JSON.stringify({ schemaVersion: openDataArchiveVersion, name, url, retrievedOn: today, sha256: sha256(bytes) })}\n`);
    renameSync(`${archive}.tmp`, archive);
    renameSync(`${record}.tmp`, record);
  };
  const entriesOf = (files) => Object.fromEntries(files.map(({ name, data }) => [name, data]));
  return {
    async resolve(name, download) {
      const response = await download();
      const files = readArchive(response.bytes);
      invariant(files.reduce((sum, { size }) => sum + size, 0) < 150_000_000, `Archive ${name} exceeds the uncompressed size limit`);
      if (files.every(({ data }) => data)) {
        save(name, response.bytes, response.finalUrl);
        return { entries: entriesOf(files), origin: "downloaded", note: null, response };
      }
      const damaged = files.filter(({ data }) => !data).map(({ name: fileName }) => fileName);
      const copy = stored(name);
      const repaired = files.map((file) => file.data ? file : { ...file, data: copy?.files.find((kept) => kept.name === file.name && kept.crc === file.crc && kept.size === file.size)?.data ?? null });
      invariant(repaired.every(({ data }) => data), `The open-data archive ${name} has damaged files (${damaged.join(", ")}), and ${copy ? `its last valid copy, of ${copy.meta.retrievedOn}, has no file of the same size and CRC-32 for ${repaired.filter(({ data }) => !data).map(({ name: fileName }) => fileName).join(", ")}` : "there is no valid copy of it"}`);
      return { entries: entriesOf(repaired), origin: "repaired", note: `${name}: ${damaged.join(", ")} damaged in today's archive; taken from the valid copy of ${copy.meta.retrievedOn}, which has the same CRC-32 and size`, response };
    }
  };
}
