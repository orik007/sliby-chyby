import { hashEvidencePackage, validateEvidencePackage } from "./assessment-pipeline.mjs";
import { chosenReview, proposedPublicExplanation } from "./assessment-review.mjs";
import { isDecisiveAction } from "./attribution.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Official print kinds (tisky.zip druh_tisku.unl) of a government proposal.
const governmentProposalKinds = { 1: "government-bill", 3: "state-budget", 4: "treaty" };
const stepOrder = { submission: 0, "senate-resolution": 1, vote: 2 };

function proposalKind(facts) {
  if (facts.proposal.kind === "member-bill") return "member-bill";
  const kind = governmentProposalKinds[facts.printKindId];
  invariant(kind, `Government proposal print ${facts.printNumber} has unsupported print kind ${facts.printKindId}`);
  return kind;
}

// Why the linked text is not exactly the one the conduct concerned
// (docs/evidence-pipeline.md, Conduct and version), or null.
function versionNote(concern) {
  if (concern.removed) return "removed";
  if (concern.publishedVersionMissing) return "published-version-missing";
  if (concern.mark === "third-reading-rejection") return "third-reading-rejection";
  return null;
}

function printUrlOf(printId, conduct) {
  for (const item of conduct) {
    const facts = item.structuredFacts;
    if (item.type === "legislative-step" && String(facts.externalPrintId) === printId) return item.url;
    const linked = (facts.linkedPrints ?? []).find((print) => String(print.externalPrintId) === printId);
    if (linked?.url) return linked.url;
  }
  throw new Error(`No official page of print ${printId} in the cited conduct`);
}

// The text a conduct concerned on this print: one document per version, and
// a note for each kind of difference, naming the law changes it applies to.
function textOf(item, changes) {
  const concerns = changes
    .map((change) => ({ change, concern: item.structuredFacts.concernsLawChanges.find(({ evidenceId }) => evidenceId === change.id) }))
    .filter(({ concern }) => concern);
  const versions = new Set(concerns.map(({ concern }) => concern.version));
  invariant(versions.size === 1, `Conduct ${item.id} concerns several versions of one print`);
  const [version] = versions;
  const textUrl = concerns.map(({ change, concern }) => (concern.removed ? null : change.structuredFacts.versions[version]?.document?.url ?? null)).find(Boolean) ?? null;
  const notes = new Map();
  for (const { change, concern } of concerns) {
    const note = versionNote(concern);
    if (note) notes.set(note, [...(notes.get(note) ?? []), change.id]);
  }
  return { version, textUrl, notes: [...notes].map(([note, lawChangeIds]) => ({ note, lawChangeIds })) };
}

function stepFromConduct(item, printId, changes) {
  const facts = item.structuredFacts;
  if (item.type === "legislative-step") {
    return { kind: "submission", evidenceId: item.id, date: facts.proposal.submittedOn, proposal: proposalKind(facts), proposerCz: facts.proposal.proposerCz ?? null, ...textOf(item, changes) };
  }
  invariant(item.type === "parliamentary-vote", `Unsupported conduct ${item.id}`);
  const context = facts.linkedPrints.find((print) => String(print.externalPrintId) === printId).historyContexts.find(({ actionCz }) => isDecisiveAction(actionCz));
  const club = facts.relevantPartyVoteSummary;
  invariant(club, `Vote ${item.id} has no club result`);
  const { yes, no, abstained, notVoting, absent } = club.counts;
  return {
    kind: "vote",
    evidenceId: item.id,
    date: item.publishedAt,
    url: item.url,
    stageCz: context.stageCz,
    actionCz: context.actionCz,
    club: club.attributionStatus === "attributed" ? club.majorityChoice : "no-majority",
    counts: { yes, no, abstained, notVoting, absent },
    ...textOf(item, changes)
  };
}

/**
 * The public evidence trail of an assessment revision
 * (docs/evidence-pipeline.md, From proposal to public score), one entry per
 * print: the law changes of that print the chosen assessment found relevant
 * and cited, then the cited conduct on them and the cited Senate resolutions,
 * in order, each linking to its official record. Only links and facts from
 * the package are copied; no text excerpt is published. The trail is empty
 * when the assessment cites no relevant law change.
 */
