import assert from "node:assert/strict";
import test from "node:test";
import { buildCoverageAudit, renderCoverageAuditMarkdown } from "../scripts/lib/coverage-audit.mjs";

const pspSource = { id: "psp-core-2025", name: "Chamber of Deputies open data", primary: true, evidenceRole: "primary-record", enabled: true, coverage: { mode: "term-snapshot", note: "Whole 10th term." } };
const counts = {
  primaryRecordsInWindowCount: 10, notAttributableSkippedCount: 7, conductRecordCount: 3, lawChangeCount: 5, technicalLawChangeCount: 2, substantiveLawChangeCount: 3,
  routedLawChangeCount: 2, directLinkLawChangeCount: 1, unroutedLawChangeCount: 1, routedWithoutConductCount: 1, relevancePairCount: 4,
  relevanceDroppedCount: 1, excludedIrrelevantPairCount: 2, oversizedPackageCount: 0, invalidScreenerCount: 1, invalidRelevanceCheckCount: 0
};

function routingRun({ lawChanges = [], packages = [], completed = true } = {}) {
  return { schemaVersion: "1.0.0", asOf: "2026-09-23", completed, counts, lawChanges, builtPackages: packages };
}

const printParts = { quality: { prints: 2, printsWithProposalText: 1, printsWithoutProposalText: 1, printsWithApprovedText: 1, printsWithPassedText: 0, printsWithSenateResolution: 1, governmentOpinions: 3, governmentOpinionsWithoutText: 1, lawChanges: 5, lawChangesAddedInDebate: 1, lawChangesRemovedInDebate: 2, lawChangesWithAmendedAct: 3, titleOnlyLawChanges: 1, approvedBillsWithoutApprovedText: 1, printsWithPromulgatedText: 1, textWarnings: 2 } };
const trackedPromises = { promises: [{ id: "p1", partyId: "ano", partyName: "ANO", titleCz: "Slib" }] };

test("coverage audit never converts a promise without routed records into a score", () => {
  const audit = buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run-1", collectors: [{ sourceId: "psp-core-2025", collection: { mode: "full", since: "2025-10-01" }, warnings: ["Line one\nwith a | pipe"] }], records: [] },
    routingRun: routingRun(),
    printParts,
    trackedPromises,
    sourceRegistry: { sources: [pspSource] },
    proposalManifest: { proposals: [] }
  });
  assert.equal(audit.promises[0].state, "no-routed-law-change");
  assert.equal(audit.promises[0].scoreInferred, false);
  assert.equal(audit.publicationApproved, false);
  assert.equal(audit.quality.notAttributableSkipped, 7);
  assert.equal(audit.quality.invalidModelOutputs, 1);
  const markdown = renderCoverageAuditMarkdown(audit);
  assert.match(markdown, /No routed law change is not zero points/);
  assert.match(markdown, /\| Law changes with an identified amended act \| 3 of 5 \|/);
  assert.match(markdown, /\| Law changes added \/ removed during the debate \| 1 \/ 2 \|/);
  assert.match(markdown, /\| Approved bills without an approved text on psp.cz \| 1 \|/);
  assert.match(markdown, /\| Prints with a voted text from the Collection of Laws \(e-Sbírka\), because psp.cz does not publish it \| 1 \|/);
  assert.match(markdown, /\| Technical \/ substantive \| 2 \/ 3 \|/);
  assert.match(markdown, /\| Promise and law-change pairs checked \/ dropped as not relevant \| 4 \/ 1 \|/);
  assert.match(markdown, /\| Promise and law-change pairs left out because both assessors of an earlier assessment found them not relevant \| 2 \|/);
  const withResolutions = renderCoverageAuditMarkdown({ ...audit, quality: { ...audit.quality, resolutions: { fromCache: 673, fromPortal: 2, classified: [], rejected: ["1048/2025", "1049/2025", "1050/2025"], duplicates: {}, unexpectedPages: [], unreadableFiles: [], heldWithoutEklep: 0, heldUnreadAnnex: [], beforeGovernment: 0, used: 485, requests: 33, retried: 0 } } });
  assert.match(withResolutions, /\| Resolution numbers answered by the Government Office firewall's rejection page \(counted as not held\) \| 3 \|/);
  const sourceRows = markdown.split("\n").filter((line) => line.startsWith("| Chamber of Deputies open data"));
  assert.deepEqual(sourceRows, ["| Chamber of Deputies open data | 2025-10-01 | 0 | — to — | Line one with a \\| pipe |"], "runtime warning text must stay on one escaped table row");
});

test("a routed promise without a kept law change, one with a package, and one with an oversized package are told apart", () => {
  const audit = buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run-2", collectors: [], records: [] },
    routingRun: routingRun({
      lawChanges: [
        { route: { disposition: "routed", routedTo: [{ promiseId: "p1" }, { promiseId: "p2" }, { promiseId: "p3" }] } },
        { route: { disposition: "unrouted", routedTo: [] } }
      ],
      packages: [{ promiseId: "p2", lawChangeCount: 1, oversized: false }, { promiseId: "p3", lawChangeCount: 1, oversized: true }]
    }),
    trackedPromises: { promises: [...trackedPromises.promises, { id: "p2", partyId: "spd", partyName: "SPD", titleCz: "Slib 2" }, { id: "p3", partyId: "spd", partyName: "SPD", titleCz: "Slib 3" }] },
    sourceRegistry: { sources: [] },
    proposalManifest: { proposals: [] }
  });
  assert.deepEqual(audit.promises.map(({ state, routedChangeCount }) => [state, routedChangeCount]), [["routed-without-kept-change", 1], ["assessable-package", 1], ["oversized-package", 1]]);
  assert.equal(audit.promises[1].evidencePackage, "evidence-packages/p2.json");
});

test("a partial routing run is refused", () => {
  assert.throws(() => buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run", collectors: [], records: [] },
    routingRun: routingRun({ completed: false }),
    trackedPromises,
    sourceRegistry: { sources: [] },
    proposalManifest: { proposals: [] }
  }), /completed law-change routing run/);
});

test("an enabled source that was not collected is refused", () => {
  assert.throws(() => buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run-3", collectors: [], records: [] },
    routingRun: routingRun(),
    trackedPromises,
    sourceRegistry: { sources: [pspSource, { ...pspSource, id: "disabled", enabled: false }] },
    proposalManifest: { proposals: [] }
  }), /Enabled source psp-core-2025 was not collected/);
});

test("coverage audit prefers the active human review proposal over the routing state", () => {
  const audit = buildCoverageAudit({
    collectorRun: { schemaVersion: "1.0.0", runId: "run", collectors: [], records: [] },
    routingRun: routingRun({ packages: [{ promiseId: "p1", lawChangeCount: 1, oversized: false }] }),
    trackedPromises,
    sourceRegistry: { sources: [] },
    proposalManifest: { proposals: [{ proposalId: "old", promiseId: "p1", resolutionState: "candidate", supersededByProposalId: "new" }, { proposalId: "new", promiseId: "p1", resolutionState: "human-review-required", candidateStatus: null, publicationApproved: false, supersededByProposalId: null }] }
  });
  assert.equal(audit.promises[0].state, "human-review-required");
  assert.equal(audit.promises[0].activeProposal.proposalId, "new");
});
