import { invariant } from "./collector-core.mjs";

const STATE_LABELS = {
  "evidence-package-ready": "Traceable evidence package ready",
  "potential-match": "Potential matches found; no attributable primary evidence package",
  "no-potential-match": "No potential match found in this run"
};

function stateFor(result) {
  if (result.evidencePackage) return "evidence-package-ready";
  if (result.candidateMatchCount > 0) return "potential-match";
  return "no-potential-match";
}

export function buildCoverageAudit({ collectorRun, matcherRun, promiseRegistry, sourceRegistry }) {
  invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
  invariant(matcherRun?.schemaVersion === "1.0.0" && Array.isArray(matcherRun.promiseResults), "Invalid matcher run");
  invariant(Array.isArray(promiseRegistry?.promises), "Invalid promise registry");
  invariant(Array.isArray(sourceRegistry?.sources), "Invalid source registry");
  const results = new Map(matcherRun.promiseResults.map((result) => [result.promiseId, result]));
  const sources = new Map(sourceRegistry.sources.map((source) => [source.id, source]));
  const recordsBySource = new Map();
  for (const record of collectorRun.records) recordsBySource.set(record.sourceId, (recordsBySource.get(record.sourceId) ?? 0) + 1);

  const sourceCoverage = collectorRun.collectors.map((collector) => {
    const source = sources.get(collector.sourceId);
    invariant(source, `Collector run references unknown source ${collector.sourceId}`);
    const occurred = collectorRun.records.filter(({ sourceId, occurredAt }) => sourceId === source.id && occurredAt).map(({ occurredAt }) => occurredAt).sort();
    return {
      sourceId: source.id,
      name: source.name,
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      coverageMode: source.coverage.mode,
      coverageNote: source.coverage.note,
      requestedSince: collectorRun.since,
      recordCount: recordsBySource.get(source.id) ?? 0,
      observedEarliest: occurred[0] ?? null,
      observedLatest: occurred.at(-1) ?? null,
      warnings: collector.warnings ?? []
    };
  });

  const promises = promiseRegistry.promises.map((promise) => {
    const result = results.get(promise.id);
    invariant(result, `Matcher run is missing promise ${promise.id}`);
    const state = stateFor(result);
    return {
      promiseId: promise.id,
      partyId: promise.partyId,
      partyName: promise.partyName,
      titleCz: promise.titleCz,
      state,
      stateLabel: STATE_LABELS[state],
      potentialMatchCount: result.candidateMatchCount,
      attributablePrimaryMatchCount: result.attributablePrimaryMatchCount,
      evidencePackage: result.evidencePackage
    };
  });

  const stateCounts = Object.fromEntries(Object.keys(STATE_LABELS).map((state) => [state, promises.filter((promise) => promise.state === state).length]));
  return {
    schemaVersion: "1.0.0",
    auditVersion: "coverage-audit-v2",
    generatedAt: new Date().toISOString(),
    collectorRunId: collectorRun.runId,
    matchedAt: matcherRun.matchedAt,
    requestedSince: collectorRun.since,
    assessmentCutoff: matcherRun.asOf,
    promiseCount: promises.length,
    stateCounts,
    sourceCoverage,
    promises,
    warnings: [
      "No potential match does not mean no action and must not change a score.",
      "A current-window source cannot provide historical completeness merely because the run requested an earlier date.",
      "This audit reports collection and matching coverage, not political scores."
    ]
  };
}

export function renderCoverageAuditMarkdown(audit) {
  const lines = [
    "# Evidence coverage audit",
    "",
    `Generated for ${audit.promiseCount} confirmed promises; cutoff ${audit.assessmentCutoff}.`,
    "",
    "> This is a collection-and-matching report. A missing match does not change a promise score.",
    "",
    "## Summary",
    "",
    "| Coverage result | Count |",
    "|---|---:|",
    ...Object.entries(audit.stateCounts).map(([state, count]) => `| ${STATE_LABELS[state]} | ${count} |`),
    "",
    "## Source coverage",
    "",
    "| Source | Mode | Records | Observed range | Limitation |",
    "|---|---|---:|---|---|",
    ...audit.sourceCoverage.map((source) => `| ${source.name} | \`${source.coverageMode}\` | ${source.recordCount} | ${source.observedEarliest?.slice(0, 10) ?? "—"} to ${source.observedLatest?.slice(0, 10) ?? "—"} | ${source.coverageNote} |`),
    "",
    "## Promise coverage",
    "",
    "| Party | Promise | Result | Potential matches | Attributable primary |",
    "|---|---|---|---:|---:|",
    ...audit.promises.map((promise) => `| ${promise.partyName} | ${promise.titleCz} | ${promise.stateLabel} | ${promise.potentialMatchCount} | ${promise.attributablePrimaryMatchCount} |`),
    ""
  ];
  return lines.join("\n");
}
