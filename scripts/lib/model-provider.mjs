const maxProviderAttempts = 6;
const baseRetryDelayMs = 2_000;

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
// limit; a date already in the past means retry immediately (zero delay).
function parseRetryAfterMs(headerValue) {
  if (typeof headerValue !== "string" || headerValue.trim() === "") return null;
  const trimmed = headerValue.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const dateMs = Date.parse(trimmed);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

/**
 * A 429 (rate limit) or 5xx (transient provider-side failure) is expected
 * and recoverable during a large batch -- especially a full historical
 * backfill sending far more requests per minute than an incremental daily
 * run -- so it is retried with backoff instead of failing the caller's
 * entire run on the first hit. A 4xx other than 429 (bad request, invalid
 * key, ...) is not retried: retrying it would just waste the backoff delay
 * on an error that will never succeed.
 */
async function fetchJsonWithRetry(url, init) {
  let last = null;
  for (let attempt = 1; attempt <= maxProviderAttempts; attempt += 1) {
    const response = await fetch(url, init);
    const body = await parseJsonBodyOrNull(response);
    if (response.ok) {
      if (body === null) throw new Error(`Provider request to ${url} returned a successful response with an unparseable body`);
      return { response, body };
    }
    last = { response, body };
    const retryable = response.status === 429 || (response.status >= 500 && response.status < 600);
    if (!retryable || attempt === maxProviderAttempts) return last;
    const retryAfterHeader = typeof response.headers?.get === "function" ? response.headers.get("retry-after") : null;
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
    const delayMs = retryAfterMs !== null ? retryAfterMs : baseRetryDelayMs * 2 ** (attempt - 1);
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
  metadata
}) {
  if (provider !== "openai") {
    throw new Error(`Unsupported model provider: ${provider}`);
  }

  if (!apiKey) throw new Error("OPENAI_API_KEY is required for the OpenAI provider");

  const { response, body } = await fetchJsonWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions,
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name, strict: true, schema } },
      metadata
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI Responses API failed (${response.status}): ${body?.error?.message ?? "unknown error"}`);
  }

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

export async function createEmbeddings({ provider, apiKey, model, dimensions, inputs }) {
  if (provider !== "openai") throw new Error(`Unsupported embedding provider: ${provider}`);
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for the OpenAI provider");
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error("Embedding input must be a non-empty array");
  if (!inputs.every((input) => typeof input === "string" && input.trim())) {
    throw new Error("Every embedding input must be a non-empty string");
  }

  const { response, body } = await fetchJsonWithRetry("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, dimensions, input: inputs, encoding_format: "float" })
  });
  if (!response.ok) throw new Error(`OpenAI Embeddings API failed (${response.status}): ${body?.error?.message ?? "unknown error"}`);
  if (!Array.isArray(body.data) || body.data.length !== inputs.length) throw new Error("OpenAI Embeddings API returned an unexpected result count");

  const embeddings = body.data
    .sort((left, right) => left.index - right.index)
    .map(({ embedding }) => embedding);
  if (!embeddings.every((embedding) => Array.isArray(embedding) && embedding.every(Number.isFinite))) {
    throw new Error("OpenAI Embeddings API returned an invalid embedding");
  }

  return {
    provider,
    model: body.model ?? model,
    usage: body.usage ?? null,
    embeddings
  };
}
