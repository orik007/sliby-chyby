import { hashEvidencePackage, validateEvidencePackage } from "./assessment-pipeline.mjs";
import { chosenReview, proposedPublicExplanation } from "./assessment-review.mjs";
import { isDecisiveAction } from "./attribution.mjs";
import { contextOmissionsOf } from "./context-omissions.mjs";
import { isRegulationKind } from "./regulations.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

// Official print kinds (tisky.zip druh_tisku.unl) of a government proposal.
const governmentProposalKinds = { 1: "government-bill", 3: "state-budget", 4: "treaty" };
const stepOrder = { submission: 0, "government-opinion": 1, "senate-resolution": 2, vote: 3 };

function proposalKind(facts) {
  if (facts.proposal.kind === "member-bill") return "member-bill";
  const kind = governmentProposalKinds[facts.printKindId];
  invariant(kind, `Government proposal print ${facts.printNumber} has unsupported print kind ${facts.printKindId}`);
  return kind;
}

// Why the linked text is not exactly the one the conduct concerned
// (docs/evidence-pipeline.md, Conduct and version), or where it comes from
// when psp.cz does not publish it (Text from the Collection of Laws), or null. A version known
// only by the print title has no document to link.
function versionNote(concern, entry) {
  if (concern.removed) return "removed";
  if (!entry?.document?.url) return "text-not-published";
  if (concern.publishedVersionMissing) return "published-version-missing";
  if (concern.mark === "third-reading-rejection") return "third-reading-rejection";
  if (entry.promulgatedAct) return "promulgated-text";
  return null;
}

function printUrlOf(printId, conduct) {
  for (const item of conduct) {
    const facts = item.structuredFacts;
    if (item.type === "legislative-step" && String(facts.externalPrintId) === printId) return item.url;
    if (item.type === "government-opinion" && String(facts.externalPrintId) === printId) return facts.printUrl;
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
    const note = versionNote(concern, change.structuredFacts.versions[version]);
    if (note) notes.set(note, [...(notes.get(note) ?? []), change.id]);
  }
  return { version, textUrl, notes: [...notes].map(([note, lawChangeIds]) => ({ note, lawChangeIds })) };
}

function stepFromConduct(item, printId, changes) {
  const facts = item.structuredFacts;
  if (item.type === "legislative-step") {
    return { kind: "submission", evidenceId: item.id, date: facts.proposal.submittedOn, proposal: proposalKind(facts), proposerCz: facts.proposal.proposerCz ?? null, ...textOf(item, changes) };
  }
  // The government's opinion on a bill it did not submit links to the
  // opinion's own page on psp.cz.
  if (item.type === "government-opinion") {
    return { kind: "government-opinion", evidenceId: item.id, date: item.publishedAt, opinion: facts.opinion, printPartCz: `${facts.printNumber}/${facts.partNumber}`, url: item.url, ...textOf(item, changes) };
  }
  invariant(item.type === "parliamentary-vote", `Unsupported conduct ${item.id}`);
  const linkedPrint = (facts.linkedPrints ?? []).find((print) => String(print.externalPrintId) === printId);
  const context = (linkedPrint?.historyContexts ?? []).find(({ actionCz }) => isDecisiveAction(actionCz));
  invariant(context, `Vote ${item.id} has no decisive history step on print ${printId}`);
  const club = facts.relevantPartyVoteSummary;
  invariant(club, `Vote ${item.id} has no club result`);
  const { yes, no, abstained, notVoting, absent, unknown } = club.counts;
  return {
    kind: "vote",
    evidenceId: item.id,
    date: item.publishedAt,
    url: item.url,
    stageCz: context.stageCz,
    actionCz: context.actionCz,
    club: club.attributionStatus === "attributed" ? club.majorityChoice : "no-majority",
    counts: { yes, no, abstained, notVoting, absent, unknown },
    ...textOf(item, changes)
  };
}

