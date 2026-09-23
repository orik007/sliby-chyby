function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/\s+/g, " ")
    .trim();
}

// Official PSP print-history actions (tisky.zip typ_akce) that record the
// Chamber's final decision on a motion when the history step names the vote:
// approval, rejection, insisting on a bill after a Senate or presidential
// return, and accepting Senate amendments. Procedural steps such as "vrácen"
// (returned to second reading), "opakovat", "přerušeno" or "odročeno" are not
// decisive.
const decisiveActions = new Set([
  "souhlas",
  "schvaleno",
  "neschvalen",
  "neschvalena",
  "zamitnut",
  "neprijat",
  "setrvano",
  "pozm. prijat"
].map(normalizeSearchText));

// The first print-history step of every bill in the current term.
const submissionAction = normalizeSearchText("předložen");

function hasVerifiedVoteContext(record) {
  if (record.kind !== "parliamentary-vote") return false;
  return (record.payload?.linkedPrints ?? []).some((linkedPrint) =>
    (linkedPrint.historyContexts ?? []).some((context) => decisiveActions.has(normalizeSearchText(context.actionCz)))
  );
}

export const assessableAttributionStatuses = new Set([
  "verified-party-vote",
  "verified-party-no-majority",
  "verified-member-bill",
  "verified-government-bill"
]);

