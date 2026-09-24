import { invariant } from "./collector-core.mjs";

export const collectorCheckpointSchemaVersion = "1.0.0";
export const collectorCheckpointVersion = "per-source-v1";

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function emptyCollectorCheckpoints() {
  return {
    schemaVersion: collectorCheckpointSchemaVersion,
    checkpointVersion: collectorCheckpointVersion,
    sourceCheckpoints: {}
  };
}

export function validateCollectorCheckpoints(checkpoints, registry) {
  invariant(checkpoints && typeof checkpoints === "object", "Collector checkpoints must be an object");
  invariant(checkpoints.schemaVersion === collectorCheckpointSchemaVersion, "Unsupported collector checkpoint schemaVersion");
  invariant(checkpoints.checkpointVersion === collectorCheckpointVersion, "Unsupported collector checkpoint version");
  invariant(checkpoints.sourceCheckpoints && typeof checkpoints.sourceCheckpoints === "object" && !Array.isArray(checkpoints.sourceCheckpoints), "Collector checkpoints must contain sourceCheckpoints");
  const knownSourceIds = new Set(registry.sources.map(({ id }) => id));
  for (const [sourceId, checkpoint] of Object.entries(checkpoints.sourceCheckpoints)) {
    invariant(knownSourceIds.has(sourceId), `Collector checkpoint references unknown source ${sourceId}`);
    invariant(checkpoint && typeof checkpoint === "object", `Collector checkpoint for ${sourceId} must be an object`);
    invariant(isIsoDateTime(checkpoint.lastSuccessfulCollectionAt), `Collector checkpoint for ${sourceId} needs lastSuccessfulCollectionAt`);
    invariant(isIsoDate(checkpoint.requestedSince), `Collector checkpoint for ${sourceId} needs requestedSince`);
    invariant(checkpoint.lastObservedRecordAt === null || isIsoDateTime(checkpoint.lastObservedRecordAt), `Collector checkpoint for ${sourceId} has invalid lastObservedRecordAt`);
    invariant(typeof checkpoint.lastRunId === "string" && checkpoint.lastRunId.length > 0, `Collector checkpoint for ${sourceId} needs lastRunId`);
    invariant(Number.isInteger(checkpoint.recordCount) && checkpoint.recordCount >= 0, `Collector checkpoint for ${sourceId} has invalid recordCount`);
    invariant(checkpoint.snapshotHash === null || /^[a-f0-9]{64}$/.test(checkpoint.snapshotHash), `Collector checkpoint for ${sourceId} has invalid snapshotHash`);
  }
  return checkpoints;
}

function snapshotHash(result) {
  if (result.snapshot?.contentHash) return result.snapshot.contentHash;
  const snapshots = Array.isArray(result.snapshots)
    ? result.snapshots
    : result.snapshots && typeof result.snapshots === "object"
      ? Object.values(result.snapshots)
      : [];
  return snapshots.map((snapshot) => snapshot?.contentHash).filter(Boolean).at(-1) ?? null;
}

/**
 * Every run collects every source completely from its bootstrapFrom date, so
 * each evidence package is built from the whole record history. A checkpoint
 * only records the last successful collection; it never limits what is
 * collected.
 */
export function planSourceCollections({ registry, checkpoints, sourceIds }) {
  validateCollectorCheckpoints(checkpoints, registry);
  return sourceIds.map((sourceId) => {
    const source = registry.sources.find(({ id }) => id === sourceId);
    invariant(source, `Unknown collector source ${sourceId}`);
    return {
      sourceId,
      mode: "full",
      since: source.bootstrapFrom,
      checkpointBefore: checkpoints.sourceCheckpoints[sourceId] ?? null
    };
  });
}

export function updateCollectorCheckpoints({ checkpoints, registry, runId, collectedAt, collectorResults, collectionPlan }) {
  validateCollectorCheckpoints(checkpoints, registry);
  invariant(typeof runId === "string" && runId.length > 0, "Collector checkpoint update needs runId");
  invariant(isIsoDateTime(collectedAt), "Collector checkpoint update needs collectedAt");
  const plannedById = new Map(collectionPlan.map((plan) => [plan.sourceId, plan]));
  const updated = structuredClone(checkpoints);
  for (const result of collectorResults) {
    const plan = plannedById.get(result.sourceId);
    invariant(plan, `Collector result for ${result.sourceId} is missing a collection plan`);
    invariant(Array.isArray(result.records), `Collector result for ${result.sourceId} is missing records`);
    const observed = result.records.map(({ occurredAt }) => occurredAt).filter(Boolean).sort();
    updated.sourceCheckpoints[result.sourceId] = {
      lastSuccessfulCollectionAt: collectedAt,
      requestedSince: plan.since,
      lastObservedRecordAt: observed.at(-1) ?? null,
      lastRunId: runId,
      recordCount: result.records.length,
      snapshotHash: snapshotHash(result)
    };
  }
  return validateCollectorCheckpoints(updated, registry);
}
