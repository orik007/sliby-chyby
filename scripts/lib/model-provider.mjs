import { Agent } from "undici";
import { logModelCall } from "./run-log.mjs";

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

async function fetchJsonWithRetry(url, init) {
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
      if (body === null) throw new Error(`Provider request to ${url} returned a successful response with an unparseable body`);
      return { response, body };
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

  const { response, body } = await fetchJsonWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      service_tier: tier,
      store: false,
      instructions,
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name, strict: true, schema } },
      metadata
    })
  });

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
