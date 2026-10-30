import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { ModelOutputError } from "./model-output.mjs";
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
 * subject replaces an earlier one, except a line that only names the prompt
 * that kept the result (`{ subjectId, keptUnderPromptContentHash }`), which
 * is added to it. Appending keeps every paid result on disk the moment it
 * exists without rewriting the whole cache.
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
      if (Object.keys(entry).join() === "keptUnderPromptContentHash") {
        if (!entries[subjectId]) throw new Error(`Invalid model cache ${filePath} line ${index + 1}: a kept result that is not in the cache`);
        entries[subjectId] = { ...entries[subjectId], ...entry };
      } else entries[subjectId] = entry;
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
  return (subjectId, record = { subjectId, ...cache.entries[subjectId] }) => {
    const line = `${JSON.stringify(record)}\n`;
    chain = chain.then(async () => {
      await mkdir(dirname(cache.filePath), { recursive: true });
      await appendFile(cache.filePath, line, "utf8");
    });
    return chain;
  };
}

/**
 * A model cache kept in many journals under one directory, one per subject
 * group (for relevance checks, one per promise, in a directory per party
 * period), so no single file nears GitHub's file-size limit. It loads every
 * `*.jsonl` below the directory; `fileOf(subjectId)` names the journal,
 * relative to the directory, that a new result is appended to.
 */
export async function loadShardedModelCache(directory, fileOf) {
  const entries = {};
  const files = existsSync(directory) ? (await readdir(directory, { recursive: true })).filter((name) => name.endsWith(".jsonl")).sort() : [];
  for (const name of files) {
    const shard = await loadModelCache(resolve(directory, name));
    Object.assign(entries, shard.entries);
  }
  return { directory, fileOf, entries };
}

export function shardedCachePersister(cache) {
  let chain = Promise.resolve();
  return (subjectId, record = { subjectId, ...cache.entries[subjectId] }) => {
    const file = resolve(cache.directory, cache.fileOf(subjectId));
    const line = `${JSON.stringify(record)}\n`;
    chain = chain.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      await appendFile(file, line, "utf8");
    });
    return chain;
  };
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

// A cached entry matches when all of the fingerprint but the prompt hash
// does, and it was made or kept under the current prompt, or it is a pair
// made or last kept under the prompt the current one keeps for this subject.
function cachedEntry(cached, fingerprint, keepFromPromptContentHash, revalidate) {
  if (!cached) return null;
  const { promptContentHash, ...rest } = fingerprint;
  if (!Object.entries(rest).every(([key, value]) => cached[key] === value)) return null;
  if (cached.promptContentHash === promptContentHash || cached.keptUnderPromptContentHash === promptContentHash) return { entry: cached, kept: false };
  if (!keepFromPromptContentHash || (cached.keptUnderPromptContentHash ?? cached.promptContentHash) !== keepFromPromptContentHash || cached.a == null || cached.b == null) return null;
  // A kept pair that the current output rules reject is asked for again.
  try {
    revalidate(cached.a);
    revalidate(cached.b);
  } catch (error) {
    if (error instanceof ModelOutputError) return null;
    throw error;
  }
  return { entry: cached, kept: true };
}

/**
 * A prompt that keeps the results of an earlier prompt fails the run at once
 * when the cache holds results but no complete pair made or kept under that
 * prompt and none made or kept under the current one: its hash is wrong, and
 * every result would be sent again. An empty cache has nothing to keep.
 */
export function assertKeptPromptCached(cache, promptContentHash, keptPromptContentHash, label) {
  const entries = Object.values(cache.entries);
  const under = (hash) => (entry) => entry.promptContentHash === hash || entry.keptUnderPromptContentHash === hash;
  if (entries.length === 0 || entries.some(under(promptContentHash)) || entries.some((entry) => entry.a != null && entry.b != null && under(keptPromptContentHash)(entry))) return;
  throw new Error(`The ${label} prompt keeps the results of prompt ${keptPromptContentHash}, which made or kept no complete cached pair`);
}

