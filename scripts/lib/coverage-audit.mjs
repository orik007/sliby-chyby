import { invariant } from "./collector-core.mjs";

const STATE_LABELS = {
  "review-candidate": "Assessment candidate awaiting human review",
  "human-review-required": "Human review required; no proposed public score",
  "assessable-package": "Assessable primary-evidence package; not yet proposed",
  "routed-without-attributable-conduct": "Records routed, but none is attributable conduct",
  "no-routed-record": "No record routed in this run"
};

function activeProposals(manifest) {
  const active = new Map();
  for (const proposal of manifest.proposals ?? []) {
    if (proposal.supersededByProposalId === null || proposal.supersededByProposalId === undefined) {
      invariant(!active.has(proposal.promiseId), `Multiple active proposals for ${proposal.promiseId}`);
      active.set(proposal.promiseId, proposal);
    }
  }
  return active;
}

function stateFor(result, proposal) {
  if (proposal?.resolutionState === "candidate") return "review-candidate";
  if (proposal?.resolutionState === "human-review-required") return "human-review-required";
  if (result.evidencePackage) return "assessable-package";
  if (result.routedRecordCount > 0) return "routed-without-attributable-conduct";
  return "no-routed-record";
}

// Per-promise routing results from a completed topic-routing report.
function promiseResults(routingRun, promises) {
  const routedCounts = new Map();
  for (const { route } of routingRun.sourceTagAssignments) {
    if (route.disposition !== "candidate-created") continue;
    for (const promiseId of route.candidatePromiseIds) routedCounts.set(promiseId, (routedCounts.get(promiseId) ?? 0) + 1);
  }
  const packages = new Map(routingRun.builtPackages.filter((entry) => entry.built).map((entry) => [entry.promiseId, entry]));
  return new Map(promises.map((promise) => {
    const built = packages.get(promise.id);
    return [promise.id, {
      routedRecordCount: routedCounts.get(promise.id) ?? 0,
      attributableEvidenceCount: built?.selectedEvidenceCount ?? 0,
      evidencePackage: built ? `evidence-packages/${promise.id}.json` : null
    }];
  }));
}

export function buildCoverageAudit({ collectorRun, routingRun, printActs, promiseRegistry, sourceRegistry, proposalManifest }) {
  invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
  invariant(routingRun?.schemaVersion === "1.0.0" && Array.isArray(routingRun.sourceTagAssignments) && Array.isArray(routingRun.builtPackages), "Invalid topic-routing run");
  invariant(routingRun.completed === true, "A coverage audit needs a completed topic-routing run");
  invariant(Array.isArray(promiseRegistry?.promises), "Invalid promise registry");
  invariant(Array.isArray(sourceRegistry?.sources), "Invalid source registry");
  const results = promiseResults(routingRun, promiseRegistry.promises);
  const proposals = activeProposals(proposalManifest);
  const sources = new Map(sourceRegistry.sources.map((source) => [source.id, source]));
  const recordsBySource = new Map();
  const observedRangeBySource = new Map();
  for (const record of collectorRun.records) {
    recordsBySource.set(record.sourceId, (recordsBySource.get(record.sourceId) ?? 0) + 1);
    if (!record.occurredAt) continue;
    const range = observedRangeBySource.get(record.sourceId);
    if (!range) observedRangeBySource.set(record.sourceId, { earliest: record.occurredAt, latest: record.occurredAt });
    else {
      if (record.occurredAt < range.earliest) range.earliest = record.occurredAt;
      if (record.occurredAt > range.latest) range.latest = record.occurredAt;
    }
  }

  const collectorsBySourceId = new Map();
  for (const collector of collectorRun.collectors) {
    invariant(sources.has(collector.sourceId), `Collector run references unknown source ${collector.sourceId}`);
    collectorsBySourceId.set(collector.sourceId, collector);
  }
  const sourceCoverage = sourceRegistry.sources.filter((source) => source.enabled).map((source) => {
    const collector = collectorsBySourceId.get(source.id);
    invariant(collector, `Enabled source ${source.id} was not collected in this run`);
    const range = observedRangeBySource.get(source.id);
    return {
      sourceId: source.id,
      name: source.name,
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      coverageMode: source.coverage.mode,
      coverageNote: source.coverage.note,
      collectedSince: collector.collection.since,
      recordCount: recordsBySource.get(source.id) ?? 0,
      observedEarliest: range?.earliest ?? null,
      observedLatest: range?.latest ?? null,
      warnings: collector.warnings ?? []
    };
  });

  const promises = promiseRegistry.promises.map((promise) => {
    const result = results.get(promise.id);
    const proposal = proposals.get(promise.id) ?? null;
    const state = stateFor(result, proposal);
    return {
      promiseId: promise.id,
      partyId: promise.partyId,
      partyName: promise.partyName,
      titleCz: promise.titleCz,
      state,
      stateLabel: STATE_LABELS[state],
      routedRecordCount: result.routedRecordCount,
      attributableEvidenceCount: result.attributableEvidenceCount,
      evidencePackage: result.evidencePackage,
      activeProposal: proposal ? {
        proposalId: proposal.proposalId,
        resolutionState: proposal.resolutionState,
        candidateStatus: proposal.candidateStatus,
        publicationApproved: proposal.publicationApproved
      } : null,
      scoreInferred: false,
      publicationApproved: false
    };
  });

  const stateCounts = Object.fromEntries(Object.keys(STATE_LABELS).map((state) => [state, promises.filter((promise) => promise.state === state).length]));
  const parties = [...new Set(promises.map(({ partyId }) => partyId))].map((partyId) => ({
    partyId,
    partyName: promises.find((promise) => promise.partyId === partyId).partyName,
    promiseCount: promises.filter((promise) => promise.partyId === partyId).length,
    states: Object.fromEntries(Object.keys(STATE_LABELS).map((state) => [state, promises.filter((promise) => promise.partyId === partyId && promise.state === state).length]))
  }));

  return {
    schemaVersion: "1.0.0",
    auditVersion: "coverage-audit-v1",
    generatedAt: new Date().toISOString(),
    collectorRunId: collectorRun.runId,
    assessmentCutoff: routingRun.asOf,
    promiseCount: promises.length,
    quality: {
      primaryRecordsInWindow: routingRun.counts.primaryRecordsInWindowCount,
      notAttributableSkipped: routingRun.counts.notAttributableSkippedCount,
      routedRecords: routingRun.counts.materialPrimaryRecordCount,
      directLinks: routingRun.counts.directAssignmentCount,
      routingReview: routingRun.counts.routingReviewCount,
      orphanReview: routingRun.counts.orphanReviewCount,
      invalidTaggerOutputs: routingRun.counts.invalidPromiseTaggerCount + routingRun.counts.invalidSourceTaggerCount,
      printActs: printActs?.quality ?? null
    },
    stateCounts,
    parties,
    sourceCoverage,
    promises,
    scoreInferred: false,
    publicationApproved: false,
    warnings: [
      "No routed record does not mean no action and must never be converted into zero points.",
      "This audit reports pipeline coverage and review state; it does not assess political promises."
    ]
  };
}

