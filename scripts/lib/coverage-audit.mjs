import { invariant } from "./collector-core.mjs";

const STATE_LABELS = {
  "review-candidate": "Assessment candidate awaiting human review",
  "human-review-required": "Human review required; no proposed public score",
  "assessable-package": "Evidence package queued for assessment; not yet proposed",
  "oversized-package": "Evidence package larger than the models can read; human review",
  "routed-without-kept-change": "Law changes routed, but none kept (no attributable conduct, or not relevant)",
  "no-routed-law-change": "No law change routed in this run"
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
  if (result.evidencePackage) return result.oversized ? "oversized-package" : "assessable-package";
  if (result.routedChangeCount > 0) return "routed-without-kept-change";
  return "no-routed-law-change";
}

// Per-promise results from a completed law-change routing report.
function promiseResults(routingRun, promises) {
  const routedCounts = new Map();
  for (const { route } of routingRun.lawChanges) {
    for (const { promiseId } of route.routedTo) routedCounts.set(promiseId, (routedCounts.get(promiseId) ?? 0) + 1);
  }
  const packages = new Map(routingRun.builtPackages.map((entry) => [entry.promiseId, entry]));
  return new Map(promises.map((promise) => {
    const built = packages.get(promise.id);
    return [promise.id, {
      routedChangeCount: routedCounts.get(promise.id) ?? 0,
      packagedChangeCount: built?.lawChangeCount ?? 0,
      oversized: built?.oversized ?? false,
      evidencePackage: built ? `evidence-packages/${promise.id}.json` : null
    }];
  }));
}

