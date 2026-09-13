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

  const response = await fetch("https://api.openai.com/v1/responses", {
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

  const body = await response.json();
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

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, dimensions, input: inputs, encoding_format: "float" })
  });
  const body = await response.json();
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
