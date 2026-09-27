import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Plain progress lines for the GitHub Actions log: every step says what it is
// doing, long loops report in batches, and every paid model call reports its
// tokens and estimated cost.

const startedAt = Date.now();

function stamp() {
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  return `[${new Date().toISOString().slice(11, 19)} +${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s]`;
}

// Log lines go to stderr: a script's stdout may carry its machine-readable
// result (run-assessment.mjs).
export function log(message) {
  console.error(`${stamp()} ${message}`);
}

/**
 * Returns a tick function for a loop of `total` items. It logs every
 * `every` items, after `seconds` without a log line, and at the last item.
 */
export function progress(label, total, { every = 10, seconds = 30 } = {}) {
  let done = 0;
  let lastLoggedAt = Date.now();
  log(`${label}: ${total} to process`);
  return (detail = "") => {
    done += 1;
    if (done === total || done % every === 0 || Date.now() - lastLoggedAt >= seconds * 1000) {
      log(`${label}: ${done}/${total}${detail ? ` (last: ${detail})` : ""}`);
      lastLoggedAt = Date.now();
    }
  };
}

let prices = null;
function modelPrices() {
  if (prices) return prices;
  try {
    prices = JSON.parse(readFileSync(resolve("automation/model-prices.json"), "utf8"));
  } catch {
    prices = { models: {} };
  }
  return prices;
}

/**
 * Estimated cost in USD of one call from the provider's reported usage and
 * the published prices in automation/model-prices.json; null when either is
 * missing. A call processed in the Flex tier is priced at that tier's rates.
 * A request with more input tokens than the long-context threshold is priced
 * at the long-context rates in full. It is an estimate, not the provider's
 * invoice.
 */
export function estimateCallCost(model, usage, table = modelPrices(), serviceTier = null) {
  const tier = serviceTier === "flex" ? table.models?.[model]?.flex : table.models?.[model];
  if (!tier || !usage) return null;
  const input = usage.input_tokens ?? 0;
  const price = input > (table.longContextThresholdTokens ?? Number.POSITIVE_INFINITY) && tier.longContext ? tier.longContext : tier;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  return ((input - cached) * price.input + cached * price.cachedInput + output * price.output) / 1_000_000;
}

let processTotal = 0;

/**
 * Logs one paid model call and appends it to the JSONL file named by
 * SLIBY_MODEL_CALL_LOG, so the run's spend is known even after a failure.
 */
export function logModelCall({ label, model, usage, serviceTier = null, ok = true, error = null }) {
  const cost = estimateCallCost(model, usage, modelPrices(), serviceTier);
  if (cost !== null) processTotal += cost;
  const tokens = usage
    ? `${usage.input_tokens ?? 0} in (${usage.input_tokens_details?.cached_tokens ?? 0} cached) / ${usage.output_tokens ?? 0} out tokens`
    : "no usage reported";
  const costText = cost === null ? "cost unknown" : `≈ $${cost.toFixed(4)}`;
  log(`model call ${ok ? "ok" : "FAILED"} · ${model}${serviceTier ? ` (${serviceTier})` : ""} · ${label ?? "unlabelled"} · ${tokens} · ${costText} · this process ≈ $${processTotal.toFixed(2)}${error ? ` · ${error}` : ""}`);
  const file = process.env.SLIBY_MODEL_CALL_LOG;
  if (!file) return;
  // Logging must never stop a paid call from being used.
  try {
    mkdirSync(dirname(resolve(file)), { recursive: true });
    appendFileSync(resolve(file), `${JSON.stringify({ at: new Date().toISOString(), step: process.env.SLIBY_STEP ?? null, label: label ?? null, model, serviceTier, ok, usage: usage ?? null, estimatedCostUsd: cost, error })}\n`);
  } catch (writeError) {
    log(`could not append to the model-call log: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
  }
}
