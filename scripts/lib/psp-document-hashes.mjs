import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { invariant } from "./collector-core.mjs";

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

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// The numeric document ID of an orig2.sqw URL, or null without one.
export function pspDocumentId(url) {
  const id = new URL(url).searchParams.get("idd");
  return /^\d+$/.test(id ?? "") ? id : null;
}

export function loadPspDocumentHashes(path) {
  if (!existsSync(path)) return { schemaVersion: pspDocumentHashesVersion, documents: {} };
  const stored = JSON.parse(readFileSync(path, "utf8"));
  invariant(stored?.schemaVersion === pspDocumentHashesVersion && stored.documents && typeof stored.documents === "object", `Invalid psp.cz document hashes: ${path}`);
  return stored;
}

/**
 * Records one download: the file's bytes and, when it was read as text, its
 * paragraphs. `seenOn` is the run date (YYYY-MM-DD).
 */
export function recordPspDocument(hashes, { url, bytes, paragraphs, seenOn }) {
  const id = pspDocumentId(url);
  // Only a record: a file without a document ID is left out, never fatal.
  if (!id) return;
  const fileSha256 = sha256(bytes);
  const textSha256 = paragraphs ? sha256(paragraphs.join("\n")) : null;
  const observations = hashes.documents[id] ??= [];
  const known = observations.find((entry) => entry.fileSha256 === fileSha256 && entry.textSha256 === textSha256);
  if (known) known.lastSeen = seenOn > known.lastSeen ? seenOn : known.lastSeen;
  else observations.push({ fileSha256, textSha256, firstSeen: seenOn, lastSeen: seenOn });
}

export function savePspDocumentHashes(path, hashes) {
  mkdirSync(dirname(path), { recursive: true });
  const documents = Object.fromEntries(Object.entries(hashes.documents).sort(([left], [right]) => Number(left) - Number(right)));
  writeFileSync(path, `${JSON.stringify({ schemaVersion: pspDocumentHashesVersion, documents }, null, 2)}\n`);
}

/**
 * How many IDs were seen, and which changed their file or their text.
 */
export function summarizePspDocumentHashes(hashes) {
  const entries = Object.entries(hashes.documents);
  const changed = (key) => entries.filter(([, observations]) => new Set(observations.map((entry) => entry[key])).size > 1).map(([id]) => id);
  return { documents: entries.length, fileChanged: changed("fileSha256"), textChanged: changed("textSha256") };
}
