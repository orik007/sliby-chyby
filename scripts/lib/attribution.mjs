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

export function isDecisiveAction(actionCz) {
  return decisiveActions.has(normalizeSearchText(actionCz));
}

// The first print-history step of every bill in the current term.
const submissionAction = normalizeSearchText("předložen");

function hasVerifiedVoteContext(record) {
  if (record.kind !== "parliamentary-vote") return false;
  return (record.payload?.linkedPrints ?? []).some((linkedPrint) =>
    (linkedPrint.historyContexts ?? []).some((context) => decisiveActions.has(normalizeSearchText(context.actionCz)))
  );
}

// Official print kinds (druh_tisku.unl) that are bills: a government bill,
// a member bill, and the state budget.
const billPrintKindIds = new Set(["1", "2", "3"]);

export { billPrintKindIds };

/**
 * Which version of a print's law changes a conduct concerns
 * (docs/evidence-pipeline.md, Conduct and version): a submission concerns
 * the proposed text; a vote, the text its print-history step decided on,
 * read from the step's action and stage. `withSenateResolution` marks a vote
 * after the Senate returned the bill (rejecting it or with amendments), so
 * the Senate's resolution goes with it; `sameAsApproved` marks a vote whose
 * text is the approved one when psp.cz lists no passed text; `mark` names a
 * vote whose exact text psp.cz does not publish. Returns null for a vote
 * whose print history does not name it as a decisive step of this print.
 */
export function versionConcerned(record, printId) {
  const concerned = (version, extra = {}) => ({ version, withSenateResolution: false, sameAsApproved: false, mark: null, ...extra });
  if (record.kind !== "parliamentary-vote") return concerned("proposed");
  const linkedPrint = (record.payload?.linkedPrints ?? []).find((print) => String(print.externalPrintId) === String(printId));
  const context = (linkedPrint?.historyContexts ?? []).find((item) => decisiveActions.has(normalizeSearchText(item.actionCz)));
  // A vote is conduct on a print only when that print's own history names it
  // as a decisive step; a print linked only through the agenda item is not.
  if (!context) return null;
  const action = normalizeSearchText(context.actionCz);
  const stage = normalizeSearchText(context.stageCz);
  const afterSenate = /^snemovna \(senat\)/.test(stage);
  const afterPresident = /^snemovna \(prezident\)/.test(stage);
  if (action === "souhlas" && billPrintKindIds.has(String(linkedPrint?.printKindId))) return concerned("approved");
  // After a Senate return, insisting re-adopts the text the Chamber approved.
  if (afterSenate && action === "setrvano") return concerned("passed", { withSenateResolution: true, sameAsApproved: true });
  // A vote on the Senate's amendments concerns the approved text changed by
  // them: the passed text when psp.cz publishes it.
  if (afterSenate && (action === "pozm. prijat" || action === "neprijat")) return concerned("passed", { withSenateResolution: true });
  // After a presidential return, the vote concerns the text sent to the
  // President, which may include accepted Senate amendments.
  if (afterPresident && (action === "setrvano" || action === "neprijat")) return concerned("passed");
  if (/^3\. cteni/.test(stage) && ["zamitnut", "neschvalen", "neschvalena"].includes(action)) return concerned("proposed", { mark: "third-reading-rejection" });
  return concerned("proposed");
}

export const assessableAttributionStatuses = new Set([
  "verified-party-vote",
  "verified-party-no-majority",
  "verified-member-bill",
  "verified-government-proposal"
]);

/**
 * Deterministically decides whether a routed record is attributable conduct
 * of the promise's party, per docs/scoring.md:
 * - a Chamber vote with decisive print-history context, by the strict
 *   majority of the party's club at the vote date;
 * - the submission of a member bill, when an MP of the party's club at the
 *   submission date is among its proposers;
 * - the submission of a government proposal (bill, state budget, or
 *   international treaty), when the party was a governing party at the
 *   submission date.
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
      if (proposal.kind === "government-proposal") return { attributionStatus: "verified-government-proposal" };
    }
  }
  return { attributionStatus: "unattributed" };
}

/**
 * Whether a record can become package evidence for any of the given parties.
 * Attribution depends only on the record itself (its kind, decisive vote
 * context, club majorities, and proposers), so a record that fails this test
 * can never affect a score and is not routed or tagged.
 */
export function isPotentiallyAttributable(record, partyIds) {
  return partyIds.some((partyId) => assessableAttributionStatuses.has(attributionStatusForRecord(record, { partyId }).attributionStatus));
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

// Official print kinds (tisky.zip druh_tisku.unl) of a government proposal.
const governmentProposalLabels = { 1: "a government bill", 3: "a government state budget bill", 4: "an international treaty submitted by the government" };

function proposalLabel(payload) {
  if (payload.proposal.kind === "member-bill") return "a member bill";
  const label = governmentProposalLabels[payload.printKindId];
  invariant(label, `Government proposal print ${payload.printNumber} has unsupported print kind ${payload.printKindId}`);
  return label;
}

export function factSummary(record, partyId) {
  if (record.kind === "legislative-step") {
    const payload = record.payload;
    const proposal = payload.proposal
      ? ` It is ${proposalLabel(payload)} submitted on ${payload.proposal.submittedOn}; proposer parties: ${payload.proposal.proposerPartyIds.join(", ") || "none tracked"}.`
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