/**
 * Two independent calls on one subject. `fingerprint` must cover everything
 * that could change a response (the input hash, the prompt and taxonomy
 * hashes, the provider, and both models); a cached side is reused only when
 * all of it matches, and is validated again with `revalidate`; a pair of the
 * earlier prompt `keepFromPromptContentHash` is reused as
 * docs/evidence-pipeline.md (Audit and cost control) states. Each valid
 * side is cached as soon as it exists; an invalid side is cached as null and
 * called again in the next run, which reuses the valid side. An invalid side
 * is returned as null.
 *
 * B is called only after A has answered: both sides send the same request
 * when they use the same model, so B reads the provider's prompt cache and
 * pays a tenth for the input they share. The answers stay independent.
 */
export async function pairedModelCall({ subjectId, fingerprint, cache, persist, callA, callB, revalidate = (output) => output, keepFromPromptContentHash = null }) {
  const match = cachedEntry(cache.entries[subjectId], fingerprint, keepFromPromptContentHash, revalidate);
  const cached = match?.entry ?? null;
  const reusedA = cached?.a != null;
  const reusedB = cached?.b != null;
  // Saved answers are validated again before any paid call.
  const savedA = reusedA ? revalidate(cached.a) : null;
  const savedB = reusedB ? revalidate(cached.b) : null;
  const attemptA = reusedA ? { response: { output: savedA, model: fingerprint.modelA }, error: null, reused: true } : await isolateInvalidOutput(callA);
  const save = async (b) => {
    cache.entries[subjectId] = { ...fingerprint, a: attemptA.response?.output ?? null, b };
    await persist(subjectId);
  };
  // A new valid A is saved before B's paid call, so a failure or a killed
  // run while B is in flight never loses it.
  const savedEarly = !reusedA && !attemptA.error && !reusedB;
  if (savedEarly) await save(null);
  const attemptB = reusedB ? { response: { output: savedB, model: fingerprint.modelB }, error: null, reused: true } : await isolateInvalidOutput(callB);
  const reused = reusedA && reusedB;
  // A kept pair is saved as one short line naming the prompt that kept it.
  if (match?.kept) {
    cache.entries[subjectId] = { ...cached, keptUnderPromptContentHash: fingerprint.promptContentHash };
    await persist(subjectId, { subjectId, keptUnderPromptContentHash: fingerprint.promptContentHash });
  }
  if (!reused && (!attemptA.error || !attemptB.error) && !(savedEarly && attemptB.error)) await save(attemptB.response?.output ?? null);
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
    reused,
    // The prompt that made the answers, and whether this call kept them
    // from an earlier prompt.
    madeUnderPromptContentHash: reused ? cached.promptContentHash : fingerprint.promptContentHash,
    keptFromEarlierPrompt: Boolean(match?.kept)
  };
}

/**
 * One call on a subject with a durable cache: the third relevance check, made
 * only when the two independent checks do not agree. `fingerprint` covers the
 * input hash, the prompt hash, the provider, and the model; a cached answer is
 * reused only when all of it matches, and is validated again with
 * `revalidate`. A valid answer is cached at once; an invalid one is returned
 * as null and asked for again in the next run.
 */
export async function singleModelCall({ subjectId, fingerprint, cache, persist, call, revalidate = (output) => output }) {
  const cached = cache.entries[subjectId];
  if (cached?.c != null && Object.entries(fingerprint).every(([key, value]) => cached[key] === value)) {
    try {
      return { c: revalidate(cached.c), error: null, model: fingerprint.model, usageByModel: [], invalidCount: 0, reused: true };
    } catch (error) {
      if (!(error instanceof ModelOutputError)) throw error;
    }
  }
  const attempt = await isolateInvalidOutput(call);
  if (!attempt.error) {
    cache.entries[subjectId] = { ...fingerprint, c: attempt.response.output };
    await persist(subjectId);
  }
  const usageSource = attempt.response ?? attempt;
  return {
    c: attempt.response?.output ?? null,
    error: attempt.error,
    model: attempt.response?.model ?? attempt.model ?? fingerprint.model,
    usageByModel: usageSource.usage ? [{ model: usageSource.model ?? fingerprint.model, usage: usageSource.usage }] : [],
    invalidCount: attempt.error ? 1 : 0,
    reused: false
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
