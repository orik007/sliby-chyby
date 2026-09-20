import { sha256 } from "./collector-core.mjs";
import { assessableAttributionStatuses, attributionStatusForRecord, factSummary, normalizedStructuredFacts, selectBoundedPrimaryMatches } from "./evidence-matcher.mjs";
import { validateEvidencePackage } from "./assessment-pipeline.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Wraps a topic-routed record so it can go through the same bounding and
 * ordering rule every evidence package already uses
 * (selectBoundedPrimaryMatches in evidence-matcher.mjs), instead of a second,
 * drifting selection rule for topic-routed evidence. `exactSignal` and
 * `score` exist there to rank the old matcher's phrase-scored candidates;
 * topic-routing has no equivalent score, so a direct structural link (the
 * strongest routing basis) stands in for `exactSignal` and every other
 * routed record ties at `score: 0`, breaking ties by recency and ID exactly
 * as the old matcher already did.
 */
function asBoundableMatch(record, promise, routeBasis) {
  const { attributionStatus } = attributionStatusForRecord(record, promise);
  return { record, attributionStatus, exactSignal: routeBasis.includes("direct-structural-link"), score: 0, semanticCandidate: null, routeBasis };
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
 * Builds a real, assessable evidence package for one promise from its
 * topic-routed candidate relationships -- the topic-routing counterpart to
 * buildEvidencePackage (evidence-matcher.mjs), sharing its attribution rule,
 * bounding rule, and fact wording so a package looks the same to an
 * assessor regardless of which mechanism routed the evidence to it.
 *
 * `routedRecords` is every record this promise's routing gave a
 * `candidate-created` disposition to, as `{ record, routeBasis }`; a record
 * whose deterministic attribution status is not one of the assessable
 * statuses (assessableAttributionStatuses in evidence-matcher.mjs) is
 * dropped here, per the design doc's step 6: a candidate relationship alone
 * is never attributable party conduct. Returns null when nothing routed to
 * this promise clears that bar, exactly like buildEvidencePackage returning
 * null for zero selected matches.
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
      candidateMatchCount: matches.length,
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