// Runtime text may contain newlines or pipes that would break a table row.
function renderMarkdownCell(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
}

export function renderCoverageAuditMarkdown(audit) {
  const quality = audit.quality;
  const printActs = quality.printActs;
  const lines = [
    "# Evidence coverage audit",
    "",
    `Generated for ${audit.promiseCount} confirmed promises; assessment cutoff ${audit.assessmentCutoff}.`,
    "",
    "> This is a pipeline-coverage report, not a political assessment. No routed record is not zero points.",
    "",
    "## Data quality",
    "",
    "| Measure | Count |",
    "|---|---:|",
    `| Primary records in the window | ${quality.primaryRecordsInWindow} |`,
    `| Skipped: cannot be attributable conduct | ${quality.notAttributableSkipped} |`,
    `| Routed records | ${quality.routedRecords} |`,
    `| Direct legal-identifier links | ${quality.directLinks} |`,
    `| Routing review | ${quality.routingReview} |`,
    `| Orphan review | ${quality.orphanReview} |`,
    `| Invalid tagger outputs | ${quality.invalidTaggerOutputs} |`,
    ...(printActs ? [
      `| Bills with official text | ${printActs.billsWithText} of ${printActs.bills} |`,
      `| Bills with amended acts found | ${printActs.billsWithAmendedActs} of ${printActs.bills} |`,
      `| Print-text fetch failures | ${printActs.textFetchFailures} |`
    ] : []),
    "",
    "## Summary",
    "",
    "| State | Count |",
    "|---|---:|",
    ...Object.entries(audit.stateCounts).map(([state, count]) => `| ${STATE_LABELS[state]} | ${count} |`),
    "",
    "## Source coverage",
    "",
    "| Source | Collected since | Records | Observed range | Warnings |",
    "|---|---|---:|---|---|",
    ...audit.sourceCoverage.map((source) => `| ${source.name} | ${source.collectedSince} | ${source.recordCount} | ${source.observedEarliest?.slice(0, 10) ?? "—"} to ${source.observedLatest?.slice(0, 10) ?? "—"} | ${source.warnings.length === 0 ? "—" : renderMarkdownCell(source.warnings.join("; "))} |`),
    "",
    "## Promise coverage",
    "",
    "| Party | Promise | State | Routed records | Attributable evidence |",
    "|---|---|---|---:|---:|",
    ...audit.promises.map((promise) => `| ${promise.partyName} | ${promise.titleCz} | ${promise.stateLabel} | ${promise.routedRecordCount} | ${promise.attributableEvidenceCount} |`),
    ""
  ];
  return lines.join("\n");
}
