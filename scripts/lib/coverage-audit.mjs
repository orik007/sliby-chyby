import { invariant } from "./collector-core.mjs";

const STATE_LABELS = {
  "review-candidate": "Assessment candidate awaiting human review",
  "human-review-required": "Human review required; no proposed public score",
  "assessable-package": "Assessable primary-evidence package; not yet proposed",
  "candidate-matches-without-attributable-primary": "Candidate matches found, but no attributable primary evidence",
  "no-candidate-match": "No candidate match found in this run"
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
  if (result.candidateMatchCount > 0) return "candidate-matches-without-attributable-primary";
  return "no-candidate-match";
}

export function buildCoverageAudit({ collectorRun, matcherRun, promiseRegistry, sourceRegistry, proposalManifest }) {
  invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
  invariant(matcherRun?.schemaVersion === "1.0.0" && Array.isArray(matcherRun.promiseResults), "Invalid matcher run");
  invariant(Array.isArray(promiseRegistry?.promises), "Invalid promise registry");
  invariant(Array.isArray(sourceRegistry?.sources), "Invalid source registry");
  const results = new Map(matcherRun.promiseResults.map((result) => [result.promiseId, result]));
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
  const failuresBySourceId = new Map((collectorRun.failures ?? []).map((failure) => [failure.sourceId, failure]));
  // `collectorRun.since` is the run-wide override (null on an ordinary
  // checkpoint-driven run); a source with no `collector` entry still has
  // its own planned start in `collectionPlan`, which must be preferred so
  // a failed or manually-excluded source doesn't misreport `null`.
  const collectionPlanBySourceId = new Map((collectorRun.collectionPlan ?? []).map((plan) => [plan.sourceId, plan]));

  // Every *enabled* source gets a row, per the evidence-pipeline rule ("write
  // a coverage audit for every confirmed promise and enabled source") --
  // not just the ones `run-collectors.mjs` actually collected this run. A
  // source whose own collection failed (or one excluded from a targeted
  // manual replay) must still be visible here as a gap, rather than
  // silently disappearing as if it were never enabled at all.
  const sourceCoverage = sourceRegistry.sources.filter((source) => source.enabled).map((source) => {
    const collector = collectorsBySourceId.get(source.id);
    const failure = failuresBySourceId.get(source.id);
    const range = observedRangeBySource.get(source.id);
    return {
      sourceId: source.id,
      name: source.name,
      primary: source.primary,
      evidenceRole: source.evidenceRole,
      coverageMode: source.coverage.mode,
      coverageNote: source.coverage.note,
      requestedSince: collector?.collection?.since ?? collectionPlanBySourceId.get(source.id)?.since ?? collectorRun.since,
      recordCount: recordsBySource.get(source.id) ?? 0,
      observedEarliest: range?.earliest ?? null,
      observedLatest: range?.latest ?? null,
      collected: Boolean(collector),
      warnings: collector
        ? (collector.warnings ?? [])
        : [failure ? `Not collected this run -- collection failed: ${failure.message}` : "Not collected this run."]
    };
  });

  const promises = promiseRegistry.promises.map((promise) => {
    const result = results.get(promise.id);
    invariant(result, `Matcher run is missing promise ${promise.id}`);
    const proposal = proposals.get(promise.id) ?? null;
    const state = stateFor(result, proposal);
    return {
      promiseId: promise.id,
      partyId: promise.partyId,
      partyName: promise.partyName,
      titleCz: promise.titleCz,
      state,
      stateLabel: STATE_LABELS[state],
      candidateMatchCount: result.candidateMatchCount,
      attributablePrimaryMatchCount: result.attributablePrimaryMatchCount,
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
    matchedAt: matcherRun.matchedAt,
    requestedSince: collectorRun.since,
    assessmentCutoff: matcherRun.asOf,
    promiseCount: promises.length,
    stateCounts,
    parties,
    sourceCoverage,
    promises,
    scoreInferred: false,
    publicationApproved: false,
    warnings: [
      "No candidate match does not mean no action and must never be converted into zero points.",
      "A current-window source cannot provide historical completeness merely because the run requested an earlier date.",
      "This audit reports pipeline coverage and review state; it does not assess political promises."
    ]
  };
}

// A warning or failure message is arbitrary runtime text (a thrown error's
// own message, or a collector's parsed-content warning) -- never assume it
// is safe to drop straight into a Markdown table cell. A newline would
// break out of the row; an unescaped `|` would split it into extra columns.
function renderMarkdownCell(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
}

export function renderCoverageAuditMarkdown(audit) {
  const lines = [
    "# Evidence coverage audit",
    "",
    `Generated for ${audit.promiseCount} reviewed promises; assessment cutoff ${audit.assessmentCutoff}.`,
    "",
    "> This is a pipeline-coverage report, not a political assessment. No match is not zero points.",
    "",
    "## Summary",
    "",
    "| State | Count |",
    "|---|---:|",
    ...Object.entries(audit.stateCounts).map(([state, count]) => `| ${STATE_LABELS[state]} | ${count} |`),
    "",
    "## Source coverage",
    "",
    "| Source | Collected | Mode | Records | Observed range | Limitation |",
    "|---|---|---|---:|---|---|",
    ...audit.sourceCoverage.map((source) => `| ${source.name} | ${source.collected ? "yes" : `**no** — ${renderMarkdownCell(source.warnings[0])}`} | \`${source.coverageMode}\` | ${source.recordCount} | ${source.observedEarliest?.slice(0, 10) ?? "—"} to ${source.observedLatest?.slice(0, 10) ?? "—"} | ${source.coverageNote} |`),
    "",
    "## Promise coverage",
    "",
    "| Party | Promise | State | Matches | Attributable primary |",
    "|---|---|---|---:|---:|",
    ...audit.promises.map((promise) => `| ${promise.partyName} | ${promise.titleCz} | ${promise.stateLabel} | ${promise.candidateMatchCount} | ${promise.attributablePrimaryMatchCount} |`),
    ""
  ];
  return lines.join("\n");
}
