import assert from "node:assert/strict";
import test from "node:test";
import { createEmbeddings, createStructuredModelResponse } from "../scripts/lib/model-provider.mjs";

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

test("createStructuredModelResponse retries a transient 5xx response and succeeds on the next attempt", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 503,
        headers: fixtureHeaders({ "retry-after": "0" }),
        json: async () => ({ error: { message: "Service unavailable" } })
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
    assert.equal(callCount, 2, "a transient 5xx must be retried, not treated as final");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createStructuredModelResponse retries a 5xx with a non-JSON body instead of crashing before classification", async () => {
  // A retryable 5xx can come back from an intermediate gateway with an
  // empty or HTML error page, not the provider's own JSON error shape.
  // response.json() would reject on that body -- this must not bypass
  // retry entirely, per the review finding.
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 502,
        headers: fixtureHeaders({ "retry-after": "0" }),
        json: async () => { throw new SyntaxError("Unexpected token < in JSON"); }
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
    assert.equal(callCount, 2, "an unparseable body on a retryable status must not skip the retry");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createStructuredModelResponse honors an HTTP-date Retry-After, not just delta-seconds", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  const retryAt = new Date(Date.now() + 5).toUTCString();
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 429,
        headers: fixtureHeaders({ "retry-after": retryAt }),
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
    assert.equal(callCount, 2);
    assert.deepEqual(result.output, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createEmbeddings retries a 429 rate-limit response and succeeds on the next attempt", async () => {
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
        model: "text-embedding-3-small",
        usage: { input_tokens: 5 },
        data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }]
      })
    };
  };
  try {
    const result = await createEmbeddings({ provider: "openai", apiKey: "fixture-key", model: "text-embedding-3-small", dimensions: 3, inputs: ["fixture text"] });
    assert.equal(callCount, 2, "the retried embedding request must actually be attempted a second time");
    assert.deepEqual(result.embeddings, [[0.1, 0.2, 0.3]]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createStructuredModelResponse falls back to the exact exponential schedule when Retry-After is absent", async () => {
  // Every other retry test always supplies a Retry-After header, so the
  // fallback path (and its exact delay values) was previously exercised by
  // nothing -- even a broken implementation that always waited a fixed 2s
  // regardless of attempt number would have passed. Mock setTimeout itself
  // to capture the real delay values `sleep` requests, firing immediately
  // so the test does not actually wait in real time.
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const capturedDelaysMs = [];
  globalThis.setTimeout = (fn, ms) => {
    capturedDelaysMs.push(ms);
    return originalSetTimeout(fn, 0);
  };
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount <= 5) {
      return {
        ok: false,
        status: 503,
        headers: fixtureHeaders({}),
        json: async () => ({ error: { message: "Service unavailable" } })
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
    assert.equal(callCount, 6, "must exhaust all 5 retries (6 attempts total) before succeeding on the last one");
    assert.deepEqual(capturedDelaysMs, [2000, 4000, 8000, 16000, 32000], "the fallback schedule must be exactly this exponential sequence, not just any non-zero delay");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});
