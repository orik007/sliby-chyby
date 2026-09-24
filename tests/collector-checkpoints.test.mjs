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

test("every source is collected completely from its bootstrapFrom date, whatever its checkpoint", () => {
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
    { sourceId: "archive", mode: "full", since: "2025-10-01" },
    { sourceId: "new-source", mode: "full", since: "2026-09-01" }
  ]);
  assert.equal(plan[0].checkpointBefore.lastRunId, "run-1");
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

test("a PSP snapshot map contributes an available checkpoint hash", () => {
  const checkpoints = emptyCollectorCheckpoints();
  const collectionPlan = planSourceCollections({ registry, checkpoints, sourceIds: ["archive"] });
  const updated = updateCollectorCheckpoints({
    checkpoints,
    registry,
    runId: "run-psp",
    collectedAt: "2026-09-13T09:37:00.000Z",
    collectionPlan,
    collectorResults: [{
      sourceId: "archive",
      records: [],
      snapshots: {
        votes: { contentHash: "a".repeat(64) },
        members: { contentHash: "b".repeat(64) },
        prints: { contentHash: "c".repeat(64) }
      }
    }]
  });
  assert.equal(updated.sourceCheckpoints.archive.snapshotHash, "c".repeat(64));
});
