import { sha256 } from "./collector-core.mjs";
import { assessableAttributionStatuses, attributionStatusForRecord, factSummary, normalizedStructuredFacts, versionConcerned } from "./attribution.mjs";
import { validateEvidencePackage } from "./assessment-pipeline.mjs";
import { changeThroughVersion, namedActsFromPrintTitle, versionKeys, versionLabels } from "./print-parts.mjs";
import { estimateRequestTokens, estimateTokens, maxRequestInputTokens } from "./assessment-config.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export const packageBuilderVersion = "law-change-package-v1";

export function estimatePackageTokens(evidencePackage) {
  return estimateTokens(JSON.stringify(evidencePackage));
}

export function lawChangeEvidenceId(change) {
  return `psp-core-2025--law-change-${change.changeId}`;
}

/**
 * The version of one law change a conduct concerns. When psp.cz does not
 * publish that version, the latest earlier version is used and
 * `publishedVersionMissing` names the one the conduct concerned. Returns
 * null when the law change did not yet exist in the text the conduct
 * concerned (a change added in the debate is never part of the submission).
 */
export function versionOfChange(change, concerned) {
  if (!concerned) return null;
  const position = versionKeys.indexOf(concerned.version);
  for (let index = position; index >= 0; index -= 1) {
    const version = versionKeys[index];
    const entry = change.versions[version];
    if (!entry) continue;
    return {
      version,
      removed: entry.removed === true,
      publishedVersionMissing: version === concerned.version || (concerned.sameAsApproved && version === "approved") ? null : concerned.version,
      withSenateResolution: concerned.withSenateResolution,
      mark: concerned.mark
    };
  }
  return null;
}

/**
 * The records that are the promise party's attributable conduct on a law
 * change: its decisive votes and its submission (docs/scoring.md), each with
 * the version of the change it concerns.
 */
export function attributableConductOnChange(records, promise, change) {
  return records
    .map((record) => ({ record, attributionStatus: attributionStatusForRecord(record, promise).attributionStatus }))
    .filter(({ attributionStatus }) => assessableAttributionStatuses.has(attributionStatus))
    .map((item) => ({ ...item, version: versionOfChange(change, versionConcerned(item.record, change.printId)) }))
    .filter(({ version }) => version !== null);
}

/**
 * The law changes as they stood at the cutoff (docs/evidence-pipeline.md,
 * step 3): each with its versions up to the latest one that the conduct on
 * its print concerns. `recordsByPrintId` holds the conduct records up to the
 * cutoff. A print without a proposal text whose parts are known only from a
 * later text is, before that text, one law change known by its title.
 */
export function lawChangesAtCutoff(changes, recordsByPrintId) {
  const lastVersionByPrint = new Map();
  const lastVersionOf = (printId) => {
    if (!lastVersionByPrint.has(printId)) {
      const positions = (recordsByPrintId.get(printId) ?? [])
        .map((record) => versionConcerned(record, printId)?.version)
        .filter(Boolean)
        .map((version) => versionKeys.indexOf(version));
      lastVersionByPrint.set(printId, positions.length > 0 ? versionKeys[Math.max(...positions)] : null);
    }
    return lastVersionByPrint.get(printId);
  };
  const titleOnlyPrints = new Set();
  const result = [];
  for (const change of changes) {
    const lastVersion = lastVersionOf(change.printId);
    const atCutoff = lastVersion ? changeThroughVersion(change, lastVersion) : null;
    if (!atCutoff) continue;
    const titleOnly = Object.keys(change.versions).length > 1 && Object.keys(atCutoff.versions).length === 1 && atCutoff.versions.proposed?.textCz === null;
    if (!titleOnly) {
      result.push(atCutoff);
    } else if (!titleOnlyPrints.has(change.printId)) {
      titleOnlyPrints.add(change.printId);
      result.push(changeThroughVersion({ ...change, titleActs: namedActsFromPrintTitle(change.printTitleCz) }, lastVersion));
    }
  }
  return result;
}

