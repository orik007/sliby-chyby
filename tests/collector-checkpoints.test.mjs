import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyCollectorCheckpoints,
  planSourceCollections,
  updateCollectorCheckpoints,
  validateCollectorCheckpoints
} from "../scripts/lib/collector-checkpoints.mjs";

const registry = {
  sources: [
    { id: "archive", bootstrapFrom: "2025-10-01" },
    { id: "new-source", bootstrapFrom: "2026-09-01" }
  ]
};

test("a missing source checkpoint causes only that source to bootstrap", () => {
  const checkpoints = emptyCollectorCheckpoints();
  checkpoints.sourceCheckpoints.archive = {
    lastSuccessfulCollectionAt: "2026-09-10T09:37:00.000Z",
    requestedSince: "2025-10-01",
    lastObservedRecordAt: "2026-09-10T08:00:00.000Z",
    lastRunId: "run-1",
    recordCount: 3,
    snapshotHash: null
  };
  validateCollectorCheckpoints(checkpoints, registry);
  const plan = planSourceCollections({ registry, checkpoints, sourceIds: ["archive", "new-source"] });
  assert.deepEqual(plan.map(({ sourceId, mode, since }) => ({ sourceId, mode, since })), [
    { sourceId: "archive", mode: "incremental", since: "2026-09-10" },
    { sourceId: "new-source", mode: "bootstrap", since: "2026-09-01" }
  ]);
});

test("a checkpoint advances only after its collector succeeded", () => {
  const checkpoints = emptyCollectorCheckpoints();
  const collectionPlan = planSourceCollections({ registry, checkpoints, sourceIds: ["archive"] });
  const updated = updateCollectorCheckpoints({
    checkpoints,
    registry,
    runId: "run-2",
    collectedAt: "2026-09-13T09:37:00.000Z",
    collectionPlan,
    collectorResults: [{
      sourceId: "archive",
      records: [{ occurredAt: "2026-09-12T10:00:00.000Z" }],
      snapshot: { contentHash: "a".repeat(64) }
    }]
  });
  assert.equal(updated.sourceCheckpoints.archive.lastSuccessfulCollectionAt, "2026-09-13T09:37:00.000Z");
  assert.equal(updated.sourceCheckpoints.archive.lastObservedRecordAt, "2026-09-12T10:00:00.000Z");
  assert.equal(updated.sourceCheckpoints["new-source"], undefined);
});
