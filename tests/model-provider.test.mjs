import assert from "node:assert/strict";
import test from "node:test";
import { createStructuredModelResponse } from "../scripts/lib/model-provider.mjs";

function fixtureHeaders(map) {
  return { get: (key) => map[key.toLowerCase()] ?? null };
}

test("createStructuredModelResponse retries a 429 rate-limit response and succeeds on the next attempt", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 429,
        headers: fixtureHeaders({ "retry-after": "0" }),
        json: async () => ({ error: { message: "Rate limit reached" } })
      };
    }
    return {
      ok: true,
      json: async () => ({
        id: "resp_fixture",
        model: "gpt-5.6-terra",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    const result = await createStructuredModelResponse({
      provider: "openai",
      apiKey: "fixture-key",
      model: "gpt-5.6-terra",
      instructions: "fixture",
      input: {},
      name: "fixture_schema",
      schema: { type: "object" }
    });
    assert.equal(callCount, 2, "the retried request must actually be attempted a second time");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createStructuredModelResponse does not retry a non-retryable 4xx error", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return {
      ok: false,
      status: 401,
      headers: fixtureHeaders({}),
      json: async () => ({ error: { message: "Invalid API key" } })
    };
  };
  try {
    await assert.rejects(
      () => createStructuredModelResponse({
        provider: "openai",
        apiKey: "fixture-key",
        model: "gpt-5.6-terra",
        instructions: "fixture",
        input: {},
        name: "fixture_schema",
        schema: { type: "object" }
      }),
      /OpenAI Responses API failed \(401\)/
    );
    assert.equal(callCount, 1, "a non-retryable error must fail on the first attempt, not waste time retrying");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createStructuredModelResponse gives up after repeated 429s and reports the last failure", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return {
      ok: false,
      status: 429,
      headers: fixtureHeaders({ "retry-after": "0" }),
      json: async () => ({ error: { message: "Rate limit reached" } })
    };
  };
  try {
    await assert.rejects(
      () => createStructuredModelResponse({
        provider: "openai",
        apiKey: "fixture-key",
        model: "gpt-5.6-terra",
        instructions: "fixture",
        input: {},
        name: "fixture_schema",
        schema: { type: "object" }
      }),
      /OpenAI Responses API failed \(429\)/
    );
    assert.equal(callCount, 6, "must retry up to the fixed attempt cap, not forever");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
