import assert from "node:assert/strict";
import test from "node:test";
import { buildCoverageAudit, renderCoverageAuditMarkdown } from "../scripts/lib/coverage-audit.mjs";

const pspSource = { id: "psp-core-2025", name: "Chamber of Deputies open data", primary: true, evidenceRole: "primary-record", enabled: true, coverage: { mode: "term-snapshot", note: "Whole 10th term." } };
const counts = { primaryRecordsInWindowCount: 10, notAttributableSkippedCount: 7, materialPrimaryRecordCount: 3, directAssignmentCount: 1, routingReviewCount: 0, orphanReviewCount: 1, invalidPromiseTaggerCount: 0, invalidSourceTaggerCount: 0 };

function routingRun({ assignments = [], packages = [], completed = true } = {}) {
  return { schemaVersion: "1.0.0", asOf: "2026-09-23", completed, counts, sourceTagAssignments: assignments, builtPackages: packages };
}

const printActs = { quality: { prints: 2, bills: 2, billsWithText: 2, billsWithAmendedActs: 1, billsWithUnnamedActs: 0, printsWithIdentifiers: 1, textFetchFailures: 0 } };
const promiseRegistry = { promises: [{ id: "p1", partyId: "ano", partyName: "ANO", titleCz: "Slib" }] };

test("coverage audit never converts a promise without routed records into a score", () => {
  const audit = buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run-1", collectors: [{ sourceId: "psp-core-2025", collection: { mode: "full", since: "2025-10-01" }, warnings: ["Line one\nwith a | pipe"] }], records: [] },
    routingRun: routingRun(),
    printActs,
    promiseRegistry,
    sourceRegistry: { sources: [pspSource] },
    proposalManifest: { proposals: [] }
  });
  assert.equal(audit.promises[0].state, "no-routed-record");
  assert.equal(audit.promises[0].scoreInferred, false);
  assert.equal(audit.publicationApproved, false);
  assert.equal(audit.quality.notAttributableSkipped, 7);
  const markdown = renderCoverageAuditMarkdown(audit);
  assert.match(markdown, /No routed record is not zero points/);
  assert.match(markdown, /\| Bills with amended acts found \| 1 of 2 \|/);
  const sourceRows = markdown.split("\n").filter((line) => line.startsWith("| Chamber of Deputies open data"));
  assert.deepEqual(sourceRows, ["| Chamber of Deputies open data | 2025-10-01 | 0 | — to — | Line one with a \\| pipe |"], "runtime warning text must stay on one escaped table row");
});

test("a routed promise without attributable conduct and one with a package are told apart", () => {
  const audit = buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run-2", collectors: [], records: [] },
    routingRun: routingRun({
      assignments: [
        { route: { disposition: "candidate-created", candidatePromiseIds: ["p1", "p2"] } },
        { route: { disposition: "orphan-review", candidatePromiseIds: [] } }
      ],
      packages: [{ promiseId: "p2", built: true, selectedEvidenceCount: 1 }, { promiseId: "p1", built: false }]
    }),
    promiseRegistry: { promises: [...promiseRegistry.promises, { id: "p2", partyId: "spd", partyName: "SPD", titleCz: "Slib 2" }] },
    sourceRegistry: { sources: [] },
    proposalManifest: { proposals: [] }
  });
  assert.deepEqual(audit.promises.map(({ state, routedRecordCount }) => [state, routedRecordCount]), [["routed-without-attributable-conduct", 1], ["assessable-package", 1]]);
  assert.equal(audit.promises[1].evidencePackage, "evidence-packages/p2.json");
});

test("a partial routing run is refused", () => {
  assert.throws(() => buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run", collectors: [], records: [] },
    routingRun: routingRun({ completed: false }),
    promiseRegistry,
    sourceRegistry: { sources: [] },
    proposalManifest: { proposals: [] }
  }), /completed topic-routing run/);
});

test("an enabled source that was not collected is refused", () => {
  assert.throws(() => buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run-3", collectors: [], records: [] },
    routingRun: routingRun(),
    promiseRegistry,
    sourceRegistry: { sources: [pspSource, { ...pspSource, id: "disabled", enabled: false }] },
    proposalManifest: { proposals: [] }
  }), /Enabled source psp-core-2025 was not collected/);
});

test("coverage audit prefers the active human review proposal over the routing state", () => {
  const audit = buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run", collectors: [], records: [] },
    routingRun: routingRun({ packages: [{ promiseId: "p1", built: true, selectedEvidenceCount: 1 }] }),
    promiseRegistry,
    sourceRegistry: { sources: [] },
    proposalManifest: { proposals: [{ proposalId: "old", promiseId: "p1", resolutionState: "candidate", supersededByProposalId: "new" }, { proposalId: "new", promiseId: "p1", resolutionState: "human-review-required", candidateStatus: null, publicationApproved: false, supersededByProposalId: null }] }
  });
  assert.equal(audit.promises[0].state, "human-review-required");
  assert.equal(audit.promises[0].activeProposal.proposalId, "new");
});
