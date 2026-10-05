import { Agent } from "undici";
import { charactersPerToken } from "./assessment-config.mjs";
import { log, logModelCall } from "./run-log.mjs";

// Eight attempts with a backoff capped at two minutes wait about four
// minutes in all, so a short gap in Flex capacity does not stop a run.
const maxProviderAttempts = 8;
const baseRetryDelayMs = 2_000;
const maxRetryDelayMs = 120_000;

// Every call uses OpenAI Flex processing: the same models at half the
// standard price, answered more slowly (docs/evidence-pipeline.md).
// SLIBY_SERVICE_TIER=default selects standard processing. It is read at each
// call, after a script has loaded its .env file.
export function serviceTier() {
  return process.env.SLIBY_SERVICE_TIER || "flex";
}

// Node's fetch gives up on a response after five minutes without headers,
// and a slow Flex answer to a large request can take longer. The dispatcher
// comes from the undici release that Node 22 bundles, so its fetch accepts
// it; tests/model-provider.test.mjs checks that it does, and the workflow
// runs the tests before any paid step.
const requestTimeoutMs = 30 * 60_000;
export function createRequestDispatcher(timeoutMs = requestTimeoutMs) {
  return new Agent({ headersTimeout: timeoutMs, bodyTimeout: timeoutMs });
}
const requestDispatcher = createRequestDispatcher();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Input tokens a minute each model may use in this process: 80 % of the
// usage-tier-4 limits on the OpenAI model pages (gpt-6-luna 10,000,000,
// gpt-6.1-sol 4,000,000, verified on 30 September 2026; cached input counts
// too). A process that shares
// the account with parallel processes gets its share through
// SLIBY_TOKEN_BUDGET_SHARE (docs/evidence-pipeline.md). A model without a
// limit here is not limited, and the run log says so.
const tokensPerMinute = { "gpt-6-luna": 8_000_000, "gpt-6.1-sol": 3_200_000 };
const tokenWindows = new Map();
const unlimitedModelsLogged = new Set();

export function tokenBudgetPerMinute(model) {
  if (!tokensPerMinute[model]) return null;
  const share = Number(process.env.SLIBY_TOKEN_BUDGET_SHARE ?? "1");
  return Math.floor(tokensPerMinute[model] / (Number.isFinite(share) && share >= 1 ? share : 1));
}

// Waits until the request's estimated input fits the model's budget for the
// last minute; a request larger than the whole budget waits for an empty
// minute and is then sent alone.
export async function reserveInputTokens(model, tokens) {
  const budget = tokenBudgetPerMinute(model);
  if (budget === null) {
    if (!unlimitedModelsLogged.has(model)) log(`no token budget is set for ${model}; its requests are not limited`);
    unlimitedModelsLogged.add(model);
    return;
  }
  for (;;) {
    const now = Date.now();
    const window = (tokenWindows.get(model) ?? []).filter(({ at }) => now - at < 60_000);
    const used = window.reduce((sum, entry) => sum + entry.tokens, 0);
    if (window.length === 0 || used + tokens <= budget) {
      window.push({ at: now, tokens });
      tokenWindows.set(model, window);
      return;
    }
    tokenWindows.set(model, window);
    await sleep(Math.max(250, window[0].at + 60_000 - now));
  }
}

