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

/**
 * Drops the checkpoints of sources removed from the registry, so a source
 * retired by a confirmed rule change never blocks the next run. A disabled
 * source still in the registry keeps its checkpoint.
 */
export function withoutRemovedSourceCheckpoints(checkpoints, registry) {
  const knownSourceIds = new Set(registry.sources.map(({ id }) => id));
  const sourceCheckpoints = Object.fromEntries(Object.entries(checkpoints?.sourceCheckpoints ?? {})
    .filter(([sourceId]) => knownSourceIds.has(sourceId)));
  return validateCollectorCheckpoints({ ...checkpoints, sourceCheckpoints }, registry);
}

function checkpointSince(checkpoint) {
  return checkpoint.lastSuccessfulCollectionAt.slice(0, 10);
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

export function planSourceCollections({ registry, checkpoints, sourceIds, requestedSince = null }) {
  if (requestedSince !== null) invariant(isIsoDate(requestedSince), "Requested collection start must use YYYY-MM-DD");
  validateCollectorCheckpoints(checkpoints, registry);
  return sourceIds.map((sourceId) => {
    const source = registry.sources.find(({ id }) => id === sourceId);
    invariant(source, `Unknown collector source ${sourceId}`);
    const checkpoint = checkpoints.sourceCheckpoints[sourceId] ?? null;
    const since = requestedSince ?? (checkpoint ? checkpointSince(checkpoint) : source.bootstrapFrom);
    return {
      sourceId,
      mode: requestedSince ? "manual-override" : checkpoint ? "incremental" : "bootstrap",
      since,
      checkpointBefore: checkpoint
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
