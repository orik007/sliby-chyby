import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { estimateCallCost, logModelCall, progress } from "../scripts/lib/run-log.mjs";

test("a call's estimated cost uses uncached input, cached input, and output prices", () => {
  const table = { models: { "gpt-6-luna": { input: 0.10, cachedInput: 0.01, output: 0.50 } } };
  const usage = { input_tokens: 1_000_000, input_tokens_details: { cached_tokens: 400_000 }, output_tokens: 200_000 };
  assert.equal(estimateCallCost("gpt-6-luna", usage, table).toFixed(4), (0.06 + 0.004 + 0.1).toFixed(4));
  assert.equal(estimateCallCost("unknown-model", usage, table), null);
  assert.equal(estimateCallCost("gpt-6-luna", null, table), null);
});

test("every paid model call is appended to the model-call log", async () => {
  const file = join(await mkdtemp(join(tmpdir(), "slava-run-log-")), "nested", "model-calls.jsonl");
  const previous = process.env.SLIBY_MODEL_CALL_LOG;
  process.env.SLIBY_MODEL_CALL_LOG = file;
  try {
    logModelCall({ label: "tagging promise p1", model: "gpt-6-luna", usage: { input_tokens: 10, output_tokens: 2 } });
    logModelCall({ label: "assessor-a p1", model: "gpt-5.6-terra", usage: null, ok: false, error: "429" });
  } finally {
    if (previous === undefined) delete process.env.SLIBY_MODEL_CALL_LOG; else process.env.SLIBY_MODEL_CALL_LOG = previous;
  }
  const lines = (await readFile(file, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(lines.map(({ label, ok }) => [label, ok]), [["tagging promise p1", true], ["assessor-a p1", false]]);
  assert.ok(lines[0].estimatedCostUsd > 0);
});

test("progress logs in batches and always at the last item", () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  try {
    const tick = progress("downloading", 5, { every: 2, seconds: 3600 });
    for (let index = 0; index < 5; index += 1) tick(`item ${index}`);
  } finally {
    console.log = original;
  }
  assert.deepEqual(lines.map((line) => line.replace(/^\[[^\]]+\] /, "")), [
    "downloading: 5 to process",
    "downloading: 2/5 (last: item 1)",
    "downloading: 4/5 (last: item 3)",
    "downloading: 5/5 (last: item 4)"
  ]);
});