export function senateResolutionEvidenceId(change, partNumber) {
  return `psp-core-2025--senate-resolution-${change.printId}-${partNumber}`;
}

function evidenceFromLawChange(change, route, publishedAt, senateResolutionIds) {
  const versions = versionKeys.filter((version) => change.versions[version]);
  const latest = [...versions].reverse().find((version) => !change.versions[version].removed);
  const latestDocument = change.versions[latest].document;
  const describe = (version) => {
    const entry = change.versions[version];
    if (entry.removed) return `removed in the ${versionLabels[version]}`;
    if (entry.sameAs) return `${versionLabels[version]} (the same as the ${versionLabels[entry.sameAs]})`;
    return entry.textCz === null ? `${versionLabels[version]}: print title only` : versionLabels[version];
  };
  return {
    id: lawChangeEvidenceId(change),
    role: "law-change",
    type: "law-change",
    title: `${change.printNumber}: ${change.heading ? `${change.heading} – ` : ""}${change.titleCz}`,
    publisher: "Chamber of Deputies of the Parliament of the Czech Republic",
    publishedAt,
    url: latestDocument?.url ?? change.printPageUrl,
    locator: latestDocument ? `${latestDocument.filename}, ${change.heading ?? "whole text"}` : "print title only; no DOCX or DOC text",
    primary: true,
    factSummary: `Law change ${change.heading ? `“${change.heading} – ${change.titleCz}”` : `“${change.titleCz}”`} of print ${change.printNumber}${change.addedIn === "proposed" ? "" : `, added in the ${versionLabels[change.addedIn]}`}. Versions: ${versions.map(describe).join("; ")}.`,
    structuredFacts: {
      changeId: change.changeId,
      externalPrintId: change.printId,
      printNumber: change.printNumber,
      printKindId: change.printKindId,
      printTitleCz: change.printTitleCz,
      heading: change.heading,
      titleCz: change.titleCz,
      acts: change.acts,
      addedIn: change.addedIn,
      versions: change.versions,
      senateResolutionEvidenceIds: senateResolutionIds
    },
    sourceRecordHash: sha256(change.versions),
    matchBasis: {
      routeBasis: route.routeBasis,
      matchedTagIds: route.matchedTagIds,
      directLinkIdentifiers: route.directLinkIdentifiers
    }
  };
}

function evidenceFromConduct({ record, attributionStatus }, promise, concerns) {
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
    structuredFacts: { ...normalizedStructuredFacts(record, promise.partyId), concernsLawChanges: concerns },
    sourceRecordHash: record.contentHash,
    matchBasis: { attributionStatus }
  };
}

// A Senate resolution returning a print to the Chamber, once per package;
// it is dated by the first vote after the return, which it precedes.
function evidenceFromSenateResolution(change, resolution, publishedAt) {
  return {
    id: senateResolutionEvidenceId(change, resolution.partNumber),
    role: "senate-resolution",
    type: "senate-resolution",
    title: `${change.printNumber}/${resolution.partNumber}: Senate resolution returning the bill to the Chamber`,
    publisher: "Chamber of Deputies of the Parliament of the Czech Republic",
    publishedAt,
    url: resolution.document.url,
    locator: resolution.document.filename,
    primary: true,
    factSummary: `The Senate's resolution on print ${change.printNumber}, rejecting the bill or returning it with amendments, as published by the Chamber of Deputies (sub-print ${change.printNumber}/${resolution.partNumber}).`,
    structuredFacts: { externalPrintId: change.printId, printNumber: change.printNumber, partNumber: resolution.partNumber, textCz: resolution.textCz },
    sourceRecordHash: sha256(resolution.textCz)
  };
}

function evidenceFromMaintenanceBaseline(baseline) {
  return { ...baseline.source, role: "maintenance-baseline" };
}

