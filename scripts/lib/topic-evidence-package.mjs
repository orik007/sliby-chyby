import { sha256 } from "./collector-core.mjs";
import { assessableAttributionStatuses, attributionStatusForRecord, factSummary, normalizedStructuredFacts, selectBoundedPrimaryMatches } from "./attribution.mjs";
import { validateEvidencePackage } from "./assessment-pipeline.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Wraps a topic-routed record for the shared bounding rule
 * (selectBoundedPrimaryMatches in attribution.mjs). A direct structural link,
 * the strongest routing basis, ranks first; other records rank by recency.
 */
function asBoundableMatch(record, promise, routeBasis) {
  const { attributionStatus } = attributionStatusForRecord(record, promise);
  return { record, attributionStatus, directLink: routeBasis.includes("direct-structural-link"), routeBasis };
}

function evidenceFromRoutedMatch(match, promise) {
  const record = match.record;
  return {
    id: record.id,
    role: "conduct-evidence",
    type: record.kind,
    title: record.title,
    publisher: record.publisher,
    publishedAt: String(record.occurredAt).slice(0, 10),
    url: record.url,
    locator: `normalized collector record ${record.id}`,
    primary: record.primary,
    factSummary: factSummary(record, promise.partyId),
    structuredFacts: normalizedStructuredFacts(record, promise.partyId),
    sourceRecordHash: record.contentHash,
    matchBasis: {
      routeBasis: match.routeBasis,
      attributionStatus: match.attributionStatus
    }
  };
}

function evidenceFromMaintenanceBaseline(baseline) {
  return { ...baseline.source, role: "maintenance-baseline" };
}

/**
 * Builds a bounded, assessable evidence package for one promise from its
 * topic-routed candidate relationships. `routedRecords` is every record this
 * promise's routing gave a `candidate-created` disposition to, as
 * `{ record, routeBasis }`. A record whose deterministic attribution status
 * (attributionStatusForRecord in attribution.mjs) is not assessable is
 * dropped: a candidate relationship alone is never attributable conduct.
 * Returns null when nothing routed to this promise clears that bar.
 */
export function buildTopicEvidencePackage({ promise, routedRecords, collectorRun, asOf }) {
  invariant(typeof asOf === "string", "buildTopicEvidencePackage requires asOf");
  const matches = routedRecords.map(({ record, routeBasis }) => asBoundableMatch(record, promise, routeBasis));
  const selectedMatches = selectBoundedPrimaryMatches(matches);
  if (selectedMatches.length === 0) return null;
  const maintenanceBaseline = promise.maintenanceBaseline
    ? { preservedStateCz: promise.maintenanceBaseline.preservedStateCz, evidenceId: promise.maintenanceBaseline.source.id }
    : null;
  const evidencePackage = {
    schemaVersion: "1.0.0",
    methodologyVersion: "slava-v7",
    packageId: `${promise.id}--${asOf}--generated`,
    asOf,
    assessmentContext: { mode: "live", ruleVersion: "period-timing-v2", maintenanceBaseline },
    promise: {
      id: promise.id,
      partyPeriodId: promise.partyPeriodId,
      partyName: promise.partyName,
      titleCz: promise.titleCz,
      type: promise.type,
      atomicClaimCz: promise.atomicClaimCz,
      originalTextCz: promise.originalTextCz,
      fulfillmentTest: promise.fulfillmentTest,
      contradictionTest: promise.contradictionTest
    },
    generation: {
      routerVersion: "topic-routing-v1",
      collectorRunId: collectorRun.runId,
      collectorRunHash: sha256(collectorRun),
      routedRecordCount: matches.length,
      primaryMatchCount: matches.filter(({ record, attributionStatus }) => record.primary && assessableAttributionStatuses.has(attributionStatus)).length,
      selectedPrimaryEvidenceCount: selectedMatches.length,
      omittedPrimaryMatchCount: Math.max(0, matches.filter(({ record, attributionStatus }) => record.primary && assessableAttributionStatuses.has(attributionStatus)).length - selectedMatches.length),
      directionAssigned: false,
      publicationApproved: false
    },
    evidence: [
      promise.promiseSource,
      ...(promise.maintenanceBaseline ? [evidenceFromMaintenanceBaseline(promise.maintenanceBaseline)] : []),
      ...selectedMatches.map((match) => evidenceFromRoutedMatch(match, promise))
    ]
  };
  return validateEvidencePackage(evidencePackage);
}
