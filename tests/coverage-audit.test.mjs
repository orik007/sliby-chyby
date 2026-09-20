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
    sourceRegistry: { sources: [{ id: "feed", name: "Feed", primary: false, evidenceRole: "discovery-context", enabled: true, coverage: { mode: "current-window", note: "Only current items." } }] },
    proposalManifest: { proposals: [] }
  });
  assert.equal(audit.promises[0].state, "no-candidate-match");
  assert.equal(audit.promises[0].scoreInferred, false);
  assert.equal(audit.publicationApproved, false);
  assert.match(renderCoverageAuditMarkdown(audit), /No match is not zero points/);
});

test("a source whose own collection failed still appears in sourceCoverage, marked as not collected", () => {
  const audit = buildCoverageAudit({
    collectorRun: {
      schemaVersion: "1.0.0", runId: "run-2", since: "2025-10-01",
      // The failed source is entirely absent from `collectors` (per-source
      // failure isolation in run-collectors.mjs), same as a real degraded run.
      collectors: [],
      failures: [{ sourceId: "msmt-news-api", message: "Source msmt-news-api returned HTTP 403" }],
      records: []
    },
    matcherRun: {
      schemaVersion: "1.0.0", matchedAt: "2026-09-19T00:00:00Z", asOf: "2026-09-19",
      promiseResults: [{ promiseId: "p1", candidateMatchCount: 0, attributablePrimaryMatchCount: 0, evidencePackage: null }]
    },
    promiseRegistry: { promises: [{ id: "p1", partyId: "ano", partyName: "ANO", titleCz: "Slib" }] },
    sourceRegistry: {
      sources: [
        { id: "msmt-news-api", name: "Ministry of Education news archive", primary: true, evidenceRole: "official-discovery", enabled: true, coverage: { mode: "since-filtered-archive", note: "Cursor-paginated archive." } },
        { id: "disabled-source", name: "Disabled source", primary: false, evidenceRole: "discovery-context", enabled: false, coverage: { mode: "current-window", note: "n/a" } }
      ]
    },
    proposalManifest: { proposals: [] }
  });
  assert.equal(audit.sourceCoverage.length, 1, "a disabled source must not appear, but an enabled failed source must");
  const [row] = audit.sourceCoverage;
  assert.equal(row.sourceId, "msmt-news-api");
  assert.equal(row.collected, false);
  assert.match(row.warnings[0], /HTTP 403/);
  const markdown = renderCoverageAuditMarkdown(audit);
  assert.match(markdown, /\*\*no\*\* — Not collected this run -- collection failed: Source msmt-news-api returned HTTP 403/);
});

test("a failed source's requestedSince comes from its own collectionPlan entry, not the null run-wide override", () => {
  const audit = buildCoverageAudit({
    collectorRun: {
      // A normal checkpoint-driven run never passes --since, so the
      // run-wide `since` is null; only collectionPlan carries each
      // source's own planned start.
      schemaVersion: "1.0.0", runId: "run-4", since: null,
      collectionPlan: [{ sourceId: "msmt-news-api", mode: "incremental", since: "2026-09-10", checkpointBefore: null }],
      collectors: [],
      failures: [{ sourceId: "msmt-news-api", message: "HTTP 403" }],
      records: []
    },
    matcherRun: { schemaVersion: "1.0.0", matchedAt: "now", asOf: "2026-09-20", promiseResults: [{ promiseId: "p1", candidateMatchCount: 0, attributablePrimaryMatchCount: 0, evidencePackage: null }] },
    promiseRegistry: { promises: [{ id: "p1", partyId: "ano", partyName: "ANO", titleCz: "Slib" }] },
    sourceRegistry: { sources: [{ id: "msmt-news-api", name: "Ministry of Education news archive", primary: true, evidenceRole: "official-discovery", enabled: true, coverage: { mode: "since-filtered-archive", note: "n/a" } }] },
    proposalManifest: { proposals: [] }
  });
  assert.equal(audit.sourceCoverage[0].requestedSince, "2026-09-10", "a failed source's own planned start must not be lost behind the null run-wide override");
});

test("a failure message with a newline or a pipe cannot break the source coverage Markdown table", () => {
  const audit = buildCoverageAudit({
    collectorRun: {
      schemaVersion: "1.0.0", runId: "run-3", since: "2025-10-01",
      collectors: [],
      failures: [{ sourceId: "feed", message: "Request failed\nwith a | pipe and   extra   spaces" }],
      records: []
    },
    matcherRun: { schemaVersion: "1.0.0", matchedAt: "now", asOf: "2026-09-19", promiseResults: [{ promiseId: "p1", candidateMatchCount: 0, attributablePrimaryMatchCount: 0, evidencePackage: null }] },
    promiseRegistry: { promises: [{ id: "p1", partyId: "ano", partyName: "ANO", titleCz: "Slib" }] },
    sourceRegistry: { sources: [{ id: "feed", name: "Feed", primary: false, evidenceRole: "discovery-context", enabled: true, coverage: { mode: "current-window", note: "n/a" } }] },
    proposalManifest: { proposals: [] }
  });
  const markdown = renderCoverageAuditMarkdown(audit);
  const tableLines = markdown.split("\n").filter((line) => line.startsWith("| Feed"));
  assert.equal(tableLines.length, 1, "a newline in the failure message must not create an extra table row");
  assert.ok(!tableLines[0].includes("\n"), "the rendered row must not contain a literal newline");
  assert.ok(tableLines[0].includes("a \\| pipe"), "a literal pipe in the message must be escaped, not left to split the table into an extra column");
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
