import { sha256 } from "./collector-core.mjs";
import { assessableAttributionStatuses, attributionStatusForRecord, factSummary, isPotentiallyAttributable, normalizedStructuredFacts, versionConcerned } from "./attribution.mjs";
import { validateEvidencePackage } from "./assessment-pipeline.mjs";
import { changeThroughVersion, namedActsFromPrintTitle, versionKeys, versionLabels, versionOfChange } from "./print-parts.mjs";

export { versionOfChange };
import { charactersPerToken, estimateRequestTokens, estimateTokens, maxPackageRequestTokens, maxRequestInputTokens } from "./assessment-config.mjs";
import { withContext } from "./law-context.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export const packageBuilderVersion = "law-change-package-v2";

export function estimatePackageTokens(evidencePackage) {
  return estimateTokens(JSON.stringify(evidencePackage));
}

export function lawChangeEvidenceId(change) {
  return `psp-core-2025--law-change-${change.changeId}`;
}

function recordPrintIds(record) {
  const payload = record.payload ?? {};
  return [...new Set([
    ...(payload.externalPrintId ? [String(payload.externalPrintId)] : []),
    ...(payload.linkedPrints ?? []).map(({ externalPrintId }) => String(externalPrintId))
  ])];
}

/**
 * The records of a collector run up to the cutoff that the pipeline uses
 * (docs/evidence-pipeline.md, steps 2-3): the primary records, the ones that
 * can be attributable conduct of a tracked party, those grouped by print,
 * and each print's earliest record date (a law change is dated by it). The
 * law-change context and the routing step use the same records, so they
 * work on the same law changes.
 */
export function conductOfRun(collectorRun, asOf, trackedPartyIds) {
  const cutoff = `${asOf}T23:59:59.999Z`;
  const primaryRecordsInWindow = collectorRun.records.filter((record) => record.primary === true && (!record.occurredAt || record.occurredAt <= cutoff));
  const conductRecords = primaryRecordsInWindow.filter((record) => isPotentiallyAttributable(record, trackedPartyIds));
  const recordsByPrintId = new Map();
  for (const record of conductRecords) {
    for (const printId of recordPrintIds(record)) recordsByPrintId.set(printId, [...(recordsByPrintId.get(printId) ?? []), record]);
  }
  const printFirstSeenOn = new Map();
  for (const record of primaryRecordsInWindow) {
    const date = String(record.occurredAt ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const printId of recordPrintIds(record)) {
      if (!printFirstSeenOn.has(printId) || date < printFirstSeenOn.get(printId)) printFirstSeenOn.set(printId, date);
    }
  }
  return { primaryRecordsInWindow, conductRecords, recordsByPrintId, printFirstSeenOn };
}

