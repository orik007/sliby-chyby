import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { inflateSync } from "fflate";
import { isoDate } from "./audit-cache-entries.mjs";
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
export function readArchive(bytes, label = "ZIP archive") {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 22 - 65_535); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  invariant(end >= 0, `${label} has no end of central directory`);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  invariant(count > 0 && count < 100, `${label} has an unsafe entry count`);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    invariant(offset + 46 <= bytes.byteLength && view.getUint32(offset, true) === 0x02014b50, `${label}: its central directory is damaged`);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.push({ name, crc, size, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  // The sizes the directory states, before anything is inflated.
  invariant(entries.reduce((sum, { size }) => sum + size, 0) < 150_000_000, `${label} exceeds the uncompressed size limit`);
  return entries.map(({ name, crc, size, ...location }) => ({ name, crc, size, data: fileData(bytes, view, { crc, size, ...location }) }));
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
 * The archives in `directory` on the run date `today`. `resolve(key,
 * download)` returns `{ entries, origin, note, response, copy }` for the
 * archive `download()` returns (a failed download fails, as before), `key`
 * naming the source and archive ("psp-core-2025-members"): its files when
 * every one of them is valid, and that archive is saved as the last valid
 * copy (`origin` "downloaded"); otherwise each damaged file taken from the
 * last valid copy when that copy holds a file of the same name, CRC-32, and
 * size, which is the same content ("repaired", `copy` naming that copy).
 * Anything else fails. A copy is saved under its SHA-256, and its record is
 * replaced last, so a run stopped while saving keeps the previous copy.
 */
export function createOpenDataArchiveCache(directory, today) {
  invariant(isoDate.test(today), "The open-data archive cache needs the run date");
  const recordPath = (key) => join(directory, `${key}.json`);
  // A missing, unreadable, or mismatched copy is no copy.
  const stored = (key) => {
    let meta = null;
    try {
      meta = JSON.parse(readFileSync(recordPath(key), "utf8"));
    } catch {
      return null;
    }
    const archive = join(directory, String(meta?.archive ?? ""));
    if (meta?.schemaVersion !== openDataArchiveVersion || !/^[a-z0-9-]+\.zip$/.test(meta.archive ?? "") || !existsSync(archive)) return null;
    const bytes = new Uint8Array(readFileSync(archive));
    if (meta.sha256 !== sha256(bytes)) return null;
    const files = readArchive(bytes, `the last valid copy of ${key}`);
    return files.every(({ data }) => data) ? { meta, files } : null;
  };
  const save = (key, bytes, url, hash) => {
    mkdirSync(directory, { recursive: true });
    const previous = stored(key)?.meta.archive ?? null;
    const archive = `${key}-${hash.slice(0, 16)}.zip`;
    writeFileSync(join(directory, `.${archive}.tmp`), bytes);
    renameSync(join(directory, `.${archive}.tmp`), join(directory, archive));
    writeFileSync(join(directory, `.${key}.json.tmp`), `${JSON.stringify({ schemaVersion: openDataArchiveVersion, key, url, retrievedOn: today, sha256: hash, archive })}\n`);
    renameSync(join(directory, `.${key}.json.tmp`), recordPath(key));
    if (previous && previous !== archive) rmSync(join(directory, previous), { force: true });
  };
  const entriesOf = (files) => Object.fromEntries(files.map(({ name, data }) => [name, data]));
  return {
    async resolve(key, download) {
      const response = await download();
      const files = readArchive(response.bytes, `The open-data archive ${key}`);
      if (files.every(({ data }) => data)) {
        save(key, response.bytes, response.finalUrl, /^[a-f0-9]{64}$/.test(response.contentHash ?? "") ? response.contentHash : sha256(response.bytes));
        return { entries: entriesOf(files), origin: "downloaded", note: null, response, copy: null };
      }
      const damaged = files.filter(({ data }) => !data);
      const copy = stored(key);
      const repaired = files.map((file) => file.data ? file : { ...file, data: copy?.files.find((kept) => kept.name === file.name && kept.crc === file.crc && kept.size === file.size)?.data ?? null });
      invariant(repaired.every(({ data }) => data), `The open-data archive ${key} has damaged files (${damaged.map(({ name }) => name).join(", ")}), and ${copy ? `its last valid copy, of ${copy.meta.retrievedOn}, has no file of the same name, size, and CRC-32 for ${repaired.filter(({ data }) => !data).map(({ name }) => name).join(", ")}` : "there is no valid copy of it"}`);
      return {
        entries: entriesOf(repaired),
        origin: "repaired",
        note: `${key}: ${damaged.map(({ name }) => name).join(", ")} damaged in today's archive; taken from the valid copy of ${copy.meta.retrievedOn} (SHA-256 ${copy.meta.sha256}), which has the same name, size, and CRC-32`,
        response,
        copy: { retrievedOn: copy.meta.retrievedOn, sha256: copy.meta.sha256, files: damaged.map(({ name, size, crc }) => ({ name, size, crc: crc.toString(16).padStart(8, "0") })) }
      };
    }
  };
}
