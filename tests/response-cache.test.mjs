import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cachedModelResponse } from "../scripts/lib/response-cache.mjs";

test("a paid response is saved at once and reused for the same request, never for a different one", async () => {
  const directory = join(await mkdtemp(join(tmpdir(), "slava-response-cache-")), "responses");
  let calls = 0;
  const request = async () => ({ output: { status: "moving-towards" }, call: ++calls });
  const keyInput = { assessmentFingerprint: "a".repeat(64), role: "assessor-a", request: { model: "m" } };

  const first = await cachedModelResponse({ directory, role: "assessor-a", keyInput, request });
  // A retry after the other assessor failed reuses the saved response.
  const retry = await cachedModelResponse({ directory, role: "assessor-a", keyInput, request });
  assert.deepEqual(retry, first);
  assert.equal(calls, 1);

  const changed = await cachedModelResponse({ directory, role: "assessor-a", keyInput: { ...keyInput, request: { model: "other" } }, request });
  assert.equal(changed.call, 2);

  await assert.rejects(cachedModelResponse({ directory, role: "arbiter", keyInput, request: async () => { throw new Error("429 insufficient quota"); } }), /insufficient quota/);
  const again = await cachedModelResponse({ directory, role: "assessor-a", keyInput: { ...keyInput, request: { model: "other" } }, request });
  assert.equal(again.call, 2);
});
