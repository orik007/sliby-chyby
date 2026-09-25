import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { ModelOutputError } from "./topic-tagger.mjs";
import { log } from "./run-log.mjs";

/**
 * Two independent cheap-model calls per subject with a durable cache: the
 * shared mechanics of promise tagging, law-change screening, and relevance
 * checks (docs/evidence-pipeline.md).
 */
export async function writeJsonAtomically(filePath, value) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = resolve(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/**
 * A model cache is an append-only JSON Lines journal: each line is one
 * accepted result `{ subjectId, ...entry }`, and a later line for the same
 * subject replaces an earlier one. Appending keeps every paid result on disk
 * the moment it exists without rewriting the whole cache.
 */
export async function loadModelCache(filePath) {
  const entries = {};
  if (existsSync(filePath)) {
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    const lastLine = lines.findLastIndex((line) => line.trim() !== "");
    let validLength = content.length;
    let offset = 0;
    for (const [index, line] of lines.entries()) {
      const start = offset;
      offset += line.length + 1;
      if (line.trim() === "") continue;
      let value;
      try {
        value = JSON.parse(line);
      } catch {
        // Only the last line can be cut short, by a run killed mid-write; it
        // is removed so the next result is appended on a line of its own.
        if (index !== lastLine) throw new Error(`Corrupt model cache ${filePath} line ${index + 1}`);
        validLength = start;
        continue;
      }
      if (typeof value?.subjectId !== "string") throw new Error(`Invalid model cache ${filePath} line ${index + 1}`);
      const { subjectId, ...entry } = value;
      entries[subjectId] = entry;
    }
    const repaired = content.slice(0, validLength);
    const normalized = repaired === "" || repaired.endsWith("\n") ? repaired : `${repaired}\n`;
    if (normalized !== content) {
      log(`model cache ${filePath}: removed a line cut short by an interrupted run`);
      await writeFile(filePath, normalized, "utf8");
    }
  }
  return { filePath, entries };
}

export function cachePersister(cache) {
  let chain = Promise.resolve();
  return (subjectId) => {
    const line = `${JSON.stringify({ subjectId, ...cache.entries[subjectId] })}\n`;
    chain = chain.then(async () => {
      await mkdir(dirname(cache.filePath), { recursive: true });
      await appendFile(cache.filePath, line, "utf8");
    });
    return chain;
  };
}

/**
 * Processes a bounded number of subjects at once. A transport or quota
 * failure (anything but a ModelOutputError, which pairedModelCall isolates)
 * stops the pool, since every later call would most likely fail the same
 * way; the subjects already finished are real, paid results and travel on
 * the thrown error as `partialResults`.
 */
export async function mapWithConcurrency(items, concurrency, worker, onDone = () => {}) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let firstError = null;
  async function runWorker() {
    while (nextIndex < items.length && !firstError) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await worker(items[index]);
        onDone(results[index]);
      } catch (error) {
        firstError = error;
        log(`stopping: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  if (firstError) {
    const completedCount = results.filter((result) => result !== undefined).length;
    const aborted = new Error(`Aborted after ${completedCount}/${items.length} item(s): ${firstError.message}`);
    aborted.cause = firstError;
    aborted.partialResults = results.filter((result) => result !== undefined);
    throw aborted;
  }
  return results;
}

async function isolateInvalidOutput(call) {
  try {
    return { response: await call(), error: null };
  } catch (error) {
    // An invalid model output fails only that side; the paid call's usage
    // is kept for the spend report. Any other failure stops the run.
    if (error instanceof ModelOutputError) return { response: null, error: error.message, model: error.model ?? null, usage: error.usage ?? null };
    throw error;
  }
}

function fingerprintMatches(cached, fingerprint) {
  return Boolean(cached) && Object.entries(fingerprint).every(([key, value]) => cached[key] === value);
}

/**
 * Two independent calls on one subject. `fingerprint` must cover everything
 * that could change a response (the input hash, the prompt and taxonomy
 * hashes, the provider, and both models); a cached side is reused only when
 * all of it matches, and is validated again with `revalidate`. Each valid
 * side is cached as soon as it exists; an invalid side is cached as null and
 * called again in the next run, which reuses the valid side. An invalid side
 * is returned as null.
 */
export async function pairedModelCall({ subjectId, fingerprint, cache, persist, callA, callB, revalidate = (output) => output }) {
  const cached = fingerprintMatches(cache.entries[subjectId], fingerprint) ? cache.entries[subjectId] : null;
  const reusedA = cached?.a != null;
  const reusedB = cached?.b != null;
  const [attemptA, attemptB] = await Promise.all([
    reusedA ? { response: { output: revalidate(cached.a), model: fingerprint.modelA }, error: null, reused: true } : isolateInvalidOutput(callA),
    reusedB ? { response: { output: revalidate(cached.b), model: fingerprint.modelB }, error: null, reused: true } : isolateInvalidOutput(callB)
  ]);
  const reused = reusedA && reusedB;
  if (!reused && (!attemptA.error || !attemptB.error)) {
    cache.entries[subjectId] = { ...fingerprint, a: attemptA.response?.output ?? null, b: attemptB.response?.output ?? null };
    await persist(subjectId);
  }
  const called = [attemptA, attemptB].filter((attempt) => !attempt.reused);
  return {
    a: attemptA.response?.output ?? null,
    b: attemptB.response?.output ?? null,
    errorA: attemptA.error,
    errorB: attemptB.error,
    modelA: attemptA.response?.model ?? attemptA.model ?? fingerprint.modelA,
    modelB: attemptB.response?.model ?? attemptB.model ?? fingerprint.modelB,
    usageByModel: called.map((attempt) => attempt.response ?? attempt).filter((entry) => entry.usage).map(({ model, usage }) => ({ model, usage })),
    invalidCount: (attemptA.error ? 1 : 0) + (attemptB.error ? 1 : 0),
    reused
  };
}

export function usageTotalsByModel(usageEntries) {
  const totals = new Map();
  for (const { model, usage } of usageEntries) {
    const current = totals.get(model) ?? { model, inputTokens: 0, outputTokens: 0 };
    current.inputTokens += usage?.input_tokens ?? 0;
    current.outputTokens += usage?.output_tokens ?? 0;
    totals.set(model, current);
  }
  return [...totals.values()];
}
