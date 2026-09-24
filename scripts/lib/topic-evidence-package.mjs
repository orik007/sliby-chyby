import { sha256 } from "./collector-core.mjs";
import { assessableAttributionStatuses, attributionStatusForRecord, factSummary, normalizedStructuredFacts } from "./attribution.mjs";
import { validateEvidencePackage } from "./assessment-pipeline.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export const packageBuilderVersion = "law-change-package-v1";

// Above this input size the assessor and arbiter models cost twice as much
// per request (OpenAI model documentation, verified 24 September 2026); a
// larger package is reported for human review, never trimmed.
export const maxPackageTokens = 272_000;
const estimatedCharactersPerToken = 3;

export function estimatePackageTokens(evidencePackage) {
  return Math.ceil(JSON.stringify(evidencePackage).length / estimatedCharactersPerToken);
}

export function lawChangeEvidenceId(change) {
  return `psp-core-2025--law-change-${change.changeId}`;
}

/**
 * The records that are the promise party's attributable conduct on a print:
 * its decisive votes and its submission (docs/scoring.md).
 */
export function attributableConductOnPrint(records, promise) {
  return records
    .map((record) => ({ record, attributionStatus: attributionStatusForRecord(record, promise).attributionStatus }))
    .filter(({ attributionStatus }) => assessableAttributionStatuses.has(attributionStatus));
}

function evidenceFromLawChange(change, route, publishedAt) {
  return {
    id: lawChangeEvidenceId(change),
    role: "law-change",
    type: "law-change",
    title: `${change.printNumber}: ${change.heading ? `${change.heading} – ` : ""}${change.titleCz}`,
    publisher: "Chamber of Deputies of the Parliament of the Czech Republic",
    publishedAt,
    url: change.document?.url ?? change.printPageUrl,
    locator: change.document ? `${change.document.filename}, ${change.heading ?? "whole proposal text"}` : "print title only; no DOCX proposal text",
    primary: true,
    factSummary: change.textCz === null
      ? `Law change in print ${change.printNumber}, known only from its official title: ${change.titleCz}.`
      : `Official text of ${change.heading ? `part “${change.heading} – ${change.titleCz}”` : "the proposal"} of print ${change.printNumber}.`,
    structuredFacts: {
      changeId: change.changeId,
      externalPrintId: change.printId,
      printNumber: change.printNumber,
      printKindId: change.printKindId,
      printTitleCz: change.printTitleCz,
      heading: change.heading,
      titleCz: change.titleCz,
      acts: change.acts,
      textCz: change.textCz
    },
    sourceRecordHash: sha256(change.textCz ?? change.titleCz),
    matchBasis: {
      routeBasis: route.routeBasis,
      matchedTagIds: route.matchedTagIds,
      directLinkIdentifiers: route.directLinkIdentifiers
    }
  };
}

function evidenceFromConduct({ record, attributionStatus }, promise, changeIds) {
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
    structuredFacts: { ...normalizedStructuredFacts(record, promise.partyId), concernsLawChangeIds: changeIds },
    sourceRecordHash: record.contentHash,
    matchBasis: { attributionStatus }
  };
}

function evidenceFromMaintenanceBaseline(baseline) {
  return { ...baseline.source, role: "maintenance-baseline" };
}

/**
 * One promise's evidence package: every kept law change in full, and the
 * party's attributable conduct on each of their prints. Nothing is trimmed.
 * `keptChanges` is `[{ change, route }]`; `recordsByPrintId` holds the
 * primary records concerning each print, and `printFirstSeenOn` each print's
 * earliest record date. A caller building many packages passes the
 * collector run's hash once as `collectorRunHash`. Returns null when no kept change has attributable
 * conduct of the promise's party.
 */
export function buildLawChangeEvidencePackage({ promise, keptChanges, recordsByPrintId, printFirstSeenOn, collectorRun, collectorRunHash = sha256(collectorRun), asOf }) {
  invariant(typeof asOf === "string", "buildLawChangeEvidencePackage requires asOf");
  const changes = [];
  const conductById = new Map();
  const changeIdsByRecord = new Map();
  for (const { change, route } of [...keptChanges].sort((left, right) => left.change.printNumber - right.change.printNumber || left.change.index - right.change.index)) {
    const conduct = attributableConductOnPrint(recordsByPrintId.get(change.printId) ?? [], promise);
    if (conduct.length === 0) continue;
    changes.push({ change, route });
    for (const item of conduct) {
      conductById.set(item.record.id, item);
      changeIdsByRecord.set(item.record.id, [...(changeIdsByRecord.get(item.record.id) ?? []), change.changeId]);
    }
  }
  if (changes.length === 0) return null;
  const conduct = [...conductById.values()].sort((left, right) => String(left.record.occurredAt).localeCompare(String(right.record.occurredAt)) || left.record.id.localeCompare(right.record.id));
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
      builderVersion: packageBuilderVersion,
      collectorRunId: collectorRun.runId,
      collectorRunHash,
      lawChangeCount: changes.length,
      conductCount: conduct.length,
      directionAssigned: false,
      publicationApproved: false
    },
    evidence: [
      promise.promiseSource,
      ...(promise.maintenanceBaseline ? [evidenceFromMaintenanceBaseline(promise.maintenanceBaseline)] : []),
      ...changes.map(({ change, route }) => evidenceFromLawChange(change, route, printFirstSeenOn.get(change.printId))),
      ...conduct.map((item) => evidenceFromConduct(item, promise, changeIdsByRecord.get(item.record.id)))
    ]
  };
  validateEvidencePackage(evidencePackage);
  evidencePackage.generation.estimatedTokens = estimatePackageTokens(evidencePackage);
  evidencePackage.generation.oversized = evidencePackage.generation.estimatedTokens > maxPackageTokens;
  return evidencePackage;
}
