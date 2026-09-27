import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createRequestDispatcher, createStructuredModelResponse } from "../scripts/lib/model-provider.mjs";

// Stub calls never belong in a real run's spend log.
delete process.env.SLIBY_MODEL_CALL_LOG;

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
  const originalSetTimeout = globalThis.setTimeout;
  const capturedDelaysMs = [];
  globalThis.setTimeout = (fn, ms) => {
    capturedDelaysMs.push(ms);
    return originalSetTimeout(fn, 0);
  };
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
    assert.equal(callCount, 8, "must retry up to the fixed attempt cap, not forever");
    // A Retry-After of 0 does not shorten the backoff.
    assert.deepEqual(capturedDelaysMs, [2000, 4000, 8000, 16000, 32000, 64000, 120000]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
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

test("createStructuredModelResponse falls back to the exact exponential schedule when Retry-After is absent", async () => {
  // Every other retry test always supplies a Retry-After header, so the
  // fallback path (and its exact delay values) would otherwise be exercised by
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
    if (callCount <= 7) {
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
    assert.equal(callCount, 8, "must exhaust all 7 retries (8 attempts total) before succeeding on the last one");
    assert.deepEqual(capturedDelaysMs, [2000, 4000, 8000, 16000, 32000, 64000, 120000], "the fallback schedule must be exactly this exponential sequence, capped at two minutes");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("createStructuredModelResponse asks for Flex processing and retries a Flex timeout", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    if (bodies.length === 1) return { ok: false, status: 408, headers: fixtureHeaders({ "retry-after": "0" }), json: async () => ({ error: { message: "Request timed out" } }) };
    return {
      ok: true,
      json: async () => ({
        id: "resp_fixture",
        model: "gpt-6-luna",
        service_tier: "flex",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    const result = await createStructuredModelResponse({ provider: "openai", apiKey: "fixture-key", model: "gpt-6-luna", instructions: "fixture", input: {}, name: "fixture_schema", schema: { type: "object" } });
    assert.equal(bodies.length, 2, "a 408 is retried");
    assert.ok(bodies.every((body) => body.service_tier === "flex"));
    assert.deepEqual(result.output, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a request that fails without a response is retried", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) throw new TypeError("fetch failed", { cause: { code: "UND_ERR_HEADERS_TIMEOUT" } });
    return { ok: true, json: async () => ({ id: "resp_fixture", model: "gpt-6-luna", usage: { input_tokens: 1, output_tokens: 1 }, output: [{ content: [{ type: "output_text", text: "{}" }] }] }) };
  };
  try {
    await createStructuredModelResponse({ provider: "openai", apiKey: "fixture-key", model: "gpt-6-luna", instructions: "fixture", input: {}, name: "fixture_schema", schema: { type: "object" } });
    assert.equal(callCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("Node's fetch honours the request dispatcher's timeout", async () => {
  // Each response takes 1.5 s; a dispatcher that waits 100 ms (undici checks
  // its timeouts about every half second) gives up, one that waits 5 s gets
  // the answer. The first proves the dispatcher is used.
  const server = createServer((request, response) => setTimeout(() => response.end("{}"), 1_500));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    await assert.rejects(fetch(url, { dispatcher: createRequestDispatcher(100) }), (error) => error.cause?.code === "UND_ERR_HEADERS_TIMEOUT");
    const response = await fetch(url, { dispatcher: createRequestDispatcher(5_000) });
    assert.deepEqual(await response.json(), {});
  } finally {
    server.close();
  }
});