// A retryable 5xx can come back with an empty, HTML, or otherwise
// non-JSON body (an intermediate gateway's own error page, not the
// provider's), which must not itself crash the request before its status
// is even classified -- that would defeat the retry entirely.
async function parseJsonBodyOrNull(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// `Retry-After` (RFC 9110 §10.2.3) is either delta-seconds (a plain
// non-negative integer) or an HTTP-date. Treating the date form as invalid
// and silently falling back to the fixed exponential schedule can retry far
// earlier than the provider actually asked for and trigger another rate
// limit; a date already in the past asks for no wait of its own.
function parseRetryAfterMs(headerValue) {
  if (typeof headerValue !== "string" || headerValue.trim() === "") return null;
  const trimmed = headerValue.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const dateMs = Date.parse(trimmed);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

/**
 * A 408 (a Flex request that timed out), 429 (rate limit, or Flex capacity
 * unavailable, which is not charged), or 5xx (transient provider-side
 * failure) is expected and recoverable during a large batch -- especially a
 * full historical backfill sending far more requests per minute than an
 * incremental daily run -- so it is retried with backoff instead of failing
 * the caller's entire run on the first hit, and so is a request that fails
 * without a response (the dispatcher's timeout or a dropped connection).
 * Any other 4xx (bad request, invalid key, ...) is not retried: retrying it
 * would just waste the backoff delay on an error that will never succeed.
 */
// Equal jitter: between half and all of the exponential step, so parallel
// requests rejected together do not retry together.
function backoffMs(attempt) {
  const step = Math.min(baseRetryDelayMs * 2 ** (attempt - 1), maxRetryDelayMs);
  return Math.round(step / 2 + (Math.random() * step) / 2);
}

async function fetchJsonWithRetry(url, init, { model, estimatedTokens, label = null, serviceTier = null }) {
  // Reserved once: a retry resends input that was rejected, not consumed.
  await reserveInputTokens(model, estimatedTokens);
  let last = null;
  for (let attempt = 1; attempt <= maxProviderAttempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { ...init, dispatcher: requestDispatcher });
    } catch (error) {
      if (attempt === maxProviderAttempts) throw error;
      const delayMs = backoffMs(attempt);
      console.warn(`Provider request to ${url} failed without a response: ${error.cause?.code ?? error.message} (attempt ${attempt}/${maxProviderAttempts}); retrying in ${delayMs}ms.`);
      await sleep(delayMs);
      continue;
    }
    const body = await parseJsonBodyOrNull(response);
    if (response.ok) {
      if (body !== null) return { response, body };
      // A successful status whose body cannot be read (in run 73, a 771,000-
      // token request's answer) is retried like a request without a response.
      // The model may have read and billed the input, so the attempt is
      // logged as a failed paid call, its usage unknown, and the retry
      // reserves its input in the token budget again.
      const message = `Provider request to ${url} returned a successful response with an unparseable body`;
      logModelCall({ label, model, usage: null, serviceTier, ok: false, error: message });
      if (attempt === maxProviderAttempts) throw new Error(message);
      const delayMs = backoffMs(attempt);
      console.warn(`${message} (attempt ${attempt}/${maxProviderAttempts}); retrying in ${delayMs}ms.`);
      await sleep(delayMs);
      await reserveInputTokens(model, estimatedTokens);
      continue;
    }
    last = { response, body };
    const retryable = response.status === 408 || response.status === 429 || (response.status >= 500 && response.status < 600);
    if (!retryable || attempt === maxProviderAttempts) return last;
    const retryAfterHeader = typeof response.headers?.get === "function" ? response.headers.get("retry-after") : null;
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
    // Retry-After is a lower bound (docs/evidence-pipeline.md).
    const delayMs = Math.max(retryAfterMs ?? 0, backoffMs(attempt));
    console.warn(`Provider request to ${url} failed with ${response.status} (attempt ${attempt}/${maxProviderAttempts}); retrying in ${delayMs}ms.`);
    await sleep(delayMs);
  }
  return last;
}

/**
 * Provider boundary for structured assessment calls.
 *
 * The assessment pipeline consumes one normalized response shape. Adding a
 * second provider should require a new adapter here, not changes to scoring,
 * evidence packages, arbitration, or the public website.
 */
export async function createStructuredModelResponse({
  provider,
  apiKey,
  model,
  instructions,
  input,
  name,
  schema,
  metadata,
  logLabel = null
}) {
  if (provider !== "openai") {
    throw new Error(`Unsupported model provider: ${provider}`);
  }

  if (!apiKey) throw new Error("OPENAI_API_KEY is required for the OpenAI provider");
  const tier = serviceTier();

  const requestInput = JSON.stringify(input);
  const { response, body } = await fetchJsonWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      service_tier: tier,
      store: false,
      instructions,
      input: requestInput,
      text: { format: { type: "json_schema", name, strict: true, schema } },
      metadata
    })
  }, { model, estimatedTokens: Math.ceil((instructions.length + requestInput.length + JSON.stringify(schema).length) / charactersPerToken), label: logLabel, serviceTier: tier });

  if (!response.ok) {
    const message = `OpenAI Responses API failed (${response.status}): ${body?.error?.message ?? "unknown error"}`;
    logModelCall({ label: logLabel, model, usage: null, serviceTier: tier, ok: false, error: message });
    throw new Error(message);
  }
  // The response names the tier that processed it, which sets its price.
  logModelCall({ label: logLabel, model: body.model ?? model, usage: body.usage ?? null, serviceTier: body.service_tier ?? tier });

  const content = body.output?.flatMap((item) => item.content ?? []) ?? [];
  const refusal = content.find((item) => item.type === "refusal")?.refusal;
  if (refusal) throw new Error(`Model refused the assessment request: ${refusal}`);

  const outputText = content.find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error(`Response ${body.id ?? "unknown"} did not contain structured output text`);

  return {
    provider,
    responseId: body.id,
    model: body.model ?? model,
    usage: body.usage ?? null,
    output: JSON.parse(outputText)
  };
}
