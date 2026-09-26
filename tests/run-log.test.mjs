import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

test("a request above the long-context threshold is priced at the long-context rates in full", () => {
  const table = { longContextThresholdTokens: 272_000, models: { "gpt-5.6-terra": { input: 2, cachedInput: 0.2, output: 12, longContext: { input: 4, cachedInput: 0.4, output: 18 } } } };
  const at = (input) => estimateCallCost("gpt-5.6-terra", { input_tokens: input, input_tokens_details: { cached_tokens: 0 }, output_tokens: 1_000 }, table);
  assert.equal(at(272_000).toFixed(6), ((272_000 * 2 + 1_000 * 12) / 1_000_000).toFixed(6));
  assert.equal(at(272_001).toFixed(6), ((272_001 * 4 + 1_000 * 18) / 1_000_000).toFixed(6));
});

test("the price table carries the long-context rates for every model", async () => {
  const table = JSON.parse(await readFile(new URL("../automation/model-prices.json", import.meta.url), "utf8"));
  assert.equal(table.longContextThresholdTokens, 272_000);
  for (const [model, price] of Object.entries(table.models)) {
    assert.ok(price.longContext, `${model} has long-context prices`);
    // OpenAI charges long context at twice the input and cached-input rate and 1.5 times the output rate.
    assert.equal(price.longContext.input, price.input * 2, model);
    assert.equal(price.longContext.cachedInput, price.cachedInput * 2, model);
    assert.equal(price.longContext.output, price.output * 1.5, model);
  }
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
  const original = console.error;
  console.error = (line) => lines.push(line);
  try {
    const tick = progress("downloading", 5, { every: 2, seconds: 3600 });
    for (let index = 0; index < 5; index += 1) tick(`item ${index}`);
  } finally {
    console.error = original;
  }
  assert.deepEqual(lines.map((line) => line.replace(/^\[[^\]]+\] /, "")), [
    "downloading: 5 to process",
    "downloading: 2/5 (last: item 1)",
    "downloading: 4/5 (last: item 3)",
    "downloading: 5/5 (last: item 4)"
  ]);
});

test("log lines never reach stdout, which carries a script's machine-readable result", () => {
  const moduleUrl = new URL("../scripts/lib/run-log.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `import { log } from ${JSON.stringify(moduleUrl)}; log("progress"); console.log(JSON.stringify({ ok: true }));`], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { ok: true });
  assert.match(child.stderr, /progress/);
});