export function validatePromiseRegistry(registry) {
  invariant(registry?.schemaVersion === "1.0.0", "Unsupported promise registry schemaVersion");
  invariant(Array.isArray(registry.promises) && registry.promises.length > 0, "Promise registry must contain promises");
  const ids = new Set();
  for (const promise of registry.promises) {
    invariant(typeof promise.id === "string" && promise.id.length > 0, "Registry promise is missing id");
    invariant(!ids.has(promise.id), `Duplicate registry promise id: ${promise.id}`);
    ids.add(promise.id);
    invariant(typeof promise.partyId === "string" && promise.partyId.length > 0, `Promise ${promise.id} is missing partyId`);
    invariant(typeof promise.originalTextCz === "string" && promise.originalTextCz.length > 0, `Promise ${promise.id} is missing original text`);
    invariant(promise.promiseSource?.primary === true, `Promise ${promise.id} must have a primary promise source`);
    invariant(typeof promise.promiseSource.exactQuoteCz === "string" && promise.originalTextCz.includes(promise.promiseSource.exactQuoteCz), `Promise ${promise.id} exact quote is not present verbatim in its original text`);
    invariant(/^https:\/\//.test(promise.promiseSource.url), `Promise ${promise.id} source must use HTTPS`);
    invariant(/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(promise.promiseSource.publishedAt), `Promise ${promise.id} source has an invalid publication date`);
    invariant(promise.matching === undefined, `Promise ${promise.id} carries retired phrase-matching configuration`);
    if (promise.maintenanceBaseline !== undefined) {
      const baseline = promise.maintenanceBaseline;
      invariant(baseline && typeof baseline === "object", `Promise ${promise.id} has an invalid maintenance baseline`);
      invariant(typeof baseline.preservedStateCz === "string" && baseline.preservedStateCz.length > 0, `Promise ${promise.id} maintenance baseline is missing the preserved state`);
      invariant(baseline.source?.primary === true, `Promise ${promise.id} maintenance baseline must have a primary source`);
      invariant(typeof baseline.source.id === "string" && baseline.source.id.length > 0, `Promise ${promise.id} maintenance baseline source is missing an ID`);
      invariant(/^https:\/\//.test(baseline.source.url), `Promise ${promise.id} maintenance baseline source must use HTTPS`);
      invariant(typeof baseline.source.factSummary === "string" && baseline.source.factSummary.length > 0, `Promise ${promise.id} maintenance baseline source is missing factSummary`);
      invariant(typeof baseline.source.locator === "string" && baseline.source.locator.length > 0, `Promise ${promise.id} maintenance baseline source is missing a locator`);
      invariant(/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(baseline.source.publishedAt), `Promise ${promise.id} maintenance baseline source has an invalid publication date`);
    }
  }
  return registry;
}

/**
 * Deterministically decides whether a routed record is attributable conduct
 * of the promise's party, per docs/scoring.md:
 * - a Chamber vote with decisive print-history context, by the strict
 *   majority of the party's club at the vote date;
 * - the submission of a member bill, when an MP of the party's club at the
 *   submission date is among its proposers;
 * - the submission of a government bill, when the party was a government
 *   party at the submission date.
 * Anything else is unattributed and never becomes package evidence.
 */
export function attributionStatusForRecord(record, promise) {
  if (record.kind === "parliamentary-vote") {
    const summary = (record.payload?.partyVoteSummaries ?? []).find(({ partyId }) => partyId === promise.partyId);
    if (!summary) return { attributionStatus: "unattributed" };
    const decisive = hasVerifiedVoteContext(record);
    if (summary.attributionStatus === "attributed") return { attributionStatus: decisive ? "verified-party-vote" : "candidate-party-vote-without-decisive-context" };
    if (summary.attributionStatus === "no-strict-majority") return { attributionStatus: decisive ? "verified-party-no-majority" : "candidate-party-vote-without-decisive-context" };
    return { attributionStatus: "unattributed" };
  }
  if (record.kind === "legislative-step" && normalizeSearchText(record.payload?.actionCz) === submissionAction) {
    const proposal = record.payload?.proposal;
    if (proposal?.proposerPartyIds?.includes(promise.partyId)) {
      if (proposal.kind === "member-bill") return { attributionStatus: "verified-member-bill" };
      if (proposal.kind === "government-bill") return { attributionStatus: "verified-government-bill" };
    }
  }
  return { attributionStatus: "unattributed" };
}

function compareMatches(a, b) {
  return Number(b.exactSignal) - Number(a.exactSignal)
    || String(b.record.occurredAt).localeCompare(String(a.record.occurredAt))
    || a.record.id.localeCompare(b.record.id);
}

function groupKey(match) {
  const payload = match.record.payload ?? {};
  if (payload.externalPrintId) return `print:${payload.externalPrintId}`;
  if (payload.externalVoteId) return `vote:${payload.externalVoteId}`;
  return `${match.record.kind}:${match.record.id}`;
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
  for (const group of groups.values()) selected.push(...group.sort(compareMatches).slice(0, maxPerGroup));
  return selected.sort(compareMatches).slice(0, maxTotal);
}

function partyVoteFacts(record, partyId) {
  return (record.payload?.partyVoteSummaries ?? []).find((summary) => summary.partyId === partyId) ?? null;
}

/**
 * The evidence shape an assessor package sends, not the raw collector
 * payload: a parliamentary vote's `individualVotes` (one entry per MP) is
 * replaced with the one `relevantPartyVoteSummary` for this promise's party.
 */
export function normalizedStructuredFacts(record, partyId) {
  const structuredFacts = { ...record.payload };
  delete structuredFacts.individualVotes;
  if (record.kind === "parliamentary-vote") {
    structuredFacts.relevantPartyVoteSummary = partyVoteFacts(record, partyId);
  }
  return structuredFacts;
}

export function factSummary(record, partyId) {
  if (record.kind === "legislative-step") {
    const payload = record.payload;
    const proposal = payload.proposal
      ? ` It is a ${payload.proposal.kind === "government-bill" ? "government bill" : "member bill"} submitted on ${payload.proposal.submittedOn}; proposer parties: ${payload.proposal.proposerPartyIds.join(", ") || "none tracked"}.`
      : "";
    return `The official parliamentary record reports action “${payload.actionCz ?? "unspecified"}” for print ${payload.printNumber ?? "unknown"}: ${payload.printTitleCz ?? record.title}.${proposal}`;
  }
  if (record.kind === "parliamentary-vote") {
    const party = partyVoteFacts(record, partyId);
    const partyText = party
      ? ` Under the strict-majority rule, ${partyId} has status ${party.attributionStatus}${party.majorityChoice ? ` with majority choice ${party.majorityChoice}` : ""} (${party.counts.yes} yes, ${party.counts.no} no, threshold ${party.strictMajorityThreshold}, ${party.eligibleMemberCount} eligible members).`
      : ` No vote summary for ${partyId} is present.`;
    return `The official roll-call record reports ${record.payload.counts.yes} votes yes and ${record.payload.counts.no} votes no.${partyText}`;
  }
  return record.title;
}