/** The law changes of a run at the cutoff: those of prints with conduct. */
export function lawChangesOfRun(printParts, recordsByPrintId) {
  return lawChangesAtCutoff(Object.entries(printParts.prints)
    .filter(([printId]) => recordsByPrintId.has(printId))
    .flatMap(([, print]) => print.changes), recordsByPrintId);
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
    if (entry.promulgatedAct) return `${versionLabels[version]} (as promulgated: zákon č. ${entry.promulgatedAct} Sb.)`;
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
 * Fits a package to `limitTokens` by leaving out context, never the text of
 * a law change (docs/evidence-pipeline.md, Package): the whole context of a
 * law change is left out, largest first, until the package fits; then its
 * provisions are put back, shortest first, as many as still fit. A provision
 * with the same text in several versions of a change is left out or put back
 * in all of them, because a later version refers to its text in the earlier
 * one. Every size is measured on the whole
 * package as it is sent, its record of what was left out
 * (`generation.contextOmissions`) included. Returns the package, still too
 * large when even that is not enough.
 */
function fitContexts({ changes, contextOf, assemble, requestTokens, requestLength, limitTokens, instructionTokens }) {
  // The longest input, in characters, whose estimate stays within the limit.
  const lengthLimit = Math.floor((limitTokens - instructionTokens) * charactersPerToken);
  const contexts = changes.map(({ change }) => contextOf(change.changeId));
  // Per change, its provisions by text: each with where it occurs.
  const groups = changes.map((_, index) => {
    const byKey = new Map();
    for (const [version, context] of Object.entries(contexts[index]?.versions ?? {})) {
      if (!changes[index].change.versions[version] || !context) continue;
      for (const [id, { act, citation, textCz }] of Object.entries(context.provisions)) {
        const key = `${act}\n${citation}\n${textCz}`;
        if (!byKey.has(key)) byKey.set(key, { key, length: citation.length + textCz.length, occurrences: [] });
        byKey.get(key).occurrences.push({ version, id });
      }
    }
    return [...byKey.values()];
  });
  const omittedKeys = changes.map(() => new Set());
  const omittedOf = (index) => {
    const byVersion = new Map();
    for (const group of groups[index]) {
      if (!omittedKeys[index].has(group.key)) continue;
      for (const { version, id } of group.occurrences) byVersion.set(version, new Set([...(byVersion.get(version) ?? []), id]));
    }
    return byVersion;
  };
  // Per law-change version, the provisions left out, grouped by act and
  // wording; their citations follow from their node paths.
  const contextOmissions = () => changes.flatMap(({ change }, index) => {
    const byVersion = omittedOf(index);
    return versionKeys.filter((version) => byVersion.get(version)?.size > 0).map((version) => {
      const provisions = contexts[index].versions[version].provisions;
      const omitted = byVersion.get(version);
      const byWording = new Map();
      for (const [id, { act, wording, path }] of Object.entries(provisions)) {
        if (!omitted.has(id)) continue;
        const key = `${act}@${wording}`;
        if (!byWording.has(key)) byWording.set(key, { act, wording, paths: [] });
        byWording.get(key).paths.push(path);
      }
      return { evidenceId: lawChangeEvidenceId(change), version, suppliedCount: Object.keys(provisions).length - omitted.size, omitted: [...byWording.values()] };
    });
  });
  const build = () => {
    const evidencePackage = assemble(changes.map(({ change, route }, index) => ({ change: omittedKeys[index].size > 0 ? withContext(change, contexts[index], omittedOf(index)) : change, route })));
    const omissions = contextOmissions();
    if (omissions.length > 0) evidencePackage.generation.contextOmissions = omissions;
    return evidencePackage;
  };
  const fits = (evidencePackage) => requestTokens(evidencePackage) <= limitTokens;
  const contextSize = ({ change }) => Object.values(change.versions).reduce((sum, entry) => sum + (entry.contextCz?.length ?? 0), 0);
  const order = changes.map((item, index) => ({ index, size: contextSize(item), changeId: item.change.changeId }))
    .filter(({ index }) => groups[index].length > 0)
    .sort((left, right) => right.size - left.size || left.changeId.localeCompare(right.changeId, "en", { numeric: true }));
  let evidencePackage = assemble(changes);
  for (const { index } of order) {
    if (fits(evidencePackage)) break;
    for (const { key } of groups[index]) omittedKeys[index].add(key);
    evidencePackage = build();
  }
  if (!fits(evidencePackage)) return evidencePackage;
  // The provisions left out, shortest first; the most of them that still fit
  // are put back. Putting one back does not always make the package larger
  // (it also shortens the list of what is left out), so the size of every
  // count is computed exactly: from the measured package, by the change in
  // length of the contexts it changes and of that list.
  const candidates = omittedKeys.flatMap((keys, index) => groups[index].filter(({ key }) => keys.has(key)).map(({ key, length }) => ({ index, key, length })))
    .sort((left, right) => left.length - right.length || changes[left.index].change.changeId.localeCompare(changes[right.index].change.changeId, "en", { numeric: true }) || left.key.localeCompare(right.key));
  const jsonLength = (value) => (value === undefined ? 0 : JSON.stringify(value).length);
  const contextLength = (index) => Object.values(withContext(changes[index].change, contexts[index], omittedOf(index)).versions).reduce((sum, { contextCz }) => sum + jsonLength(contextCz), 0);
  const recordLength = () => {
    const omissions = contextOmissions();
    return omissions.length > 0 ? jsonLength(omissions) + ',"contextOmissions":'.length : 0;
  };
  let length = requestLength(evidencePackage);
  const contextLengths = new Map(candidates.map(({ index }) => [index, contextLength(index)]));
  let record = recordLength();
  let count = 0;
  candidates.forEach(({ index, key }, position) => {
    omittedKeys[index].delete(key);
    const changed = contextLength(index);
    length += changed - contextLengths.get(index);
    contextLengths.set(index, changed);
    const nextRecord = recordLength();
    length += nextRecord - record;
    record = nextRecord;
    if (length <= lengthLimit) count = position + 1;
  });
  const putBack = (putCount) => {
    candidates.forEach(({ index, key }, position) => (position < putCount ? omittedKeys[index].delete(key) : omittedKeys[index].add(key)));
    return build();
  };
  evidencePackage = putBack(count);
  // The computed size is exact; this only guards against a mistake in it.
  while (!fits(evidencePackage) && count > 0) evidencePackage = putBack(--count);
  return evidencePackage;
}

/**
 * One promise's evidence package: every kept law change with the full text
 * of each version and its context, and the party's attributable conduct on
 * each of their prints, naming the version of each change it concerns. No
 * law change, text, or conduct is ever left out; when the package leaves no
 * room for the arbiter to read both reviews and `contextOf` gives each
 * change's structured context, part of the context is left out until it
 * does (`fitContexts`), or, when even that is not enough, until the
 * assessors can read it; it is marked `oversized` only when they cannot.
 * `keptChanges` is `[{ change, route }]`; `recordsByPrintId` holds the
 * primary records concerning each print, and `printFirstSeenOn` each print's
 * earliest record date. A caller building many packages passes the
 * collector run's hash once as `collectorRunHash`. `exclusionOf`, given a
 * law change as `{ id, structuredFacts: { versions } }`, returns the line of
 * a change both assessors of an earlier assessment found not relevant
 * (scripts/lib/irrelevance-verdicts.mjs), or null; such a change and the
 * conduct that concerns only it are left out, and the package lists it in
 * `excludedLawChanges`. Returns null when no remaining change has
 * attributable conduct of the promise's party.
 */
export function buildLawChangeEvidencePackage({ promise, keptChanges, recordsByPrintId, printFirstSeenOn, collectorRun, collectorRunHash = sha256(collectorRun), asOf, assessorInstructions, contextOf = null, exclusionOf = null }) {
  invariant(typeof asOf === "string", "buildLawChangeEvidencePackage requires asOf");
  invariant(typeof assessorInstructions === "string" && assessorInstructions.length > 0, "buildLawChangeEvidencePackage requires the assessor instructions");
  const changes = [];
  const excludedLawChanges = [];
  const conductById = new Map();
  const concernsByRecord = new Map();
  for (const { change: fullChange, route } of [...keptChanges].sort((left, right) => left.change.printNumber - right.change.printNumber || left.change.changeId.localeCompare(right.change.changeId, "en", { numeric: true }))) {
    const conduct = attributableConductOnChange(recordsByPrintId.get(fullChange.printId) ?? [], promise, fullChange);
    if (conduct.length === 0) continue;
    const lastVersion = versionKeys[Math.max(...conduct.map(({ version }) => versionKeys.indexOf(version.version)))];
    // A later text adds nothing to judging this conduct and may not have
    // existed at the package cutoff.
    const change = changeThroughVersion(fullChange, lastVersion);
    const excluded = exclusionOf?.({ id: lawChangeEvidenceId(change), structuredFacts: { versions: change.versions } }) ?? null;
    if (excluded) {
      excludedLawChanges.push(excluded);
      continue;
    }
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
  const assemble = (lawChanges) => {
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
      ...(excludedLawChanges.length > 0 ? { excludedLawChanges: [...excludedLawChanges].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId, "en", { numeric: true })) } : {}),
      generation: {
        builderVersion: packageBuilderVersion,
        collectorRunId: collectorRun.runId,
        collectorRunHash,
        lawChangeCount: lawChanges.length,
        conductCount: conduct.length,
        directionAssigned: false,
        publicationApproved: false
      },
      evidence: [
        promise.promiseSource,
        ...(promise.maintenanceBaseline ? [evidenceFromMaintenanceBaseline(promise.maintenanceBaseline)] : []),
        ...lawChanges.map(({ change, route }) => evidenceFromLawChange(change, route, printFirstSeenOn.get(change.printId), resolutionIdsOf(change))),
        ...senateResolutions.values(),
        ...conduct.map((item) => evidenceFromConduct(item, promise, concernsByRecord.get(item.record.id)))
      ]
    };
    validateEvidencePackage(evidencePackage);
    return evidencePackage;
  };
  // The assessors receive the package with its 64-character hash, after
  // their instructions; it is measured with its size fields at their widest.
  const requestInput = (evidencePackage) => ({ packageHash: "0".repeat(64), evidencePackage: { ...evidencePackage, generation: { ...evidencePackage.generation, estimatedTokens: 9_999_999, oversized: false } } });
  const requestTokens = (evidencePackage) => estimateRequestTokens(assessorInstructions, requestInput(evidencePackage));
  const requestLength = (evidencePackage) => JSON.stringify(requestInput(evidencePackage)).length;
  const fit = (limitTokens) => fitContexts({ changes, contextOf, assemble, requestTokens, requestLength, limitTokens, instructionTokens: estimateTokens(assessorInstructions) });
  let evidencePackage = assemble(changes);
  if (requestTokens(evidencePackage) > maxPackageRequestTokens && contextOf) {
    evidencePackage = fit(maxPackageRequestTokens);
    if (requestTokens(evidencePackage) > maxPackageRequestTokens) evidencePackage = fit(maxRequestInputTokens);
  }
  evidencePackage.generation.estimatedTokens = estimatePackageTokens(evidencePackage);
  evidencePackage.generation.oversized = requestTokens(evidencePackage) > maxRequestInputTokens;
  return evidencePackage;
}
