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
// The age in days of a last valid copy that may stand in for a whole archive.
export const maxStandInAgeDays = 7;

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

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The archives in `directory` on the run date `today`. `resolve(name,
 * download)` returns `{ entries, origin, note }`: the files of the archive
 * `download()` returns when every one of them is valid, and that archive is
 * saved as the last valid copy (`origin` "downloaded"); otherwise each
 * damaged file taken from the last valid copy when that copy holds a file
 * of the same name, CRC-32, and size, the same content ("repaired"); otherwise
 * the whole last valid copy, when it is at most `maxStandInAgeDays` old
 * ("stand-in"), also when the download fails. Anything else fails.
 */
export function createOpenDataArchiveCache(directory, today) {
  const paths = (name) => ({ archive: join(directory, `${name}.zip`), record: join(directory, `${name}.json`) });
  const stored = (name) => {
    const { archive, record } = paths(name);
    if (!existsSync(archive) || !existsSync(record)) return null;
    const meta = JSON.parse(readFileSync(record, "utf8"));
    const bytes = new Uint8Array(readFileSync(archive));
    invariant(meta.schemaVersion === openDataArchiveVersion && meta.sha256 === sha256(bytes) && /^\d{4}-\d{2}-\d{2}$/.test(meta.retrievedOn ?? ""), `Invalid last valid copy of the open-data archive ${name}: ${record}`);
    const files = readArchive(bytes);
    invariant(files.every(({ data }) => data), `The last valid copy of the open-data archive ${name} is damaged: ${archive}`);
    return { meta, files };
  };
  const save = (name, bytes, url) => {
    mkdirSync(directory, { recursive: true });
    const { archive, record } = paths(name);
    writeFileSync(`${archive}.tmp`, bytes);
    renameSync(`${archive}.tmp`, archive);
    writeFileSync(record, `${JSON.stringify({ schemaVersion: openDataArchiveVersion, name, url, retrievedOn: today, sha256: sha256(bytes) })}\n`);
  };
  const entriesOf = (files) => Object.fromEntries(files.map(({ name, data }) => [name, data]));
  return {
    async resolve(name, download) {
      let response = null;
      let failure = null;
      try {
        response = await download();
      } catch (error) {
        failure = error;
      }
      let files = null;
      if (response) {
        try {
          files = readArchive(response.bytes);
        } catch (error) {
          failure = error;
        }
      }
      if (files && files.every(({ data }) => data)) {
        save(name, response.bytes, response.finalUrl);
        return { entries: entriesOf(files), origin: "downloaded", note: null, response };
      }
      const copy = stored(name);
      const damaged = files ? files.filter(({ data }) => !data).map(({ name: fileName }) => fileName) : null;
      if (files && copy) {
        const repaired = files.map((file) => file.data ? file : { ...file, data: copy.files.find((kept) => kept.name === file.name && kept.crc === file.crc && kept.size === file.size)?.data ?? null });
        if (repaired.every(({ data }) => data)) {
          return { entries: entriesOf(repaired), origin: "repaired", note: `${name}: ${damaged.join(", ")} damaged in today's archive; taken from the valid copy of ${copy.meta.retrievedOn}, which has the same CRC-32 and size`, response };
        }
      }
      const reason = failure ? `could not be read (${failure instanceof Error ? failure.message : String(failure)})` : `has damaged files (${damaged.join(", ")})`;
      invariant(copy, `The open-data archive ${name} ${reason}, and there is no valid copy to use`);
      const age = daysBetween(copy.meta.retrievedOn, today);
      invariant(age <= maxStandInAgeDays, `The open-data archive ${name} ${reason}, and its last valid copy, of ${copy.meta.retrievedOn}, is ${age} days old (at most ${maxStandInAgeDays})`);
      return { entries: entriesOf(copy.files), origin: "stand-in", note: `${name}: today's archive ${reason}; the whole valid copy of ${copy.meta.retrievedOn} is used`, response: null, storedUrl: copy.meta.url };
    }
  };
}
