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
 * text is the approved one when psp.cz lists no passed text;
 * `senateAmendmentsRejected` marks a vote that did not adopt the text with
 * the Senate's amendments, which is then never the act as promulgated; `mark` names a
 * vote whose exact text psp.cz does not publish. Returns null for a vote
 * whose print history does not name it as a decisive step of this print.
 */
export function versionConcerned(record, printId) {
  const concerned = (version, extra = {}) => ({ version, withSenateResolution: false, sameAsApproved: false, senateAmendmentsRejected: false, mark: null, ...extra });
  // A government regulation or ministerial decree is adopted in one text.
  if (record.kind === "regulation-adoption") return concerned("adopted");
  // A submission, and the government's opinion on a bill it did not
  // submit, concern the proposed text.
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
  if (afterSenate && (action === "pozm. prijat" || action === "neprijat")) return concerned("passed", { withSenateResolution: true, senateAmendmentsRejected: action === "neprijat" });
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
  "verified-government-proposal",
  "verified-government-regulation",
  "verified-ministerial-decree",
  "verified-government-opinion"
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
 *   submission date;
 * - the adoption of a government regulation or a ministerial decree, when
 *   the party was a governing party at the adoption date;
 * - the government's agreement or disagreement with a bill it did not
 *   submit, when the party was a governing party on the day the Chamber
 *   distributed the opinion; a neutral opinion is not conduct.
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
  if (record.kind === "regulation-adoption" && record.payload?.proposal?.proposerPartyIds?.includes(promise.partyId)) {
    if (record.payload.regulationKind === "government-regulation") return { attributionStatus: "verified-government-regulation" };
    if (record.payload.regulationKind === "ministerial-decree") return { attributionStatus: "verified-ministerial-decree" };
  }
  if (record.kind === "government-opinion" && ["agrees", "disagrees"].includes(record.payload?.opinion) && record.payload.proposal?.proposerPartyIds?.includes(promise.partyId)) {
    return { attributionStatus: "verified-government-opinion" };
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
  // A regulation's text is its law change's, not its conduct's.
  delete structuredFacts.paragraphs;
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

const opinionLabels = { agrees: "agrees with", disagrees: "disagrees with" };

export function factSummary(record, partyId) {
  if (record.kind === "government-opinion") {
    const payload = record.payload;
    return `The government ${opinionLabels[payload.opinion]} print ${payload.printNumber}, ${payload.printTitleCz}, a bill it did not submit (opinion “${payload.resultCz}”, sub-print ${payload.printNumber}/${payload.partNumber}, distributed by the Chamber on ${payload.distributedOn}); governing parties on that day: ${payload.proposal.proposerPartyIds.join(", ")}.`;
  }
  if (record.kind === "regulation-adoption") {
    const payload = record.payload;
    const by = payload.regulationKind === "government-regulation" ? "the government" : payload.issuerCz;
    return `The Collection of Laws records ${payload.citationCz}, ${payload.titleCz}, adopted by ${by} on ${payload.adoptedOn} and promulgated on ${payload.promulgatedOn}; governing parties on the adoption date: ${payload.proposal.proposerPartyIds.join(", ")}.`;
  }
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
