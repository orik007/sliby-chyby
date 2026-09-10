import { sha256 } from "./collector-core.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateEvidencePackage(evidencePackage) {
  invariant(evidencePackage?.schemaVersion === "1.0.0", "Unsupported evidence-package schemaVersion");
  invariant(typeof evidencePackage.packageId === "string" && evidencePackage.packageId.length > 0, "Evidence package is missing packageId");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(evidencePackage.asOf ?? ""), "Evidence package has invalid asOf date");
  invariant(typeof evidencePackage.promise?.id === "string" && evidencePackage.promise.id.length > 0, "Evidence package is missing promise id");
  invariant(Array.isArray(evidencePackage.evidence) && evidencePackage.evidence.length > 0, "Evidence package must include evidence");
  invariant(evidencePackage.evidence[0]?.role === "promise-source", "Evidence package must start with its promise source");
  for (const evidence of evidencePackage.evidence) {
    invariant(typeof evidence.id === "string" && evidence.id.length > 0, "Evidence is missing id");
    invariant(typeof evidence.url === "string" && evidence.url.startsWith("https://"), `Evidence ${evidence.id} must use HTTPS`);
  }
  return evidencePackage;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/\s+/g, " ")
    .trim();
}

function valueAtPath(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

function searchableRecordText(record) {
  const payload = { ...record.payload };
  delete payload.individualVotes;
  return normalizeSearchText([record.title, record.publisher, JSON.stringify(payload)].join(" "));
}

function hasVerifiedVoteContext(record) {
  if (record.kind !== "parliamentary-vote") return false;
  const decisiveActions = ["souhlas", "schvalen", "zamitnut", "vracen"];
  return (record.payload?.linkedPrints ?? []).some((linkedPrint) =>
    (linkedPrint.historyContexts ?? []).some((context) => {
      const action = normalizeSearchText(context.actionCz);
      return decisiveActions.some((decisiveAction) => action.includes(decisiveAction));
    })
  );
}

const assessableAttributionStatuses = new Set([
  "verified-party-vote",
  "verified-party-no-majority",
  "verified-party-sponsor",
  "verified-party-publication",
  "candidate-government-action"
]);

export function validatePromiseRegistry(registry) {
  invariant(registry?.schemaVersion === "1.0.0", "Unsupported promise-matching registry schemaVersion");
  invariant(Array.isArray(registry.promises) && registry.promises.length > 0, "Promise-matching registry must contain promises");
  const ids = new Set();
  for (const promise of registry.promises) {
    invariant(typeof promise.id === "string" && promise.id.length > 0, "Matching promise is missing id");
    invariant(!ids.has(promise.id), `Duplicate matching promise id: ${promise.id}`);
    ids.add(promise.id);
    invariant(typeof promise.partyId === "string" && promise.partyId.length > 0, `Promise ${promise.id} is missing partyId`);
    invariant(typeof promise.originalTextCz === "string" && promise.originalTextCz.length > 0, `Promise ${promise.id} is missing original text`);
    invariant(typeof promise.researchSourceCandidateId === "string" && promise.researchSourceCandidateId.length > 0, `Promise ${promise.id} is missing its research source candidate`);
    invariant(promise.promiseSource?.primary === true, `Promise ${promise.id} must have a primary promise source`);
    invariant(typeof promise.promiseSource.exactQuoteCz === "string" && promise.originalTextCz.includes(promise.promiseSource.exactQuoteCz), `Promise ${promise.id} exact quote is not present verbatim in its original text`);
    invariant(/^https:\/\//.test(promise.promiseSource.url), `Promise ${promise.id} source must use HTTPS`);
    invariant(/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(promise.promiseSource.publishedAt), `Promise ${promise.id} source has an invalid publication date`);
    invariant(Number.isFinite(promise.matching?.minimumScore) && promise.matching.minimumScore > 0, `Promise ${promise.id} needs a positive minimumScore`);
    invariant(Array.isArray(promise.matching.terms), `Promise ${promise.id} matching terms must be an array`);
    invariant(Array.isArray(promise.matching.externalReferences), `Promise ${promise.id} externalReferences must be an array`);
    for (const term of promise.matching.terms) {
      invariant(typeof term.phrase === "string" && term.phrase.length >= 3, `Promise ${promise.id} has an invalid matching phrase`);
      invariant(Number.isFinite(term.weight) && term.weight > 0, `Promise ${promise.id} has an invalid term weight`);
    }
    for (const reference of promise.matching.externalReferences) {
      invariant(typeof reference.path === "string" && reference.path.startsWith("payload."), `Promise ${promise.id} has an invalid reference path`);
      invariant(reference.equals !== undefined, `Promise ${promise.id} has a reference without equals`);
      invariant(Number.isFinite(reference.weight) && reference.weight > 0, `Promise ${promise.id} has an invalid reference weight`);
      invariant(["verified-party-sponsor", "candidate-government-action"].includes(reference.attributionStatus), `Promise ${promise.id} has an invalid reference attributionStatus`);
    }
  }
  return registry;
}

export function matchRecordToPromise(record, promise) {
  const searchable = searchableRecordText(record);
  const matchedTerms = [];
  const matchedExternalReferences = [];
  let score = 0;

  for (const term of promise.matching.terms) {
    if (!searchable.includes(normalizeSearchText(term.phrase))) continue;
    score += term.weight;
    matchedTerms.push({ phrase: term.phrase, weight: term.weight });
  }
  for (const reference of promise.matching.externalReferences) {
    if (valueAtPath(record, reference.path) !== reference.equals) continue;
    score += reference.weight;
    matchedExternalReferences.push({
      path: reference.path,
      equals: reference.equals,
      weight: reference.weight,
      attributionStatus: reference.attributionStatus
    });
  }

  if (score < promise.matching.minimumScore) return null;
  const partyVoteSummary = (record.payload?.partyVoteSummaries ?? []).find((summary) => summary.partyId === promise.partyId);
  const attributionStatus = partyVoteSummary?.attributionStatus === "attributed" && hasVerifiedVoteContext(record)
    ? "verified-party-vote"
    : partyVoteSummary?.attributionStatus === "no-strict-majority" && hasVerifiedVoteContext(record)
      ? "verified-party-no-majority"
    : partyVoteSummary?.attributionStatus === "attributed"
      ? "candidate-party-vote-without-decisive-context"
    : partyVoteSummary?.attributionStatus === "no-strict-majority"
      ? "candidate-party-vote-without-decisive-context"
    : matchedExternalReferences.find(({ attributionStatus: status }) => status === "verified-party-sponsor")?.attributionStatus
      ?? (record.primary === true && record.kind === "official-publication" && record.evidenceRole === "official-party-publication" && record.payload?.sourcePartyId === promise.partyId ? "verified-party-publication" : null)
      ?? matchedExternalReferences.find(({ attributionStatus: status }) => status === "candidate-government-action")?.attributionStatus
      ?? (record.primary === true && record.kind === "official-publication" && record.evidenceRole === "official-discovery" ? "candidate-government-action" : null)
      ?? "unattributed";
  return {
    record,
    score,
    attributionStatus,
    matchedTerms,
    matchedExternalReferences
  };
}

function compareMatches(a, b) {
  return b.score - a.score || String(b.record.occurredAt).localeCompare(String(a.record.occurredAt)) || a.record.id.localeCompare(b.record.id);
}

export function matchCollectorRecords(records, promise, { asOf }) {
  const cutoff = `${asOf}T23:59:59.999Z`;
  return records
    .filter((record) => !record.occurredAt || record.occurredAt <= cutoff)
    .map((record) => matchRecordToPromise(record, promise))
    .filter(Boolean)
    .sort(compareMatches);
}

function groupKey(match) {
  const payload = match.record.payload ?? {};
  if (payload.externalPrintId) return `print:${payload.externalPrintId}`;
  if (payload.externalVoteId) return `vote:${payload.externalVoteId}`;
  return `${match.record.kind}:${match.record.id}`;
}

function significantParliamentaryStep(match) {
  const action = normalizeSearchText(match.record.payload?.actionCz);
  return ["souhlas", "schvalen", "zamitnut", "vracen", "podepsal", "vyhlasen", "predlozen"].some((value) => action.includes(value));
}

export function selectBoundedPrimaryMatches(matches, { maxPerGroup = 8, maxTotal = 24 } = {}) {
  const primaryMatches = matches.filter(({ record, attributionStatus }) => record.primary === true && assessableAttributionStatuses.has(attributionStatus));
  const groups = new Map();
  for (const match of primaryMatches) {
    const list = groups.get(groupKey(match)) ?? [];
    list.push(match);
    groups.set(groupKey(match), list);
  }

  const selected = [];
  for (const group of groups.values()) {
    group.sort((a, b) => Number(significantParliamentaryStep(b)) - Number(significantParliamentaryStep(a)) || compareMatches(a, b));
    selected.push(...group.slice(0, maxPerGroup));
  }
  return selected.sort(compareMatches).slice(0, maxTotal);
}

function partyVoteFacts(record, partyId) {
  return (record.payload?.partyVoteSummaries ?? []).find((summary) => summary.partyId === partyId) ?? null;
}

function factSummary(record, partyId) {
  if (record.kind === "legislative-step") {
    const payload = record.payload;
    return `The official parliamentary record reports action “${payload.actionCz ?? "unspecified"}” for print ${payload.printNumber ?? "unknown"}: ${payload.printTitleCz ?? record.title}.`;
  }
  if (record.kind === "parliamentary-vote") {
    const party = partyVoteFacts(record, partyId);
    const partyText = party
      ? ` Under the strict-majority rule, ${partyId} has status ${party.attributionStatus}${party.majorityChoice ? ` with majority choice ${party.majorityChoice}` : ""} (${party.counts.yes} yes, ${party.counts.no} no, threshold ${party.strictMajorityThreshold}, ${party.eligibleMemberCount} eligible members).`
      : ` No vote summary for ${partyId} is present.`;
    return `The official roll-call record reports ${record.payload.counts.yes} votes yes and ${record.payload.counts.no} votes no.${partyText}`;
  }
  if (record.kind === "official-publication") {
    return record.payload?.excerptCz || record.title;
  }
  return record.title;
}

function evidenceFromMatch(match, promise) {
  const record = match.record;
  const structuredFacts = { ...record.payload };
  delete structuredFacts.individualVotes;
  if (record.kind === "parliamentary-vote") {
    structuredFacts.relevantPartyVoteSummary = partyVoteFacts(record, promise.partyId);
  }
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
    structuredFacts,
    sourceRecordHash: record.contentHash,
    matchBasis: {
      score: match.score,
      attributionStatus: match.attributionStatus,
      matchedTerms: match.matchedTerms,
      matchedExternalReferences: match.matchedExternalReferences
    }
  };
}

export function buildEvidencePackage({ promise, matches, collectorRun, asOf }) {
  const selectedMatches = selectBoundedPrimaryMatches(matches);
  if (selectedMatches.length === 0) return null;
  const evidencePackage = {
    schemaVersion: "1.0.0",
    methodologyVersion: "evidence-collection-v1",
    packageId: `${promise.id}--${asOf}--generated`,
    asOf,
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
      matcherVersion: "deterministic-matcher-v5",
      collectorRunId: collectorRun.runId,
      collectorRunHash: sha256(collectorRun),
      candidateMatchCount: matches.length,
      primaryMatchCount: matches.filter(({ record, attributionStatus }) => record.primary && assessableAttributionStatuses.has(attributionStatus)).length,
      selectedPrimaryEvidenceCount: selectedMatches.length,
      omittedPrimaryMatchCount: Math.max(0, matches.filter(({ record, attributionStatus }) => record.primary && assessableAttributionStatuses.has(attributionStatus)).length - selectedMatches.length),
      directionAssigned: false
    },
    evidence: [promise.promiseSource, ...selectedMatches.map((match) => evidenceFromMatch(match, promise))]
  };
  return validateEvidencePackage(evidencePackage);
}

export function summarizeMatch(match) {
  return {
    recordId: match.record.id,
    kind: match.record.kind,
    primary: match.record.primary,
    occurredAt: match.record.occurredAt,
    title: match.record.title,
    url: match.record.url,
    contentHash: match.record.contentHash,
    score: match.score,
    attributionStatus: match.attributionStatus,
    matchedTerms: match.matchedTerms,
    matchedExternalReferences: match.matchedExternalReferences
  };
}