/**
 * One promise's evidence package: every kept law change with the full text
 * of each version, and the party's attributable conduct on each of their
 * prints, naming the version of each change it concerns. Nothing is trimmed.
 * `keptChanges` is `[{ change, route }]`; `recordsByPrintId` holds the
 * primary records concerning each print, and `printFirstSeenOn` each print's
 * earliest record date. A caller building many packages passes the
 * collector run's hash once as `collectorRunHash`. Returns null when no kept change has attributable
 * conduct of the promise's party.
 */
export function buildLawChangeEvidencePackage({ promise, keptChanges, recordsByPrintId, printFirstSeenOn, collectorRun, collectorRunHash = sha256(collectorRun), asOf, assessorInstructions }) {
  invariant(typeof asOf === "string", "buildLawChangeEvidencePackage requires asOf");
  invariant(typeof assessorInstructions === "string" && assessorInstructions.length > 0, "buildLawChangeEvidencePackage requires the assessor instructions");
  const changes = [];
  const conductById = new Map();
  const concernsByRecord = new Map();
  for (const { change: fullChange, route } of [...keptChanges].sort((left, right) => left.change.printNumber - right.change.printNumber || left.change.changeId.localeCompare(right.change.changeId, "en", { numeric: true }))) {
    const conduct = attributableConductOnChange(recordsByPrintId.get(fullChange.printId) ?? [], promise, fullChange);
    if (conduct.length === 0) continue;
    const lastVersion = versionKeys[Math.max(...conduct.map(({ version }) => versionKeys.indexOf(version.version)))];
    // A later text adds nothing to judging this conduct and may not have
    // existed at the package cutoff.
    const change = changeThroughVersion(fullChange, lastVersion);
    changes.push({ change, route });
    for (const { version, ...item } of conduct) {
      conductById.set(item.record.id, item);
      concernsByRecord.set(item.record.id, [...(concernsByRecord.get(item.record.id) ?? []), { changeId: change.changeId, evidenceId: lawChangeEvidenceId(change), ...version }]);
    }
  }
  if (changes.length === 0) return null;
  const conduct = [...conductById.values()].sort((left, right) => String(left.record.occurredAt).localeCompare(String(right.record.occurredAt)) || left.record.id.localeCompare(right.record.id));
  // A print's Senate resolution goes into the package once, when a vote in it
  // followed the Senate's return.
  const senateResolutions = new Map();
  for (const { record } of conduct) {
    for (const concern of concernsByRecord.get(record.id)) {
      if (!concern.withSenateResolution) continue;
      const { change } = changes.find(({ change: item }) => item.changeId === concern.changeId);
      for (const resolution of change.senateResolutions) {
        const id = senateResolutionEvidenceId(change, resolution.partNumber);
        if (!senateResolutions.has(id)) senateResolutions.set(id, evidenceFromSenateResolution(change, resolution, String(record.occurredAt).slice(0, 10)));
      }
    }
  }
  const resolutionIdsOf = (change) => change.senateResolutions.map(({ partNumber }) => senateResolutionEvidenceId(change, partNumber)).filter((id) => senateResolutions.has(id));
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
      originalTextCz: promise.originalTextCz
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
      ...changes.map(({ change, route }) => evidenceFromLawChange(change, route, printFirstSeenOn.get(change.printId), resolutionIdsOf(change))),
      ...senateResolutions.values(),
      ...conduct.map((item) => evidenceFromConduct(item, promise, concernsByRecord.get(item.record.id)))
    ]
  };
  validateEvidencePackage(evidencePackage);
  evidencePackage.generation.estimatedTokens = estimatePackageTokens(evidencePackage);
  // The assessors receive the package with its 64-character hash, after their instructions.
  evidencePackage.generation.oversized = estimateRequestTokens(assessorInstructions, { packageHash: "0".repeat(64), evidencePackage }) > maxRequestInputTokens;
  return evidencePackage;
}
