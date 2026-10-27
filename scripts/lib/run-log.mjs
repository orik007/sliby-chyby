import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, readSync, statSync } from "node:fs";
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
 * missing, or when the call was processed in a tier other than standard or
 * Flex, which the table does not price.
 * A request with more input tokens than the long-context threshold is priced
 * at the long-context rates in full. Input tokens are billed in three
 * disjoint parts: cached input, input written to the prompt cache (at the
 * cache-write rate), and the rest at the uncached rate. It is an estimate, not
 * the provider's invoice; null when a call wrote to the cache and the table has
 * no cache-write rate.
 */
export function estimateCallCost(model, usage, table = modelPrices(), serviceTier = null) {
  if (serviceTier && !["default", "flex"].includes(serviceTier)) return null;
  const tier = serviceTier === "flex" ? table.models?.[model]?.flex : table.models?.[model];
  if (!tier || !usage) return null;
  const input = usage.input_tokens ?? 0;
  const price = input > (table.longContextThresholdTokens ?? Number.POSITIVE_INFINITY) && tier.longContext ? tier.longContext : tier;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const written = usage.input_tokens_details?.cache_write_tokens ?? 0;
  if (written > 0 && price.cacheWrite == null) return null;
  const output = usage.output_tokens ?? 0;
  return ((input - cached - written) * price.input + cached * price.cachedInput + (written > 0 ? written * price.cacheWrite : 0) + output * price.output) / 1_000_000;
}

let processTotal = 0;

/** The estimated spend of the calls a model-call log (SLIBY_MODEL_CALL_LOG) records. */
export function spendInModelCallLog(file) {
  if (!file) return 0;
  let content;
  try {
    content = readFileSync(resolve(file), "utf8");
  } catch {
    return 0;
  }
  return content.split("\n").filter((line) => line.trim() !== "").reduce((sum, line) => {
    try {
      return sum + (JSON.parse(line).estimatedCostUsd ?? 0);
    } catch {
      return sum;
    }
  }, 0);
}

// The run's model-call log, read on from where it was read last: every
// process of the run (its steps, and the parallel assessments of a step)
// appends to it, so it holds what they all spent.
const runLog = { offset: 0, total: 0 };
function runLogSpend(file) {
  let size;
  try {
    size = statSync(resolve(file)).size;
  } catch {
    return runLog.total;
  }
  if (size <= runLog.offset) return runLog.total;
  const handle = openSync(resolve(file), "r");
  try {
    const bytes = Buffer.alloc(size - runLog.offset);
    readSync(handle, bytes, 0, bytes.length, runLog.offset);
    // Only whole lines count; a line still being written is read next time.
    const text = bytes.toString("utf8");
    const end = text.lastIndexOf("\n") + 1;
    for (const line of text.slice(0, end).split("\n")) {
      if (line.trim() === "") continue;
      try {
        runLog.total += JSON.parse(line).estimatedCostUsd ?? 0;
      } catch {
        // A damaged line adds nothing.
      }
    }
    runLog.offset += Buffer.byteLength(text.slice(0, end), "utf8");
  } finally {
    closeSync(handle);
  }
  return runLog.total;
}

/** The estimated model spend of this run so far, by every process of it; this process's alone without a model-call log. */
export function runSpendUsd(file = process.env.SLIBY_MODEL_CALL_LOG) {
  return file ? runLogSpend(file) : processTotal;
}

/**
 * Stops a paid call once the run's estimated spend has reached its limit,
 * SLIBY_MAX_SPEND_USD (docs/evidence-pipeline.md, Audit and cost control);
 * no limit when it is empty.
 */
export function assertSpendWithinLimit(env = process.env, spent = runSpendUsd()) {
  const value = env.SLIBY_MAX_SPEND_USD ?? "";
  if (value === "") return;
  const limit = Number(value);
  if (!(limit > 0)) throw new Error(`SLIBY_MAX_SPEND_USD must be a positive number of USD, not "${value}"`);
  if (spent >= limit) throw new Error(`The run's estimated model spend reached its limit, $${spent.toFixed(2)} of $${limit.toFixed(2)} (max_spend_usd); no further paid call is made`);
}

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
