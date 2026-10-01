import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { invariant, sha256 } from "./collector-core.mjs";
import { log } from "./run-log.mjs";

// The record of the content seen under each psp.cz document ID, as
// docs/evidence-pipeline.md (Chamber data rules) defines it: per ID, its
// observations ({fileSha256, textSha256, firstSeen, lastSeen}).
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
  let stored = null;
  try {
    stored = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // Reported below with the path.
  }
  const documents = stored?.documents;
  invariant(stored?.schemaVersion === pspDocumentHashesVersion && documents && typeof documents === "object" && !Array.isArray(documents)
    && Object.entries(documents).every(([id, observations]) => /^\d+$/.test(id) && Array.isArray(observations) && observations.length > 0 && observations.every(isObservation)),
  `Invalid psp.cz document hashes: ${path}`);
  return stored;
}

/**
 * Records one download (its bytes and, when it was read as text, its
 * paragraphs) on the run date `seenOn`, compared with what the ID served
 * last. Returns the ID, the outcome ("new", "file-changed", "text-changed",
 * or "same"), and whether the record changed; null for a URL without a
 * document ID, which is left out.
 */
export function recordPspDocument(hashes, { url, bytes, paragraphs, seenOn }) {
  const id = pspDocumentId(url);
  if (!id) return null;
  const fileSha256 = sha256(bytes);
  const textSha256 = paragraphs ? sha256(Buffer.from(paragraphs.join("\n"))) : null;
  const observations = hashes.documents[id];
  if (!observations) {
    hashes.documents[id] = [{ fileSha256, textSha256, firstSeen: seenOn, lastSeen: seenOn }];
    return { id, outcome: "new", modified: true };
  }
  // On equal dates the later entry is the more recent one.
  const last = observations.reduce((latest, entry) => (entry.lastSeen >= latest.lastSeen ? entry : latest));
  const outcome = last.fileSha256 !== fileSha256 ? "file-changed" : last.textSha256 !== textSha256 ? "text-changed" : "same";
  if (outcome === "same" && last === observations.at(-1) && last.lastSeen >= seenOn) return { id, outcome, modified: false };
  const known = observations.find((entry) => entry.fileSha256 === fileSha256 && entry.textSha256 === textSha256);
  if (known) {
    // Moved to the end, so it stays the most recent on a tie of dates.
    observations.splice(observations.indexOf(known), 1);
    observations.push({ ...known, lastSeen: seenOn > known.lastSeen ? seenOn : known.lastSeen });
  } else {
    observations.push({ fileSha256, textSha256, firstSeen: seenOn, lastSeen: seenOn });
  }
  return { id, outcome, modified: true };
}

// Written to a temporary file and renamed, so a run stopped mid-write
// leaves the previous complete record. The temporary file is named with a
// leading dot and `.tmp`, which .gitignore keeps out of the audit state.
// Integer-like keys keep ascending numeric order in JSON.
export function savePspDocumentHashes(path, hashes) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.tmp`);
  writeFileSync(temporary, `${JSON.stringify({ schemaVersion: pspDocumentHashesVersion, documents: hashes.documents }, null, 2)}\n`);
  renameSync(temporary, path);
}

/**
 * The record of one run. A change is saved at most every `saveIntervalMs`
 * and by `flush`, so a step that times out or is cancelled keeps all but its
 * last moments, and a large record is not rewritten after every download.
 * `summary` counts the IDs first seen in this run and lists those whose
 * file, or only whose text, changed in this run; an ID whose file changed is
 * never listed as text-only. A save that fails is logged and never fails
 * the download it describes; `flush` then fails the step.
 */
export function createPspDocumentRecorder(path, seenOn, { saveIntervalMs = 30_000, now = Date.now } = {}) {
  const hashes = loadPspDocumentHashes(path);
  const fileChanged = new Set();
  const textChanged = new Set();
  let added = 0;
  let dirty = false;
  let lastSave = now();
  let saveError = null;
  const save = () => {
    try {
      savePspDocumentHashes(path, hashes);
      // A later save holds everything an earlier failed one missed.
      dirty = false;
      saveError = null;
    } catch (error) {
      saveError ??= error;
      log(`psp.cz document hashes could not be saved: ${error instanceof Error ? error.message : String(error)}`);
    }
    lastSave = now();
  };
  return {
    record(download) {
      const result = recordPspDocument(hashes, { ...download, seenOn });
      if (!result) return null;
      const { id, outcome, modified } = result;
      if (outcome === "new") added += 1;
      if (outcome === "file-changed") {
        fileChanged.add(id);
        textChanged.delete(id);
      }
      if (outcome === "text-changed" && !fileChanged.has(id)) textChanged.add(id);
      dirty ||= modified;
      if (dirty && now() - lastSave >= saveIntervalMs) save();
      return outcome;
    },
    flush() {
      if (dirty) save();
      invariant(saveError === null, `psp.cz document hashes could not be saved: ${saveError?.message ?? saveError}`);
    },
    summary: () => {
      const ids = (set) => [...set].sort((left, right) => Number(left) - Number(right));
      return { documents: Object.keys(hashes.documents).length, added, fileChanged: ids(fileChanged), textChanged: ids(textChanged) };
    }
  };
}
