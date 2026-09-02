import assert from "node:assert/strict";
import test from "node:test";
import { buildCoverageAudit, renderCoverageAuditMarkdown } from "../scripts/lib/coverage-audit.mjs";

test("coverage audit never converts missing evidence into a score", () => {
  const audit = buildCoverageAudit({
    collectorRun: {
      schemaVersion: "1.0.0", runId: "run-1", since: "2025-10-01",
      collectors: [{ sourceId: "feed", warnings: [] }],
      records: []
    },
    matcherRun: {
      schemaVersion: "1.0.0", matchedAt: "2026-09-02T00:00:00Z", asOf: "2026-09-02",
      promiseResults: [{ promiseId: "p1", candidateMatchCount: 0, attributablePrimaryMatchCount: 0, evidencePackage: null }]
    },
    promiseRegistry: { promises: [{ id: "p1", partyId: "ano", partyName: "ANO", titleCz: "Slib" }] },
    sourceRegistry: { sources: [{ id: "feed", name: "Feed", primary: false, evidenceRole: "discovery-context", coverage: { mode: "current-window", note: "Only current items." } }] },
    proposalManifest: { proposals: [] }
  });
  assert.equal(audit.promises[0].state, "no-candidate-match");
  assert.equal(audit.promises[0].scoreInferred, false);
  assert.equal(audit.publicationApproved, false);
  assert.match(renderCoverageAuditMarkdown(audit), /No match is not zero points/);
});

test("coverage audit prefers the active human review proposal over raw match state", () => {
  const base = {
    collectorRun: { schemaVersion: "1.0.0", runId: "run", since: "2025-10-01", collectors: [], records: [] },
    matcherRun: { schemaVersion: "1.0.0", matchedAt: "now", asOf: "2026-09-02", promiseResults: [{ promiseId: "p", candidateMatchCount: 1, attributablePrimaryMatchCount: 1, evidencePackage: "p.json" }] },
    promiseRegistry: { promises: [{ id: "p", partyId: "spd", partyName: "SPD", titleCz: "Slib" }] },
    sourceRegistry: { sources: [] },
    proposalManifest: { proposals: [{ proposalId: "old", promiseId: "p", resolutionState: "candidate", supersededByProposalId: "new" }, { proposalId: "new", promiseId: "p", resolutionState: "human-review-required", candidateStatus: null, publicationApproved: false, supersededByProposalId: null }] }
  };
  const audit = buildCoverageAudit(base);
  assert.equal(audit.promises[0].state, "human-review-required");
  assert.equal(audit.promises[0].activeProposal.proposalId, "new");
});
