import assert from "node:assert/strict";
import { appendFile, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertKeptPromptCached, cachePersister, loadModelCache, loadShardedModelCache, pairedModelCall, shardedCachePersister } from "../scripts/lib/paired-model-calls.mjs";
import { ModelOutputError } from "../scripts/lib/model-output.mjs";

const fingerprint = { inputHash: "h1", promptContentHash: "p1", provider: "openai", modelA: "a", modelB: "b" };
const answer = (output) => async () => ({ output, model: "gpt-6-luna", usage: { input_tokens: 10, output_tokens: 1 } });

test("a valid pair is cached at once and reused only while the whole fingerprint matches", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "slava-paired-")), "cache.jsonl");
  const cache = await loadModelCache(path);
  const persist = cachePersister(cache);
  let calls = 0;
  const counted = (output) => async () => { calls += 1; return answer(output)(); };
  const first = await pairedModelCall({ subjectId: "s1", fingerprint, cache, persist, callA: counted({ v: 1 }), callB: counted({ v: 2 }) });
  assert.deepEqual([first.a, first.b, first.reused, first.usageByModel.length], [{ v: 1 }, { v: 2 }, false, 2]);
  const journal = (await readFile(path, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(journal.map(({ a, b }) => [a, b]), [[{ v: 1 }, null], [{ v: 1 }, { v: 2 }]], "A is on disk before B is called, and the pair when the call returns");

  const reused = await pairedModelCall({ subjectId: "s1", fingerprint, cache, persist, callA: counted({ v: 9 }), callB: counted({ v: 9 }) });
  assert.deepEqual([reused.a, reused.reused, calls], [{ v: 1 }, true, 2]);
  const changed = await pairedModelCall({ subjectId: "s1", fingerprint: { ...fingerprint, inputHash: "h2" }, cache, persist, callA: counted({ v: 3 }), callB: counted({ v: 4 }) });
  assert.deepEqual([changed.a, changed.reused, calls], [{ v: 3 }, false, 4]);

  // The journal is appended; a later line replaces an earlier one, and a
  // last line cut short by a killed run is removed, so the next result is
  // appended on a line of its own.
  await appendFile(path, '{"subjectId":"s2","a":');
  const reloaded = await loadModelCache(path);
  assert.equal((await readFile(path, "utf8")).split("\n").filter(Boolean).length, 4);
  assert.deepEqual(Object.keys(reloaded.entries), ["s1"]);
  assert.deepEqual(reloaded.entries.s1.a, { v: 3 });
  await pairedModelCall({ subjectId: "s3", fingerprint, cache: reloaded, persist: cachePersister(reloaded), callA: answer({ v: 5 }), callB: answer({ v: 6 }) });
  assert.deepEqual(Object.keys((await loadModelCache(path)).entries), ["s1", "s3"]);

  // A damaged line before the last one is an error, never skipped.
  await writeFile(path, `{"subjectId":"s1","a":\n${JSON.stringify({ subjectId: "s2", ...fingerprint, a: {}, b: {} })}\n`);
  await assert.rejects(() => loadModelCache(path), /Corrupt model cache .* line 1/);
});

test("an invalid output fails only its side and keeps its cost; the valid side is cached and reused", async () => {
  const cache = { filePath: null, entries: {} };
  const invalid = async () => {
    const error = new ModelOutputError("invented tag");
    error.model = "gpt-6-luna";
    error.usage = { input_tokens: 7, output_tokens: 1 };
    throw error;
  };
  const result = await pairedModelCall({ subjectId: "s1", fingerprint, cache, persist: async () => {}, callA: invalid, callB: answer({ v: 2 }) });
  assert.deepEqual([result.a, result.b, result.errorA, result.invalidCount], [null, { v: 2 }, "invented tag", 1]);
  assert.equal(result.usageByModel.length, 2);
  assert.deepEqual([cache.entries.s1.a, cache.entries.s1.b], [null, { v: 2 }]);

  // The next run calls only the side that was invalid.
  let calls = 0;
  const retried = await pairedModelCall({ subjectId: "s1", fingerprint, cache, persist: async () => {}, callA: async () => { calls += 1; return answer({ v: 1 })(); }, callB: async () => { calls += 10; return answer({ v: 9 })(); } });
  assert.deepEqual([retried.a, retried.b, retried.reused, retried.usageByModel.length, calls], [{ v: 1 }, { v: 2 }, false, 1, 1]);
  const reused = await pairedModelCall({ subjectId: "s1", fingerprint, cache, persist: async () => {}, callA: invalid, callB: invalid });
  assert.deepEqual([reused.a, reused.b, reused.reused], [{ v: 1 }, { v: 2 }, true]);
});