/**
 * The public evidence trail of an assessment revision
 * (docs/evidence-pipeline.md, From proposal to public score), one entry per
 * print, then one per government regulation or ministerial decree (its
 * adoption and its text as promulgated): the law changes of that print the chosen assessment found relevant
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
  const conduct = evidencePackage.evidence.filter(({ id, role }) => cited.has(id) && role === "conduct-evidence");
  // A relevant law change enters the trail when the assessment cites it or
  // cites conduct on it, so no cited conduct is lost.
  const concerned = new Set(conduct.flatMap(({ structuredFacts }) => structuredFacts.concernsLawChanges.map(({ evidenceId }) => evidenceId)));
  const evidence = evidencePackage.evidence.filter(({ id, role }) => cited.has(id) || (role === "law-change" && concerned.has(id)));
  // A government regulation or ministerial decree is one entry: its adoption
  // and its text as promulgated.
  const regulations = evidence.filter(({ role, id, structuredFacts }) => role === "law-change" && relevant.has(id) && isRegulationKind(structuredFacts.printKindId)).flatMap((change) => {
    const adoption = conduct.find((item) => item.type === "regulation-adoption" && item.structuredFacts.concernsLawChanges.some(({ evidenceId }) => evidenceId === change.id));
    if (!adoption) return [];
    const facts = adoption.structuredFacts;
    return [{
      kind: "regulation",
      lawChangeId: change.id,
      citationCz: facts.citationCz,
      titleCz: facts.titleCz,
      textUrl: change.structuredFacts.versions.adopted.document.url,
      adoption: { date: facts.adoptedOn, evidenceId: adoption.id, by: facts.regulationKind === "government-regulation" ? "government" : "ministry", issuerCz: facts.issuerCz }
    }];
  });
  const changesByPrint = new Map();
  for (const change of evidence.filter(({ role, id, structuredFacts }) => role === "law-change" && relevant.has(id) && !isRegulationKind(structuredFacts.printKindId))) {
    const printId = String(change.structuredFacts.externalPrintId);
    changesByPrint.set(printId, [...(changesByPrint.get(printId) ?? []), change]);
  }
  // A print whose relevant changes the assessment cites without any conduct on
  // them has no attributable step to show and is left out.
  const prints = [...changesByPrint].flatMap(([printId, changes]) => {
    const changeIds = new Set(changes.map(({ id }) => id));
    const onPrint = conduct.filter((item) => item.structuredFacts.concernsLawChanges.some(({ evidenceId }) => changeIds.has(evidenceId)));
    if (onPrint.length === 0) return [];
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
    return [{
      printNumber: changes[0].structuredFacts.printNumber,
      printUrl: printUrlOf(printId, onPrint),
      lawChanges: changes.map(({ id, structuredFacts }) => ({
        lawChangeId: id,
        headingCz: structuredFacts.heading ?? null,
        titleCz: structuredFacts.titleCz,
        amendedActs: [...new Set((structuredFacts.acts ?? []).map(({ act }) => act).filter((act) => /^\d+\/\d{4}$/.test(act)))]
      })),
      steps: steps.map(({ kind, date, ...step }) => (kind === "senate-resolution" ? { kind, ...step } : { kind, date, ...step }))
    }];
  });
  return [...prints, ...regulations];
}

/**
 * The next public assessment revision of a promise from a human-reviewed
 * candidate proposal (docs/evidence-pipeline.md, From proposal to public
 * score). `fileId` is the promise's file name in `data/promises`, which
 * prefixes its revision files; `revisions` are the promise's current
 * revisions; `manifestProposal` is the proposal's entry in the review
 * manifest. The proposal must be current in the manifest and have been
 * compared with the current public revision, so a superseded proposal or one
 * made before a later revision is refused.
 */
export function createAssessmentRevision({ proposal, manifestProposal, evidencePackage, auditRecord, promise, fileId, revisions, publishedAt }) {
  // Supersession is recorded only in the review manifest.
  invariant(manifestProposal?.proposalId === proposal.proposalId, `Proposal ${proposal.proposalId} is not in the review manifest`);
  invariant(!manifestProposal.supersededByProposalId, `Proposal ${proposal.proposalId} is superseded by ${manifestProposal.supersededByProposalId}`);
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) && new Date(`${publishedAt}T00:00:00Z`).toISOString().startsWith(publishedAt), "The publication date must be a calendar date YYYY-MM-DD");
  invariant(promise.kind === "promise", `${promise.id} is not a promise`);
  invariant(proposal.promiseId === promise.id && auditRecord.promiseId === promise.id && evidencePackage.promise.id === promise.id, "The proposal belongs to another promise");
  invariant(hashEvidencePackage(evidencePackage) === proposal.packageHash && auditRecord.packageHash === proposal.packageHash, "The evidence package is not the one the proposal assessed");
  invariant(auditRecord.assessmentFingerprint === proposal.assessmentFingerprint && auditRecord.assessmentContentHash === proposal.assessmentContentHash, "The assessment run is not the one the proposal records");
  invariant(proposal.resolutionState === "candidate" && proposal.candidateStatus === auditRecord.resolution.status, "Only a candidate proposal can become a public revision");
  const promiseRevisions = revisions.filter(({ promiseId }) => promiseId === promise.id);
  const current = Math.max(0, ...promiseRevisions.map(({ revision }) => revision));
  invariant(proposal.publicRevisionAtEvaluation === current, `The proposal was compared with revision ${proposal.publicRevisionAtEvaluation}, but the current revision is ${current}`);
  const currentDate = promiseRevisions.find(({ revision }) => revision === current)?.publishedAt ?? "";
  invariant(publishedAt >= currentDate && publishedAt >= evidencePackage.asOf, `The publication date must not precede the current revision (${currentDate}) or the evidence package (${evidencePackage.asOf})`);
  const evidenceTrail = buildEvidenceTrail(evidencePackage, auditRecord);
  invariant(evidenceTrail.length > 0 || proposal.candidateStatus === "no-progress", "A score other than no progress needs an evidence trail");
  const revision = current + 1;
  const contextOmissions = contextOmissionsOf(evidencePackage);
  return {
    id: `${fileId}--${String(revision).padStart(3, "0")}`,
    promiseId: promise.id,
    revision,
    status: proposal.candidateStatus,
    explanationShort: proposedPublicExplanation(auditRecord),
    publishedAt,
    evidenceSourceIds: evidenceTrail.length > 0 ? [] : [promise.primarySourceId],
    ...(evidenceTrail.length > 0 ? { evidenceTrail } : {}),
    ...(contextOmissions.length > 0 ? { contextOmissions } : {}),
    proposalId: proposal.proposalId,
    isDemo: false
  };
}
