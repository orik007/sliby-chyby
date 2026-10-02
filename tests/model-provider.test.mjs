import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createRequestDispatcher, createStructuredModelResponse, reserveInputTokens, tokenBudgetPerMinute } from "../scripts/lib/model-provider.mjs";

// Stub calls never belong in a real run's spend log.
delete process.env.SLIBY_MODEL_CALL_LOG;

// Retries wait with a jittered backoff. Tests replace the timer so they do not
// wait, record each requested delay, and fix the jitter at its maximum so
// the delays are exact.
function instantTimers({ random = 1 } = {}) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalRandom = Math.random;
  const delays = [];
  globalThis.setTimeout = (fn, ms) => {
    delays.push(ms);
    return originalSetTimeout(fn, 0);
  };
  Math.random = () => random;
  return { delays, restore: () => { globalThis.setTimeout = originalSetTimeout; Math.random = originalRandom; } };
}

function fixtureHeaders(map) {
  return { get: (key) => map[key.toLowerCase()] ?? null };
}

test("createStructuredModelResponse retries a 429 rate-limit response and succeeds on the next attempt", async () => {
  const timers = instantTimers();
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
        model: "gpt-6.1-sol",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    const result = await createStructuredModelResponse({
      provider: "openai",
      apiKey: "fixture-key",
      model: "gpt-6.1-sol",
      instructions: "fixture",
      input: {},
      name: "fixture_schema",
      schema: { type: "object" }
    });
    assert.equal(callCount, 2, "the retried request must actually be attempted a second time");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    timers.restore();
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
        model: "gpt-6.1-sol",
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
  const timers = instantTimers();
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
        model: "gpt-6.1-sol",
        instructions: "fixture",
        input: {},
        name: "fixture_schema",
        schema: { type: "object" }
      }),
      /OpenAI Responses API failed \(429\)/
    );
    assert.equal(callCount, 8, "must retry up to the fixed attempt cap, not forever");
    // A Retry-After of 0 does not shorten the backoff.
    assert.deepEqual(timers.delays, [2000, 4000, 8000, 16000, 32000, 64000, 120000]);
  } finally {
    globalThis.fetch = originalFetch;
    timers.restore();
  }
});

test("createStructuredModelResponse retries a transient 5xx response and succeeds on the next attempt", async () => {
  const timers = instantTimers();
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
        model: "gpt-6.1-sol",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    const result = await createStructuredModelResponse({
      provider: "openai",
      apiKey: "fixture-key",
      model: "gpt-6.1-sol",
      instructions: "fixture",
      input: {},
      name: "fixture_schema",
      schema: { type: "object" }
    });
    assert.equal(callCount, 2, "a transient 5xx must be retried, not treated as final");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    timers.restore();
    globalThis.fetch = originalFetch;
  }
});

test("createStructuredModelResponse retries a 5xx with a non-JSON body instead of crashing before classification", async () => {
  const timers = instantTimers();
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
        model: "gpt-6.1-sol",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    const result = await createStructuredModelResponse({
      provider: "openai",
      apiKey: "fixture-key",
      model: "gpt-6.1-sol",
      instructions: "fixture",
      input: {},
      name: "fixture_schema",
      schema: { type: "object" }
    });
    assert.equal(callCount, 2, "an unparseable body on a retryable status must not skip the retry");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    timers.restore();
    globalThis.fetch = originalFetch;
  }
});

test("createStructuredModelResponse honors an HTTP-date Retry-After, not just delta-seconds", async () => {
  const timers = instantTimers();
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  const retryAt = new Date(Date.now() + 60_000).toUTCString();
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
        model: "gpt-6.1-sol",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    const result = await createStructuredModelResponse({
      provider: "openai",
      apiKey: "fixture-key",
      model: "gpt-6.1-sol",
      instructions: "fixture",
      input: {},
      name: "fixture_schema",
      schema: { type: "object" }
    });
    // The date asks for about a minute, longer than the first backoff step,
    // so it sets the wait.
    assert.ok(timers.delays[0] > 50_000 && timers.delays[0] <= 60_000, `waited ${timers.delays[0]} ms`);
    assert.equal(callCount, 2);
    assert.deepEqual(result.output, { ok: true });
  } finally {
    timers.restore();
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
  const timers = instantTimers();
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
        model: "gpt-6.1-sol",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    const result = await createStructuredModelResponse({
      provider: "openai",
      apiKey: "fixture-key",
      model: "gpt-6.1-sol",
      instructions: "fixture",
      input: {},
      name: "fixture_schema",
      schema: { type: "object" }
    });
    assert.equal(callCount, 8, "must exhaust all 7 retries (8 attempts total) before succeeding on the last one");
    assert.deepEqual(timers.delays, [2000, 4000, 8000, 16000, 32000, 64000, 120000], "the fallback schedule must be exactly this exponential sequence, capped at two minutes");
    assert.deepEqual(result.output, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
    timers.restore();
  }
});