test("B is called only after A has answered, and a transport failure of B keeps A", async () => {
  const events = [];
  const timed = (side, output) => async () => { events.push(`${side} start`); await new Promise((resolve) => setTimeout(resolve, 20)); events.push(`${side} end`); return answer(output)(); };
  await pairedModelCall({ subjectId: "s1", fingerprint, cache: { entries: {} }, persist: async () => {}, callA: timed("a", { v: 1 }), callB: timed("b", { v: 2 }) });
  assert.deepEqual(events, ["a start", "a end", "b start", "b end"]);

  const cache = { entries: {} };
  const outage = async () => { throw new Error("OpenAI Responses API failed (503): unavailable"); };
  await assert.rejects(() => pairedModelCall({ subjectId: "s1", fingerprint, cache, persist: async () => {}, callA: answer({ v: 1 }), callB: outage }), /unavailable/);
  assert.deepEqual([cache.entries.s1.a, cache.entries.s1.b], [{ v: 1 }, null], "the paid answer of A is saved before the run stops");
});

test("a saved answer that no longer validates stops the pair before any paid call", async () => {
  let calls = 0;
  const cache = { entries: { s1: { ...fingerprint, a: null, b: { v: "old" } } } };
  const revalidate = (output) => { if (output.v === "old") throw new Error("saved answer is invalid"); return output; };
  await assert.rejects(() => pairedModelCall({ subjectId: "s1", fingerprint, cache, persist: async () => {}, callA: async () => { calls += 1; return answer({ v: 1 })(); }, callB: answer({ v: 2 }), revalidate }), /saved answer is invalid/);
  assert.equal(calls, 0);
});

test("a transport failure stops the pair", async () => {
  const outage = async () => { throw new Error("OpenAI Responses API failed (429): insufficient quota"); };
  await assert.rejects(() => pairedModelCall({ subjectId: "s1", fingerprint, cache: { entries: {} }, persist: async () => {}, callA: outage, callB: answer({}) }), /insufficient quota/);
});

test("a pair made under the prompt the current one keeps is reused and saved as kept, never a pair with an invalid side", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "slava-paired-")), "cache.jsonl");
  const cache = await loadModelCache(path);
  const persist = cachePersister(cache);
  let calls = 0;
  const counted = (output) => async () => { calls += 1; return answer(output)(); };
  await pairedModelCall({ subjectId: "s1", fingerprint, cache, persist, callA: answer({ v: 1 }), callB: answer({ v: 2 }) });
  cache.entries.s2 = { ...fingerprint, a: { v: 3 }, b: null };
  const next = { ...fingerprint, promptContentHash: "p2" };

  const notKept = await pairedModelCall({ subjectId: "s1", fingerprint: next, cache: structuredClone(cache), persist: async () => {}, callA: counted({ v: 5 }), callB: counted({ v: 6 }) });
  assert.deepEqual([notKept.a, notKept.reused, notKept.keptFromEarlierPrompt, notKept.madeUnderPromptContentHash, calls], [{ v: 5 }, false, false, "p2", 2], "without a kept prompt, a new prompt calls again");

  const kept = await pairedModelCall({ subjectId: "s1", fingerprint: next, cache, persist, callA: counted({ v: 9 }), callB: counted({ v: 9 }), keepFromPromptContentHash: "p1" });
  assert.deepEqual([kept.a, kept.b, kept.reused, kept.keptFromEarlierPrompt, kept.madeUnderPromptContentHash, kept.usageByModel.length, calls], [{ v: 1 }, { v: 2 }, true, true, "p1", 0, 2]);
  const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(lines.at(-1), { subjectId: "s1", keptUnderPromptContentHash: "p2" }, "keeping appends one short line, not the pair again");
  const reloaded = await loadModelCache(path);
  assert.deepEqual([reloaded.entries.s1.a, reloaded.entries.s1.promptContentHash, reloaded.entries.s1.keptUnderPromptContentHash], [{ v: 1 }, "p1", "p2"], "the entry names the prompt that made it and the one that kept it");

  // Kept once, it is reused under the current prompt without the earlier
  // one, under the prompt that made it, and kept again by a later prompt.
  const again = await pairedModelCall({ subjectId: "s1", fingerprint: next, cache: reloaded, persist: async () => {}, callA: counted({ v: 9 }), callB: counted({ v: 9 }) });
  assert.deepEqual([again.a, again.reused, again.keptFromEarlierPrompt, again.madeUnderPromptContentHash, calls], [{ v: 1 }, true, false, "p1", 2]);
  const reverted = await pairedModelCall({ subjectId: "s1", fingerprint, cache: reloaded, persist: async () => {}, callA: counted({ v: 9 }), callB: counted({ v: 9 }) });
  assert.deepEqual([reverted.reused, calls], [true, 2]);
  const later = await pairedModelCall({ subjectId: "s1", fingerprint: { ...fingerprint, promptContentHash: "p3" }, cache: structuredClone(reloaded), persist: async () => {}, callA: counted({ v: 9 }), callB: counted({ v: 9 }), keepFromPromptContentHash: "p2" });
  assert.deepEqual([later.reused, later.keptFromEarlierPrompt, calls], [true, true, 2]);
  // A kept pair that the current output rules reject is asked for again.
  const rejected = await pairedModelCall({ subjectId: "s1", fingerprint: { ...fingerprint, promptContentHash: "p3" }, cache: structuredClone(reloaded), persist: async () => {}, callA: counted({ v: 20 }), callB: counted({ v: 21 }), keepFromPromptContentHash: "p2", revalidate: (output) => { if (output.v < 20) throw new ModelOutputError("old shape"); return output; } });
  assert.deepEqual([rejected.a, rejected.reused, calls], [{ v: 20 }, false, 4]);
  // A short line for a result the journal does not hold is an error.
  await appendFile(path, `${JSON.stringify({ subjectId: "s9", keptUnderPromptContentHash: "p2" })}\n`);
  await assert.rejects(() => loadModelCache(path), /a kept result that is not in the cache/);
  // Any other change of the fingerprint is never kept.
  const changedInput = await pairedModelCall({ subjectId: "s1", fingerprint: { ...next, inputHash: "h2" }, cache: structuredClone(reloaded), persist: async () => {}, callA: counted({ v: 7 }), callB: counted({ v: 8 }), keepFromPromptContentHash: "p1" });
  assert.deepEqual([changedInput.a, changedInput.reused, calls], [{ v: 7 }, false, 6]);
  // A pair with an invalid side is asked for again in full under the new prompt.
  const halfPair = await pairedModelCall({ subjectId: "s2", fingerprint: next, cache, persist: async () => {}, callA: counted({ v: 10 }), callB: counted({ v: 11 }), keepFromPromptContentHash: "p1" });
  assert.deepEqual([halfPair.a, halfPair.b, halfPair.keptFromEarlierPrompt, calls], [{ v: 10 }, { v: 11 }, false, 8]);
  assert.equal(cache.entries.s2.promptContentHash, "p2");
  // A new answer replaces a kept pair with one made under the current prompt.
  const replaced = await pairedModelCall({ subjectId: "s1", fingerprint: { ...next, inputHash: "h3" }, cache: reloaded, persist: async () => {}, callA: counted({ v: 12 }), callB: counted({ v: 13 }) });
  assert.equal(replaced.reused, false);
  assert.deepEqual([reloaded.entries.s1.promptContentHash, reloaded.entries.s1.keptUnderPromptContentHash], ["p2", undefined]);
});

