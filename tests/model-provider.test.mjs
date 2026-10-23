import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRequestDispatcher, createStructuredModelResponse, reserveInputTokens, tokenBudgetPerMinute } from "../scripts/lib/model-provider.mjs";
import { maxOutputTokens, maxRequestInputTokens } from "../scripts/lib/assessment-config.mjs";

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

test("a refused request's warning names the provider's reason and Retry-After, without account identifiers", async () => {
  const timers = instantTimers();
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (line) => warnings.push(line);
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 429,
        headers: fixtureHeaders({ "retry-after": "300" }),
        json: async () => ({ error: { type: "requests", code: "rate_limit_exceeded", message: "Rate limit reached for gpt-6-luna in organization org-AbC123 on tokens per min (TPM): Limit 10000000." } })
      };
    }
    return { ok: true, json: async () => ({ id: "resp_fixture", model: "gpt-6.1-sol", usage: { input_tokens: 10, output_tokens: 2 }, output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }] }) };
  };
  try {
    await createStructuredModelResponse({ provider: "openai", apiKey: "fixture-key", model: "gpt-6.1-sol", instructions: "fixture", input: {}, name: "fixture_schema", schema: { type: "object" } });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /failed with 429 \(requests\/rate_limit_exceeded: Rate limit reached for gpt-6-luna in organization \[id\] on tokens per min \(TPM\): Limit 10000000\.; Retry-After 300\) \(attempt 1\/8\); retrying in 300000ms\./);
    assert.doesNotMatch(warnings[0], /org-AbC123/);
  } finally {
    timers.restore();
    console.warn = originalWarn;
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

test("every answer is capped, and one cut off at the cap comes back without output", async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      json: async () => ({ id: "resp_cut", model: "gpt-6-luna", status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, usage: { input_tokens: 10, output_tokens: maxOutputTokens }, output: [{ type: "reasoning", summary: [] }] })
    };
  };
  try {
    const result = await createStructuredModelResponse({ provider: "openai", apiKey: "fixture-key", model: "gpt-6-luna", instructions: "fixture", input: {}, name: "fixture_schema", schema: { type: "object" } });
    assert.equal(bodies[0].max_output_tokens, maxOutputTokens);
    assert.equal(maxRequestInputTokens, 1_050_000 - maxOutputTokens);
    assert.equal(result.output, null);
    assert.equal(result.incomplete, "max_output_tokens");
    assert.equal(result.responseId, "resp_cut");
  } finally {
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
  const callLog = join(await mkdtemp(join(tmpdir(), "model-calls-")), "calls.jsonl");
  process.env.SLIBY_MODEL_CALL_LOG = callLog;
  try {
    await request();
    assert.equal(callCount, 2);
    // The unreadable answer may have been billed, so it is logged as a failed paid call.
    const logged = (await readFile(callLog, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(logged.map(({ ok, usage }) => [ok, usage]), [[false, null], [true, { input_tokens: 1, output_tokens: 1 }]]);
    assert.match(logged[0].error, /successful response with an unparseable body/);
    delete process.env.SLIBY_MODEL_CALL_LOG;
    callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      return unreadable;
    };
    await assert.rejects(request, /successful response with an unparseable body/);
    assert.ok(callCount > 2, "every attempt is used before failing");
  } finally {
    delete process.env.SLIBY_MODEL_CALL_LOG;
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

test("createStructuredModelResponse sends input blocks as cache breakpoints and records a reasoning effort", async () => {
  const originalFetch = globalThis.fetch;
  let body = null;
  globalThis.fetch = async (url, init) => {
    body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        id: "resp_fixture",
        model: "gpt-6-luna",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    const result = await createStructuredModelResponse({
      provider: "openai",
      apiKey: "fixture-key",
      model: "gpt-6-luna",
      instructions: "fixture",
      inputBlocks: ["shared law change", "one promise"],
      reasoningEffort: "max",
      name: "fixture_schema",
      schema: { type: "object" }
    });
    assert.deepEqual(body.input, [{
      role: "user",
      content: [
        { type: "input_text", text: "shared law change", prompt_cache_breakpoint: { mode: "explicit" } },
        { type: "input_text", text: "one promise", prompt_cache_breakpoint: { mode: "explicit" } }
      ]
    }]);
    assert.deepEqual(body.reasoning, { effort: "max" });
    assert.equal(result.reasoningEffort, "max");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createStructuredModelResponse sends JSON input and no reasoning effort by default", async () => {
  const originalFetch = globalThis.fetch;
  let body = null;
  globalThis.fetch = async (url, init) => {
    body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        id: "resp_fixture",
        model: "gpt-6-luna",
        usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ content: [{ type: "output_text", text: JSON.stringify({ ok: true }) }] }]
      })
    };
  };
  try {
    // gpt-6-luna: the budget test above leaves gpt-6.1-sol's window full
    // for more than ten minutes of the real clock.
    const result = await createStructuredModelResponse({ provider: "openai", apiKey: "fixture-key", model: "gpt-6-luna", instructions: "fixture", input: { a: 1 }, name: "fixture_schema", schema: { type: "object" } });
    assert.equal(body.input, JSON.stringify({ a: 1 }));
    assert.equal("reasoning" in body, false);
    assert.equal("reasoningEffort" in result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