test("createStructuredModelResponse asks for Flex processing and retries a Flex timeout", async () => {
  const timers = instantTimers();
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
    timers.restore();
    globalThis.fetch = originalFetch;
  }
});

test("a request that fails without a response is retried", async () => {
  const originalFetch = globalThis.fetch;
  const timers = instantTimers();
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
    timers.restore();
  }
});

test("a successful response with an unparseable body is retried, and fails only after every attempt", async () => {
  const originalFetch = globalThis.fetch;
  const timers = instantTimers();
  let callCount = 0;
  const unreadable = { ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected end of JSON input"); } };
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) return unreadable;
    return { ok: true, json: async () => ({ id: "resp_fixture", model: "gpt-6-luna", usage: { input_tokens: 1, output_tokens: 1 }, output: [{ content: [{ type: "output_text", text: "{}" }] }] }) };
  };
  const request = () => createStructuredModelResponse({ provider: "openai", apiKey: "fixture-key", model: "gpt-6-luna", instructions: "fixture", input: {}, name: "fixture_schema", schema: { type: "object" } });
  try {
    await request();
    assert.equal(callCount, 2);
    callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      return unreadable;
    };
    await assert.rejects(request, /successful response with an unparseable body/);
    assert.ok(callCount > 2, "every attempt is used before failing");
  } finally {
    globalThis.fetch = originalFetch;
    timers.restore();
  }
});

test("each backoff wait is jittered between half and all of its step", async () => {
  const originalFetch = globalThis.fetch;
  const timers = instantTimers({ random: 0 });
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount <= 3) return { ok: false, status: 429, headers: fixtureHeaders({ "retry-after": "0" }), json: async () => ({ error: { message: "Rate limit reached" } }) };
    return { ok: true, json: async () => ({ id: "resp_fixture", model: "gpt-6-luna", usage: { input_tokens: 1, output_tokens: 1 }, output: [{ content: [{ type: "output_text", text: "{}" }] }] }) };
  };
  try {
    await createStructuredModelResponse({ provider: "openai", apiKey: "fixture-key", model: "gpt-6-luna", instructions: "fixture", input: {}, name: "fixture_schema", schema: { type: "object" } });
    assert.deepEqual(timers.delays, [1000, 2000, 4000]);
  } finally {
    globalThis.fetch = originalFetch;
    timers.restore();
  }
});

test("requests wait while a model's input tokens of the last minute would exceed its budget", async () => {
  // A fake clock: each wait advances it and returns at once.
  const originalSetTimeout = globalThis.setTimeout;
  const originalNow = Date.now;
  // Ten minutes ahead, so earlier tests' requests have left the window.
  let clock = originalNow() + 600_000;
  const waits = [];
  Date.now = () => clock;
  globalThis.setTimeout = (fn, ms) => { waits.push(ms); clock += ms; return originalSetTimeout(fn, 0); };
  try {
    const budget = tokenBudgetPerMinute("gpt-6.1-sol");
    await reserveInputTokens("gpt-6.1-sol", budget - 10);
    await reserveInputTokens("gpt-6.1-sol", 10);
    assert.deepEqual(waits, [], "requests within the budget are sent at once");
    await reserveInputTokens("gpt-6.1-sol", 1);
    assert.deepEqual(waits, [60_000], "the next request waits until the first leaves the minute");
    await reserveInputTokens("gpt-6.1-sol", budget * 3);
    assert.ok(waits.length >= 2, "a request larger than the budget waits for an empty minute");
    const before = waits.length;
    await reserveInputTokens("fixture-model", budget * 100);
    assert.equal(waits.length, before, "a model without a budget is not limited");
  } finally {
    Date.now = originalNow;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("the token budget is shared among parallel processes", () => {
  const original = process.env.SLIBY_TOKEN_BUDGET_SHARE;
  try {
    delete process.env.SLIBY_TOKEN_BUDGET_SHARE;
    assert.equal(tokenBudgetPerMinute("gpt-6-luna"), 8_000_000);
    process.env.SLIBY_TOKEN_BUDGET_SHARE = "16";
    assert.equal(tokenBudgetPerMinute("gpt-6-luna"), 500_000);
    assert.equal(tokenBudgetPerMinute("gpt-6.1-sol"), 200_000);
  } finally {
    if (original === undefined) delete process.env.SLIBY_TOKEN_BUDGET_SHARE; else process.env.SLIBY_TOKEN_BUDGET_SHARE = original;
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