test("a prompt that keeps the results of a prompt with no complete cached pair fails, unless the cache is empty or already under the current prompt", () => {
  const check = (entries) => () => assertKeptPromptCached({ entries }, "p3", "p2", "screener-v3");
  assert.doesNotThrow(check({}), "an empty cache has nothing to keep");
  assert.doesNotThrow(check({ s1: { promptContentHash: "p2", a: {}, b: {} } }));
  assert.doesNotThrow(check({ s1: { promptContentHash: "p1", keptUnderPromptContentHash: "p2", a: {}, b: {} } }));
  assert.doesNotThrow(check({ s1: { promptContentHash: "p1", keptUnderPromptContentHash: "p3", a: {}, b: {} } }), "every result already kept under the current prompt");
  assert.doesNotThrow(check({ s1: { promptContentHash: "p3", a: {}, b: null } }));
  assert.throws(check({ s1: { promptContentHash: "p1", a: {}, b: {} } }), /screener-v3 prompt keeps the results of prompt p2, which made or kept no complete cached pair/);
  assert.throws(check({ s1: { promptContentHash: "p2", a: {}, b: null } }), /no complete cached pair/, "a pair with an invalid side keeps nothing");
});

test("a sharded model cache keeps one journal per subject group and loads them all", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "sharded-cache-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fileOf = (subjectId) => `${subjectId.split("-").slice(0, 2).join("-")}/${subjectId.split("--")[0]}.jsonl`;
  const cache = await loadShardedModelCache(directory, fileOf);
  const persist = shardedCachePersister(cache);
  cache.entries["ano-2025-a--43184-22"] = { inputHash: "1", a: { relevant: true } };
  cache.entries["spd-2025-b--43184-22"] = { inputHash: "2", a: { relevant: false } };
  await persist("ano-2025-a--43184-22");
  await persist("spd-2025-b--43184-22");
  assert.deepEqual((await readdir(directory, { recursive: true })).filter((name) => name.endsWith(".jsonl")).sort(), ["ano-2025/ano-2025-a.jsonl", "spd-2025/spd-2025-b.jsonl"]);
  const reloaded = await loadShardedModelCache(directory, fileOf);
  assert.deepEqual(reloaded.entries, cache.entries);
});