export function buildCoverageAudit({ collectorRun, routingRun, printParts, trackedPromises, sourceRegistry, proposalManifest }) {
  invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
  invariant(routingRun?.schemaVersion === "1.0.0" && Array.isArray(routingRun.lawChanges) && Array.isArray(routingRun.builtPackages), "Invalid law-change routing run");
  invariant(routingRun.completed === true, "A coverage audit needs a completed law-change routing run");
  invariant(Array.isArray(trackedPromises?.promises), "Invalid tracked promises");
  invariant(Array.isArray(sourceRegistry?.sources), "Invalid source registry");
  const results = promiseResults(routingRun, trackedPromises.promises);
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

  const promises = trackedPromises.promises.map((promise) => {
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
      routedChangeCount: result.routedChangeCount,
      packagedChangeCount: result.packagedChangeCount,
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
      conductRecords: routingRun.counts.conductRecordCount,
      lawChanges: routingRun.counts.lawChangeCount,
      technicalLawChanges: routingRun.counts.technicalLawChangeCount,
      substantiveLawChanges: routingRun.counts.substantiveLawChangeCount,
      routedLawChanges: routingRun.counts.routedLawChangeCount,
      directLinkLawChanges: routingRun.counts.directLinkLawChangeCount,
      unroutedLawChanges: routingRun.counts.unroutedLawChangeCount,
      routedWithoutConduct: routingRun.counts.routedWithoutConductCount,
      relevancePairs: routingRun.counts.relevancePairCount,
      relevanceDropped: routingRun.counts.relevanceDroppedCount,
      excludedIrrelevant: routingRun.counts.excludedIrrelevantPairCount,
      oversizedPackages: routingRun.counts.oversizedPackageCount,
      contextTrimmedPackages: routingRun.counts.contextTrimmedPackageCount,
      invalidModelOutputs: routingRun.counts.invalidScreenerCount + routingRun.counts.invalidRelevanceCheckCount,
      printParts: printParts?.quality ?? null,
      // The government resolutions' figures (docs/evidence-pipeline.md,
      // Government resolution data rules, Quality).
      resolutions: collectorRun.collectors.find(({ collector }) => collector === "zvlady-resolutions")?.referenceData?.quality ?? null
    },
    stateCounts,
    parties,
    sourceCoverage,
    promises,
    scoreInferred: false,
    publicationApproved: false,
    warnings: [
      "No routed law change does not mean no action and must never be converted into zero points.",
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
  const printParts = quality.printParts;
  const lines = [
    "# Evidence coverage audit",
    "",
    `Generated for ${audit.promiseCount} promises; assessment cutoff ${audit.assessmentCutoff}.`,
    "",
    "> This is a pipeline-coverage report, not a political assessment. No routed law change is not zero points.",
    "",
    "## Data quality",
    "",
    "| Measure | Count |",
    "|---|---:|",
    `| Primary records in the window | ${quality.primaryRecordsInWindow} |`,
    `| Skipped: cannot be attributable conduct | ${quality.notAttributableSkipped} |`,
    `| Records that can be attributable conduct | ${quality.conductRecords} |`,
    ...(printParts ? [
      `| Prints with a DOCX or DOC proposal text | ${printParts.printsWithProposalText} of ${printParts.prints} |`,
      `| Prints without a DOCX or DOC proposal text (only a PDF or none) | ${printParts.printsWithoutProposalText} |`,
      `| Prints with a text approved by the Chamber / passed by Parliament | ${printParts.printsWithApprovedText} / ${printParts.printsWithPassedText} |`,
      `| Prints returned by the Senate (rejected or amended) | ${printParts.printsWithSenateResolution} |`,
      `| Government opinions on bills it did not submit (agreeing or disagreeing) | ${printParts.governmentOpinions} |`,
      `| Government opinions without a readable text | ${printParts.governmentOpinionsWithoutText} |`,
      `| Law changes added / removed during the debate | ${printParts.lawChangesAddedInDebate} / ${printParts.lawChangesRemovedInDebate} |`,
      `| Law changes with an identified amended act | ${printParts.lawChangesWithAmendedAct} of ${printParts.lawChanges} |`,
      `| Approved bills without an approved text on psp.cz | ${printParts.approvedBillsWithoutApprovedText} |`,
      `| Prints with a voted text from the Collection of Laws (e-Sbírka), because psp.cz does not publish it | ${printParts.printsWithPromulgatedText} |`,
      `| Text warnings (a text listed without a DOCX or DOC file, a missing approved text, an act e-Sbírka does not yet hold) | ${printParts.textWarnings} |`
    ] : []),
    ...(quality.resolutions ? [
      `| Government resolutions read from the cache / from the portal | ${quality.resolutions.fromCache} / ${quality.resolutions.fromPortal} |`,
      `| Classified government resolutions | ${quality.resolutions.classified.length} |`,
      `| Government resolutions left out as only approving a government proposal, opinion, or regulation | ${Object.values(quality.resolutions.duplicates).reduce((sum, count) => sum + count, 0)} (${Object.entries(quality.resolutions.duplicates).map(([kind, count]) => `${kind} ${count}`).join(", ") || "none"}) |`,
      `| Government resolutions without a readable text (its own file, or a Word file to read again) | ${quality.resolutions.unexpectedPages.length + quality.resolutions.unreadableFiles.length} |`,
      `| Government resolutions adopted before a tracked government / used | ${quality.resolutions.beforeGovernment} / ${quality.resolutions.used} |`,
      `| Requests to the Government Office / retried | ${quality.resolutions.requests} / ${quality.resolutions.retried} |`
    ] : []),
    `| Law changes screened | ${quality.lawChanges} |`,
    `| Technical / substantive | ${quality.technicalLawChanges} / ${quality.substantiveLawChanges} |`,
    `| Routed law changes | ${quality.routedLawChanges} |`,
    `| Law changes with a direct legal-identifier link | ${quality.directLinkLawChanges} |`,
    `| Substantive law changes routed to no promise | ${quality.unroutedLawChanges} |`,
    `| Routed, but the promise's party has no conduct on the print | ${quality.routedWithoutConduct} |`,
    `| Promise and law-change pairs checked / dropped as not relevant | ${quality.relevancePairs} / ${quality.relevanceDropped} |`,
    `| Promise and law-change pairs left out because both assessors of an earlier assessment found them not relevant | ${quality.excludedIrrelevant} |`,
    `| Packages larger than the models can read | ${quality.oversizedPackages} |`,
    `| Packages that fit only without part of their context | ${quality.contextTrimmedPackages} |`,
    `| Invalid model outputs | ${quality.invalidModelOutputs} |`,
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
    "| Party | Promise | State | Routed law changes | Packaged law changes |",
    "|---|---|---|---:|---:|",
    ...audit.promises.map((promise) => `| ${promise.partyName} | ${promise.titleCz} | ${promise.stateLabel} | ${promise.routedChangeCount} | ${promise.packagedChangeCount} |`),
    ""
  ];
  return lines.join("\n");
}
