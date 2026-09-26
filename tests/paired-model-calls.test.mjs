import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cachePersister, loadModelCache, mapWithConcurrency, pairedModelCall } from "../scripts/lib/paired-model-calls.mjs";
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
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")).a, { v: 1 }, "the paid result is on disk before the call returns");

  const reused = await pairedModelCall({ subjectId: "s1", fingerprint, cache, persist, callA: counted({ v: 9 }), callB: counted({ v: 9 }) });
  assert.deepEqual([reused.a, reused.reused, calls], [{ v: 1 }, true, 2]);
  const changed = await pairedModelCall({ subjectId: "s1", fingerprint: { ...fingerprint, inputHash: "h2" }, cache, persist, callA: counted({ v: 3 }), callB: counted({ v: 4 }) });
  assert.deepEqual([changed.a, changed.reused, calls], [{ v: 3 }, false, 4]);

  // The journal is appended; a later line replaces an earlier one, and a
  // last line cut short by a killed run is removed, so the next result is
  // appended on a line of its own.
  await appendFile(path, '{"subjectId":"s2","a":');
  const reloaded = await loadModelCache(path);
  assert.equal((await readFile(path, "utf8")).split("\n").filter(Boolean).length, 2);
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

test("a transport failure stops the run, and finished subjects travel with the error", async () => {
  const outage = async () => { throw new Error("OpenAI Responses API failed (429): insufficient quota"); };
  await assert.rejects(() => pairedModelCall({ subjectId: "s1", fingerprint, cache: { entries: {} }, persist: async () => {}, callA: outage, callB: answer({}) }), /insufficient quota/);
  await assert.rejects(
    () => mapWithConcurrency([1, 2, 3], 1, async (item) => { if (item === 2) throw new Error("quota"); return item; }),
    (error) => {
      assert.deepEqual(error.partialResults, [1]);
      assert.match(error.message, /Aborted after 1\/3 item\(s\): quota/);
      return true;
    }
  );
});