export function buildEvidenceTrail(evidencePackage, auditRecord) {
  validateEvidencePackage(evidencePackage);
  invariant(auditRecord.resolution?.state === "candidate", "Only a candidate proposal can become a public revision");
  const chosen = chosenReview(auditRecord);
  invariant(chosen, "The proposal has no chosen assessment");
  const cited = new Set(chosen.citedEvidenceIds);
  const relevant = new Set(chosen.changeRelevance.filter(({ relevant: isRelevant }) => isRelevant).map(({ evidenceId }) => evidenceId));
  const evidence = evidencePackage.evidence.filter(({ id }) => cited.has(id));
  const conduct = evidence.filter(({ role }) => role === "conduct-evidence");
  const changesByPrint = new Map();
  for (const change of evidence.filter(({ role, id }) => role === "law-change" && relevant.has(id))) {
    const printId = String(change.structuredFacts.externalPrintId);
    changesByPrint.set(printId, [...(changesByPrint.get(printId) ?? []), change]);
  }
  return [...changesByPrint].map(([printId, changes]) => {
    const changeIds = new Set(changes.map(({ id }) => id));
    const onPrint = conduct.filter((item) => item.structuredFacts.concernsLawChanges.some(({ evidenceId }) => changeIds.has(evidenceId)));
    invariant(onPrint.length > 0, `The chosen assessment cites no conduct on print ${changes[0].structuredFacts.printNumber}`);
    const resolutionIds = new Set(changes.flatMap(({ structuredFacts }) => structuredFacts.senateResolutionEvidenceIds ?? []));
    const steps = [
      ...onPrint.map((item) => stepFromConduct(item, printId, changes)),
      // A Senate resolution is dated in the package by the vote that followed
      // it, not by its own date, so it is published without a date and
      // precedes that vote.
      ...evidence
        .filter(({ role, id }) => role === "senate-resolution" && resolutionIds.has(id))
        .map((item) => ({ kind: "senate-resolution", evidenceId: item.id, date: item.publishedAt, printPartCz: `${item.structuredFacts.printNumber}/${item.structuredFacts.partNumber}`, url: item.url }))
    ].sort((left, right) => left.date.localeCompare(right.date) || stepOrder[left.kind] - stepOrder[right.kind]);
    return {
      printNumber: changes[0].structuredFacts.printNumber,
      printUrl: printUrlOf(printId, onPrint),
      lawChanges: changes.map(({ id, structuredFacts }) => ({
        lawChangeId: id,
        headingCz: structuredFacts.heading ?? null,
        titleCz: structuredFacts.titleCz,
        amendedActs: [...new Set((structuredFacts.acts ?? []).map(({ act }) => act).filter((act) => /^\d+\/\d{4}$/.test(act)))]
      })),
      steps: steps.map(({ kind, date, ...step }) => (kind === "senate-resolution" ? { kind, ...step } : { kind, date, ...step }))
    };
  });
}

/**
 * The next public assessment revision of a promise from a human-reviewed
 * candidate proposal (docs/evidence-pipeline.md, From proposal to public
 * score). `fileId` is the promise's file name in `data/promises`, which
 * prefixes its revision files; `revisions` are the promise's current
 * revisions. The proposal must have been compared with the current public
 * revision, so a proposal made before a later revision is refused.
 */
export function createAssessmentRevision({ proposal, evidencePackage, auditRecord, promise, fileId, revisions, publishedAt }) {
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(publishedAt), "The publication date must be YYYY-MM-DD");
  invariant(promise.kind === "promise", `${promise.id} is not a promise`);
  invariant(proposal.promiseId === promise.id && auditRecord.promiseId === promise.id && evidencePackage.promise.id === promise.id, "The proposal belongs to another promise");
  invariant(hashEvidencePackage(evidencePackage) === proposal.packageHash && auditRecord.packageHash === proposal.packageHash, "The evidence package is not the one the proposal assessed");
  invariant(proposal.resolutionState === "candidate" && proposal.candidateStatus === auditRecord.resolution.status, "Only a candidate proposal can become a public revision");
  const current = Math.max(0, ...revisions.filter(({ promiseId }) => promiseId === promise.id).map(({ revision }) => revision));
  invariant(proposal.publicRevisionAtEvaluation === current, `The proposal was compared with revision ${proposal.publicRevisionAtEvaluation}, but the current revision is ${current}`);
  const evidenceTrail = buildEvidenceTrail(evidencePackage, auditRecord);
  invariant(evidenceTrail.length > 0 || proposal.candidateStatus === "no-progress", "A score other than no progress needs an evidence trail");
  const revision = current + 1;
  return {
    id: `${fileId}--${String(revision).padStart(3, "0")}`,
    promiseId: promise.id,
    revision,
    status: proposal.candidateStatus,
    explanationShort: proposedPublicExplanation(auditRecord),
    publishedAt,
    evidenceSourceIds: evidenceTrail.length > 0 ? [] : [promise.primarySourceId],
    ...(evidenceTrail.length > 0 ? { evidenceTrail } : {}),
    proposalId: proposal.proposalId,
    isDemo: false
  };
}
