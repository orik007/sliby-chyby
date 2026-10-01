import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { invariant, sha256 } from "./collector-core.mjs";

/**
 * Every distinct content seen under each psp.cz document ID (`idd` of
 * `orig2.sqw`), kept in the audit state to find out whether psp.cz ever
 * changes a file without giving it a new ID (docs/evidence-pipeline.md,
 * Chamber data rules). It only records; nothing is read from it to skip a
 * download.
 *
 * The file maps each ID to its observations, one per distinct pair of the
 * file's SHA-256 and the SHA-256 of its extracted paragraphs (null when the
 * file could not be read as text), with the first and last run date it was
 * seen. One observation per ID means the ID has never changed.
 */
export const pspDocumentHashesVersion = "psp-document-hashes-v1";

const hexHash = /^[0-9a-f]{64}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

// The numeric document ID of an orig2.sqw URL, or null without one.
export function pspDocumentId(url) {
  const id = new URL(url).searchParams.get("idd");
  return /^\d+$/.test(id ?? "") ? id : null;
}

function isObservation(entry) {
  return hexHash.test(entry?.fileSha256 ?? "")
    && (entry.textSha256 === null || hexHash.test(entry.textSha256 ?? ""))
    && isoDate.test(entry.firstSeen ?? "") && isoDate.test(entry.lastSeen ?? "");
}

// The whole file is checked before a run downloads anything, so a damaged
// record fails at once with its path rather than in the middle of a run.
export function loadPspDocumentHashes(path) {
  if (!existsSync(path)) return { schemaVersion: pspDocumentHashesVersion, documents: {} };
  const stored = JSON.parse(readFileSync(path, "utf8"));
  const documents = stored?.documents;
  invariant(stored?.schemaVersion === pspDocumentHashesVersion && documents && typeof documents === "object" && !Array.isArray(documents)
    && Object.entries(documents).every(([id, observations]) => /^\d+$/.test(id) && Array.isArray(observations) && observations.length > 0 && observations.every(isObservation)),
  `Invalid psp.cz document hashes: ${path}`);
  return stored;
}

/**
 * Records one download, the file's bytes and, when it was read as text, its
 * paragraphs, on the run date `seenOn` (YYYY-MM-DD). Returns "new" for an ID
 * not seen before, "file-changed" for a known ID with a file not seen before
 * under it, "text-changed" for a known file whose extracted text differs
 * (which the extraction code alone can cause), "same" otherwise, and null
 * for a URL without a document ID, which is left out.
 */
export function recordPspDocument(hashes, { url, bytes, paragraphs, seenOn }) {
  const id = pspDocumentId(url);
  if (!id) return null;
  const fileSha256 = sha256(bytes);
  const textSha256 = paragraphs ? sha256(Buffer.from(paragraphs.join("\n"))) : null;
  const observations = hashes.documents[id];
  if (!observations) {
    hashes.documents[id] = [{ fileSha256, textSha256, firstSeen: seenOn, lastSeen: seenOn }];
    return "new";
  }
  const known = observations.find((entry) => entry.fileSha256 === fileSha256 && entry.textSha256 === textSha256);
  if (known) {
    if (seenOn > known.lastSeen) known.lastSeen = seenOn;
    return "same";
  }
  const fileKnown = observations.some((entry) => entry.fileSha256 === fileSha256);
  observations.push({ fileSha256, textSha256, firstSeen: seenOn, lastSeen: seenOn });
  return fileKnown ? "text-changed" : "file-changed";
}

// Written to a temporary file and renamed, so a run stopped mid-write
// leaves the previous complete record.
export function savePspDocumentHashes(path, hashes) {
  mkdirSync(dirname(path), { recursive: true });
  const documents = Object.fromEntries(Object.entries(hashes.documents).sort(([left], [right]) => Number(left) - Number(right)));
  writeFileSync(`${path}.tmp`, `${JSON.stringify({ schemaVersion: pspDocumentHashesVersion, documents }, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
}

/**
 * The record of one run: loads `path`, records each download and saves the
 * file at once, so a step that times out or is cancelled keeps everything
 * read until then. `summary` counts the IDs first seen in this run and
 * lists those whose file, or only whose text, changed in this run.
 */
export function createPspDocumentRecorder(path, seenOn) {
  const hashes = loadPspDocumentHashes(path);
  const changed = { "file-changed": new Set(), "text-changed": new Set() };
  let added = 0;
  return {
    record(download) {
      const outcome = recordPspDocument(hashes, { ...download, seenOn });
      if (outcome === "new") added += 1;
      changed[outcome]?.add(pspDocumentId(download.url));
      if (outcome) savePspDocumentHashes(path, hashes);
      return outcome;
    },
    summary: () => {
      const ids = (set) => [...set].sort((left, right) => Number(left) - Number(right));
      return { documents: Object.keys(hashes.documents).length, added, fileChanged: ids(changed["file-changed"]), textChanged: ids(changed["text-changed"]) };
    }
  };
}
