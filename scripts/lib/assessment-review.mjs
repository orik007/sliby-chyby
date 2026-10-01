import { assessmentStatuses, hashAssessmentContent, hashAssessmentFingerprint, hashEvidencePackage, validateEvidencePackage } from "./assessment-pipeline.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export const reviewManifestSchemaVersion = "1.0.0";
export const assessmentFingerprintVersion = "assessment-fingerprint-v1";

export function validateReviewManifest(manifest) {
  invariant(manifest && typeof manifest === "object", "Review manifest must be an object");
  invariant(manifest.schemaVersion === reviewManifestSchemaVersion, "Unsupported review manifest schemaVersion");
  invariant(manifest.fingerprintVersion === assessmentFingerprintVersion, "Unsupported assessment fingerprint version");
  invariant(manifest.publicationApproved === false, "Review manifest must remain unpublished");
  invariant(Array.isArray(manifest.proposals), "Review manifest proposals must be an array");
  const proposalIds = new Set();
  const fingerprints = new Set();
  for (const proposal of manifest.proposals) {
    invariant(typeof proposal.proposalId === "string" && proposal.proposalId.length > 0, "Review proposal is missing proposalId");
    invariant(!proposalIds.has(proposal.proposalId), `Duplicate review proposal ID: ${proposal.proposalId}`);
    proposalIds.add(proposal.proposalId);
    invariant(typeof proposal.promiseId === "string" && proposal.promiseId.length > 0, `Review proposal ${proposal.proposalId} is missing promiseId`);
    invariant(/^[a-f0-9]{64}$/.test(proposal.assessmentFingerprint), `Review proposal ${proposal.proposalId} has an invalid assessmentFingerprint`);
    invariant(!fingerprints.has(proposal.assessmentFingerprint), `Duplicate assessment fingerprint: ${proposal.assessmentFingerprint}`);
    fingerprints.add(proposal.assessmentFingerprint);
    invariant(/^[a-f0-9]{64}$/.test(proposal.assessmentContentHash), `Review proposal ${proposal.proposalId} has an invalid assessmentContentHash`);
    invariant(/^[a-f0-9]{64}$/.test(proposal.packageHash), `Review proposal ${proposal.proposalId} has an invalid packageHash`);
    invariant(["candidate", "human-review-required"].includes(proposal.resolutionState), `Review proposal ${proposal.proposalId} has an invalid resolutionState`);
    invariant(proposal.candidateStatus === null || assessmentStatuses.includes(proposal.candidateStatus), `Review proposal ${proposal.proposalId} has an invalid candidateStatus`);
    invariant(proposal.resolutionState !== "candidate" || proposal.candidateStatus !== null, `Candidate proposal ${proposal.proposalId} must include a status`);
    invariant(proposal.resolutionState !== "human-review-required" || proposal.candidateStatus === null, `Human-review proposal ${proposal.proposalId} cannot include a candidate status`);
    invariant(typeof proposal.evaluatedAt === "string" && !Number.isNaN(Date.parse(proposal.evaluatedAt)), `Review proposal ${proposal.proposalId} has an invalid evaluatedAt`);
    invariant(Number.isInteger(proposal.publicRevisionAtEvaluation) && proposal.publicRevisionAtEvaluation >= 0, `Review proposal ${proposal.proposalId} has an invalid publicRevisionAtEvaluation`);
    invariant(proposal.humanReviewRequired === true, `Review proposal ${proposal.proposalId} must require human review`);
    invariant(proposal.publicationApproved === false, `Review proposal ${proposal.proposalId} must remain unpublished`);
    invariant(typeof proposal.path === "string" && proposal.path.startsWith("automation/review-proposals/"), `Review proposal ${proposal.proposalId} has an invalid path`);
    invariant(proposal.humanReviewPath == null || proposal.humanReviewPath === `${proposal.path}/review.md`, `Review proposal ${proposal.proposalId} has an invalid humanReviewPath`);
    invariant(proposal.supersedesProposalId == null || typeof proposal.supersedesProposalId === "string", `Review proposal ${proposal.proposalId} has an invalid supersedesProposalId`);
    invariant(proposal.supersededByProposalId == null || typeof proposal.supersededByProposalId === "string", `Review proposal ${proposal.proposalId} has an invalid supersededByProposalId`);
  }
  const proposalsById = new Map(manifest.proposals.map((proposal) => [proposal.proposalId, proposal]));
  for (const proposal of manifest.proposals) {
    if (proposal.supersedesProposalId) {
      const previous = proposalsById.get(proposal.supersedesProposalId);
      invariant(previous?.promiseId === proposal.promiseId, `Review proposal ${proposal.proposalId} supersedes an invalid proposal`);
      invariant(previous.supersededByProposalId === proposal.proposalId, `Review proposal ${proposal.proposalId} has an incomplete supersession link`);
    }
    if (proposal.supersededByProposalId) {
      const replacement = proposalsById.get(proposal.supersededByProposalId);
      invariant(replacement?.promiseId === proposal.promiseId, `Review proposal ${proposal.proposalId} has an invalid replacement`);
      invariant(replacement.supersedesProposalId === proposal.proposalId, `Review proposal ${proposal.proposalId} has an incomplete replacement link`);
    }
  }
  return manifest;
}

export function currentReviewProposal(manifest, promiseId) {
  validateReviewManifest(manifest);
  const active = manifest.proposals.filter((proposal) => proposal.promiseId === promiseId && !proposal.supersededByProposalId);
  invariant(active.length <= 1, `Promise ${promiseId} has multiple current review proposals`);
  return active[0] ?? null;
}

export function describeAssessmentInput(evidencePackage, prompts, runtime) {
  validateEvidencePackage(evidencePackage);
  const assessmentContentHash = hashAssessmentContent(evidencePackage);
  return {
    promiseId: evidencePackage.promise.id,
    packageHash: hashEvidencePackage(evidencePackage),
    assessmentContentHash,
    assessmentFingerprint: hashAssessmentFingerprint({ assessmentContentHash, prompts, runtime })
  };
}

export function planAssessmentInputs({ packages, manifest, blockedPromiseIds = new Set(), prompts, runtime }) {
  validateReviewManifest(manifest);
  const existingFingerprints = new Set(manifest.proposals.map(({ assessmentFingerprint }) => assessmentFingerprint));
  const promiseIds = new Set();
  return packages
    .map(({ path, evidencePackage }) => {
      const identity = describeAssessmentInput(evidencePackage, prompts, runtime);
      invariant(!promiseIds.has(identity.promiseId), `Duplicate evidence package for promise: ${identity.promiseId}`);
      promiseIds.add(identity.promiseId);
      const disposition = existingFingerprints.has(identity.assessmentFingerprint)
        ? "unchanged"
        : blockedPromiseIds.has(identity.promiseId)
          ? "blocked-oversized"
          : "assess";
      return { path, evidencePackage, ...identity, disposition };
    })
    .sort((left, right) => left.promiseId.localeCompare(right.promiseId));
}

// `publicRevisionAtEvaluation` is the promise's latest public revision number
// when the proposal was made (0 when it has none).
export function createReviewProposal({ auditRecord, proposalDirectory, supersedesProposalId = null, publicRevisionAtEvaluation }) {
  invariant(Number.isInteger(publicRevisionAtEvaluation) && publicRevisionAtEvaluation >= 0, "createReviewProposal requires publicRevisionAtEvaluation");
  invariant(auditRecord?.publicationApproved === false, "Assessment audit must remain unpublished");
  invariant(["candidate", "human-review-required"].includes(auditRecord?.resolution?.state), "Assessment audit has no reviewable resolution");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.assessmentFingerprint), "Assessment audit has an invalid fingerprint");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.assessmentContentHash), "Assessment audit has an invalid content hash");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.packageHash), "Assessment audit has an invalid package hash");
  const promiseId = auditRecord.promiseId;
  invariant(typeof promiseId === "string" && promiseId.length > 0, "Assessment audit is missing promiseId");
  const proposalId = `${promiseId}--${auditRecord.assessmentFingerprint.slice(0, 12)}`;
  return {
    schemaVersion: reviewManifestSchemaVersion,
    proposalId,
    promiseId,
    assessmentFingerprint: auditRecord.assessmentFingerprint,
    assessmentContentHash: auditRecord.assessmentContentHash,
    packageHash: auditRecord.packageHash,
    evaluatedAt: auditRecord.evaluatedAt,
    publicRevisionAtEvaluation,
    resolutionState: auditRecord.resolution.state,
    resolutionReason: auditRecord.resolution.reason,
    candidateStatus: auditRecord.resolution.status,
    confidence: auditRecord.resolution.state === "candidate"
      ? Object.values(auditRecord.validatedAssessments ?? {}).filter(Boolean).map((review) => review.confidence)
      : null,
    supersedesProposalId,
    supersededByProposalId: null,
    humanReviewRequired: true,
    publicationApproved: false,
    path: proposalDirectory.replaceAll("\\", "/"),
    humanReviewPath: `${proposalDirectory.replaceAll("\\", "/")}/review.md`
  };
}

export const resolutionLabels = {
  "assessor-consensus": "oba automatické posudky se shodly",
  "assessor-consensus-one-sufficient": "oba automatické posudky daly stejné hodnocení, jen jeden z nich považuje podklady za dostatečné",
  "arbiter-selection": "o neshodě automatických posudků rozhodl třetí hodnotitel",
  "arbiter-confirmed-single-assessor": "třetí hodnotitel ověřil jediný použitelný automatický posudek",
  "insufficient-evidence": "oba automatické posudky označily podklady za nedostatečné",
  "arbiter-cannot-decide": "třetí hodnotitel nedokázal spor rozhodnout",
  "arbiter-selected-insufficient-evidence": "třetí hodnotitel vybral posudek s nedostatečnými podklady",
  "arbiter-input-too-large": "posudky se neshodly a balíček s nimi je větší, než třetí hodnotitel dokáže přečíst"
};

export const readerStatus = {
  fulfilled: { label: "Splněno", score: "+2" },
  "moving-towards": { label: "Směřuje ke splnění", score: "+1" },
  "no-progress": { label: "Zatím bez ověřeného podstatného posunu", score: "0" },
  "moving-against": { label: "Směřuje proti slibu", score: "−1" },
  "acting-against": { label: "Jedná proti slibu", score: "−2" }
};

function evidenceLabel(evidence) {
  if (evidence.role === "promise-source") return "Původní volební slib";
  if (evidence.role === "senate-resolution") return "Usnesení Senátu, kterým vrátil návrh Sněmovně";
  if (evidence.role === "law-change") return `Změna zákona v návrhu projednávaném Sněmovnou: ${evidence.structuredFacts?.titleCz ?? evidence.title}`;
  if (evidence.type === "parliamentary-vote") return "Výsledek hlasování Poslanecké sněmovny";
  if (evidence.type === "legislative-step") return "Průběh projednávání návrhu ve Sněmovně";
  return evidence.publisher;
}

export function simplifyPublicExplanation(explanation) {
  const simplified = String(explanation)
    .replace(/,\s*veden(?:ý|á|é)\s+ve\s+Sněmovně\s+jako\s+tisk\s+č\.\s*\d+/giu, "")
    .replace(/\s+/g, " ")
    .trim();
  const longForm = /elektronick\p{L}*\s+evidenc\p{L}*\s+tržeb/iu;
  const abbreviation = /\bEET 2\.0\b/u;
  const longFormIndex = simplified.search(longForm);
  const abbreviationIndex = simplified.search(abbreviation);

  if (abbreviationIndex === -1) return simplified;
  if (longFormIndex === -1 || abbreviationIndex < longFormIndex) {
    return simplified.replace(abbreviation, "EET 2.0 (elektronická evidence tržeb)");
  }
  return simplified.replace(/(elektronick\p{L}*\s+evidenc\p{L}*\s+tržeb)\s+EET 2\.0\b/iu, "$1 (EET 2.0)");
}

// The assessment whose explanation the proposal carries: the one the arbiter
// selected, or the first valid one when both assessors agreed.
export function chosenReview(auditRecord) {
  const reviewsByAssessor = auditRecord.validatedAssessments ?? {};
  return auditRecord.resolution.selectedReview === "assessor-b"
    ? reviewsByAssessor["assessor-b"]
    : reviewsByAssessor["assessor-a"] ?? reviewsByAssessor["assessor-b"];
}

/** The public explanation a candidate proposal would carry, or null. */
export function proposedPublicExplanation(auditRecord) {
  if (auditRecord.resolution.state !== "candidate" || !auditRecord.resolution.status) return null;
  const chosen = chosenReview(auditRecord);
  return chosen ? simplifyPublicExplanation(chosen.explanationCz) : null;
}

/**
 * The latest revision of every promise in `data/assessment-revisions`, the
 * score the public site shows. Returns a map of promise ID to
 * `{ status, revision }`.
 */
export function currentPublicRevisions(revisions) {
  const latest = new Map();
  for (const revision of revisions) {
    const label = revision.name ?? revision.id;
    invariant(typeof revision.promiseId === "string" && revision.promiseId.length > 0, `Assessment revision ${label} has no promiseId`);
    invariant(Number.isInteger(revision.revision) && revision.revision > 0, `Assessment revision ${label} has an invalid revision number`);
    invariant(Object.hasOwn(readerStatus, revision.status), `Assessment revision ${label} has an unknown status`);
    const current = latest.get(revision.promiseId);
    if (!current || revision.revision > current.revision) latest.set(revision.promiseId, revision);
  }
  return new Map([...latest].map(([promiseId, { status, revision }]) => [promiseId, { status, revision }]));
}

export function renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal }) {
  validateEvidencePackage(evidencePackage);
  const reviewsByAssessor = auditRecord.validatedAssessments ?? {};
  const reviews = [
    ["První posudek", reviewsByAssessor["assessor-a"]],
    ["Druhý posudek", reviewsByAssessor["assessor-b"]]
  ].filter(([, review]) => review);
  const chosen = chosenReview(auditRecord);
  const proposed = proposal.candidateStatus ? readerStatus[proposal.candidateStatus] : null;
  const hasPublicCandidate = proposal.resolutionState === "candidate";
  if (hasPublicCandidate && !proposed) {
    throw new Error(`Candidate review proposal ${proposal.proposalId} must use a supported candidateStatus.`);
  }
  const publicExplanation = hasPublicCandidate ? proposedPublicExplanation(auditRecord) : null;
  if (hasPublicCandidate) invariant(publicExplanation, `Candidate review proposal ${proposal.proposalId} has no chosen assessment.`);
  const resolutionLabel = resolutionLabels[proposal.resolutionReason] ?? proposal.resolutionReason;
  const lines = [
    `# ${evidencePackage.promise.titleCz}`,
    "",
    "> Neveřejný návrh k lidské kontrole. Ani schválení tohoto souboru samo nic nezveřejňuje a nemění SLAVA Index.",
    "",
    "## Návrh pro veřejný web",
    "",
    ...(hasPublicCandidate
      ? [
          "Toto je jediná část dokumentu určená jako kandidát veřejného textu. Musí být srozumitelná bez znalosti projektu, práva nebo fungování Poslanecké sněmovny.",
          "",
          "### Hodnocení",
          "",
          `**${proposed.label} (${proposed.score})**`,
          "",
          "### Vysvětlení",
          "",
          publicExplanation,
          ""
        ]
      : ["*Nevznikl žádný návrh veřejného hodnocení ani vysvětlení.*", ""]),
    "## Co má zkontrolovat reviewer",
    "",
    "- Odpovídá navržené hodnocení metodice SLAVA Indexu?",
    "- Je jednání správně připsáno sledované straně?",
    "- Je veřejné vysvětlení pochopitelné samo o sobě a říká, kdo co udělal a jak to souvisí se slibem?",
    "- Jsou zkratky, právní pojmy a úřední označení při prvním použití vysvětlené?",
    "- Dokládají uvedené zdroje všechna podstatná tvrzení a nechybí rozporný podklad?",
    "",
    "## Technické podklady pro reviewera",
    "",
    `- Výsledek automatického procesu: ${resolutionLabel}`,
    `- Interní stav: ${proposal.candidateStatus ? `\`${proposal.candidateStatus}\`` : "bez kandidátního stavu"}`,
    `- Důvod výsledku: \`${proposal.resolutionReason}\``,
    "- Úplný strojový audit: `assessment-run.json`",
    "- Přesný balíček posuzovaných podkladů: `evidence-package.json`",
    ""
  ];
  // The same score without the arbiter: both assessments are shown, because
  // they disagree on whether the evidence suffices.
  if (auditRecord.resolution.reason === "assessor-consensus-one-sufficient") {
    lines.push(
      "### Stejné hodnocení, rozdílný názor na podklady",
      "",
      `Oba nezávislí hodnotitelé dali stejné hodnocení: **${proposed.label} (${proposed.score})**. Za dostatečné ale podklady považuje jen jeden z nich a návrh nese jeho posudek.`,
      ""
    );
    for (const [name, review] of reviews) {
      lines.push(`#### ${name}: podklady ${review.evidenceSufficient ? "stačí" : "nestačí"}`, "", review.explanationCz, "");
      if (review.uncertainties.length > 0) {
        lines.push("Co zůstává nejisté:", "", ...review.uncertainties.map((item) => `- ${item}`), "");
      }
    }
  } else if (["assessor-consensus", "insufficient-evidence"].includes(auditRecord.resolution.reason)) {
    // Only agreeing assessors reach a result without the arbiter.
    const consensusResult = proposed
      ? `${proposed.label} (${proposed.score})`
      : "podklady nestačí pro automatický návrh hodnocení";
    lines.push(
      "### Shoda hodnotitelů",
      "",
      `Oba nezávislí hodnotitelé dospěli ke stejnému výsledku: **${consensusResult}**.`,
      ""
    );
    if (!proposed) lines.push(simplifyPublicExplanation(chosen.explanationCz), "");
    if (chosen.uncertainties.length > 0) {
      lines.push("Co zůstává nejisté:", "", ...chosen.uncertainties.map((item) => `- ${item}`), "");
    }
    lines.push("Úplné oddělené odpovědi obou hodnotitelů zůstávají v souboru `assessment-run.json`.", "");
  } else {
    lines.push(reviews.length === 1 ? "### Jediný použitelný posudek" : "### Odlišné posudky", "");
    for (const [name, review] of reviews) {
      const status = readerStatus[review.status];
      lines.push(`#### ${name}: ${status.label} (${status.score})`, "", review.explanationCz, "");
      if (review.uncertainties.length > 0) {
        lines.push("Co zůstává nejisté:", "", ...review.uncertainties.map((item) => `- ${item}`), "");
      }
    }
    lines.push("### Rozhodnutí třetího hodnotitele", "", auditRecord.arbiter ? auditRecord.arbiter.output.explanationCz : "Třetí hodnotitel nebyl zavolán, protože balíček s oběma posudky je větší, než dokáže přečíst. Spor musí rozhodnout člověk.", "");
  }
  const lawChanges = evidencePackage.evidence.filter(({ role }) => role === "law-change");
  if (lawChanges.length > 0) {
    lines.push("### Souvisí změny zákonů se slibem?", "", "| Změna zákona | " + reviews.map(([name]) => name).join(" | ") + " |", "| --- | " + reviews.map(() => "---").join(" | ") + " |");
    for (const change of lawChanges) {
      const cells = reviews.map(([, review]) => {
        const verdict = review.changeRelevance?.find(({ evidenceId }) => evidenceId === change.id);
        return verdict ? `${verdict.relevant ? "ano" : "ne"}: ${verdict.reasonCz.replaceAll("|", "/")}` : "—";
      });
      lines.push(`| [${evidenceLabel(change).replaceAll("|", "/")}](${change.url}) | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  const citedIds = new Set([
    ...evidencePackage.evidence.filter(({ role }) => role === "promise-source").map(({ id }) => id),
    ...reviews.flatMap(([, review]) => review.citedEvidenceIds),
    ...(auditRecord.arbiter?.output.citedEvidenceIds ?? [])
  ]);
  const citedEvidence = evidencePackage.evidence.filter(({ id }) => citedIds.has(id));
  lines.push("### Zdroje použité při hodnocení", "", ...citedEvidence.map((evidence) => `- [${evidenceLabel(evidence)}](${evidence.url})`), "");
  if (proposal.supersedesProposalId) {
    lines.push("Tento návrh nahrazuje starší automatický posudek, který zůstává zachovaný v auditní historii.", "");
  }
  return `${lines.join("\n")}\n`;
}

export function addReviewProposals(manifest, proposals) {
  validateReviewManifest(manifest);
  const merged = structuredClone(manifest);
  for (const proposal of proposals) {
    const previous = currentReviewProposal(merged, proposal.promiseId);
    if (previous) {
      invariant(proposal.supersedesProposalId === previous.proposalId, `Review proposal ${proposal.proposalId} must supersede the current proposal`);
      previous.supersededByProposalId = proposal.proposalId;
    } else {
      invariant(proposal.supersedesProposalId == null, `Review proposal ${proposal.proposalId} cannot supersede a missing proposal`);
    }
    merged.proposals.push(proposal);
  }
  merged.proposals.sort((left, right) => left.promiseId.localeCompare(right.promiseId) || left.evaluatedAt.localeCompare(right.evaluatedAt));
  return validateReviewManifest(merged);
}

/**
 * How the valid assessors judged each law change, keyed by the tag or
 * direct link that routed it to the promise, so an overly broad route is
 * visible (docs/evidence-pipeline.md, Report).
 */
export function relevanceVerdictsByRoute(evidencePackage, auditRecord) {
  const routeKeys = new Map(evidencePackage.evidence.filter(({ role }) => role === "law-change").map((evidence) => [evidence.id, [
    ...(evidence.matchBasis?.matchedTagIds ?? []).map((tagId) => `tag:${tagId}`),
    ...(evidence.matchBasis?.directLinkIdentifiers ?? []).map((identifier) => `direct:${identifier}`)
  ]]));
  const verdicts = new Map();
  for (const review of Object.values(auditRecord.validatedAssessments ?? {})) {
    for (const { evidenceId, relevant } of review?.changeRelevance ?? []) {
      for (const key of routeKeys.get(evidenceId) ?? []) {
        const current = verdicts.get(key) ?? { route: key, verdicts: 0, notRelevant: 0 };
        current.verdicts += 1;
        if (!relevant) current.notRelevant += 1;
        verdicts.set(key, current);
      }
    }
  }
  return [...verdicts.values()];
}

export function mergeRelevanceVerdicts(lists) {
  const merged = new Map();
  for (const { route, verdicts, notRelevant } of lists.flat()) {
    const current = merged.get(route) ?? { route, verdicts: 0, notRelevant: 0 };
    current.verdicts += verdicts;
    current.notRelevant += notRelevant;
    merged.set(route, current);
  }
  return [...merged.values()].sort((left, right) => right.notRelevant - left.notRelevant || left.route.localeCompare(right.route));
}

// GitHub rejects a pull request body or comment above 65,536 characters.
// The workflow appends a short data-collection section after the body.
const maxPullRequestBodyCharacters = 55_000;
const maxCommentCharacters = 60_000;
// A bound on how many comments one run may post; the list is cut beyond it.
const maxContinuationComments = 40;
// Model-written reasons longer than this are cut in the list; the review page
// keeps them whole.
const maxListedExplanationCharacters = 1_500;

/** The first line of every continuation comment, so a run can find its own. */
export const continuationMarker = "<!-- slava-review-continuation -->";

// Model-written text is shown as plain text: no Markdown, HTML, mentions, or
// issue links in the pull request.
function inertMarkdown(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .replaceAll("@", "@​")
    .replace(/#(\d)/g, "#​$1")
    .replace(/\b(GH)-(\d)/gi, "$1​-$2")
    .replace(/[\\`*_[\]{}()<>#+!|~&:-]/g, "\\$&");
}

function listedExplanation(text) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return inertMarkdown(flat.length > maxListedExplanationCharacters ? `${flat.slice(0, maxListedExplanationCharacters)} …` : flat);
}

/**
 * How each automatic reviewer decided and why, for the review list: both
 * assessors (null when an output was invalid) and the arbiter (null when it
 * was not called).
 */
export function reviewVerdicts(auditRecord) {
  const reviews = auditRecord.validatedAssessments ?? {};
  const assessor = (key) => reviews[key]
    ? { status: reviews[key].status, evidenceSufficient: reviews[key].evidenceSufficient, explanationCz: reviews[key].explanationCz }
    : null;
  const arbiter = auditRecord.arbiter?.output;
  return {
    assessorA: assessor("assessor-a"),
    assessorB: assessor("assessor-b"),
    arbiter: arbiter ? { choice: arbiter.choice, explanationCz: arbiter.explanationCz } : null
  };
}

const arbiterChoices = { "assessor-a": "vybral první posudek", "assessor-b": "vybral druhý posudek", "cannot-decide": "nedokázal rozhodnout" };

// What the pull request lists is defined in docs/evidence-pipeline.md, step 10.
// The body carries the summary and as much of the list as fits; the rest
// continues, in order, in comments that every run rewrites.
export function renderReviewPullRequest(summary) {
  const status = (value) => value ? `${readerStatus[value].label} (${readerStatus[value].score})` : "bez hodnocení na webu";
  const heading = (item) => `${item.reviewUrl ? `[${item.promiseTitleCz}](${item.reviewUrl})` : item.promiseTitleCz} (\`${item.promiseId}\`)`;
  const notes = (item) => [
    ...(item.newInRun ? ["nový návrh z tohoto běhu"] : []),
    ...(item.packageState === "changed" ? ["podklady se od návrhu změnily, nový návrh zatím nevznikl"] : []),
    ...(item.packageState === "withdrawn" ? ["slib už nemá žádný aktuální balíček podkladů"] : [])
  ];
  const changes = summary.pendingReviews.filter(({ kind }) => kind === "score-change");
  const humanReviews = summary.pendingReviews.filter(({ kind }) => kind === "human-review");
  const oversized = summary.results.filter(({ disposition }) => disposition === "blocked-oversized");
  const party = (item) => item.partyName ? `${item.partyName} · ` : "";

  const assessorLine = (name, verdict) => verdict
    ? `- **${name}:** ${status(verdict.status)}${verdict.evidenceSufficient === false ? ", podklady podle něj nestačí" : ""}. ${listedExplanation(verdict.explanationCz)}`
    : `- **${name}:** výstup neprošel kontrolou, nepoužil se.`;
  const changeBlock = (item) => {
    const verdicts = item.verdicts;
    return [
      `#### ${heading(item)}`,
      "",
      `${party(item)}Na webu: **${status(item.publicStatus)}** → navrženo: **${status(item.candidateStatus)}** · ${resolutionLabels[item.resolutionReason] ?? item.resolutionReason}`,
      "",
      ...(verdicts
        ? [
          assessorLine("První hodnotitel", verdicts.assessorA),
          assessorLine("Druhý hodnotitel", verdicts.assessorB),
          verdicts.arbiter
            ? `- **Třetí hodnotitel:** ${arbiterChoices[verdicts.arbiter.choice] ?? verdicts.arbiter.choice}. ${listedExplanation(verdicts.arbiter.explanationCz)}`
            : "- **Třetí hodnotitel:** nevolán, posudky se shodly.",
          ""
        ]
        : item.explanationCz ? [`> ${listedExplanation(item.explanationCz)}`, ""] : []),
      ...notes(item).map((note) => `*${note[0].toUpperCase()}${note.slice(1)}.*`).flatMap((note) => [note, ""])
    ].join("\n");
  };
  const attention = [
    ...humanReviews.map((item) => `- ${heading(item)}: ${party(item)}${resolutionLabels[item.resolutionReason] ?? item.resolutionReason}${notes(item).map((note) => ` (${note})`).join("")}`),
    ...oversized.map((result) => `- ${heading(result)}: balíček je větší, než model dokáže přečíst`)
  ];
  // The counts and any interruption stay in the body, so they are never cut.
  const others = [
    `- Nové návrhy, které potvrzují hodnocení na webu: **${summary.confirmedCount}**`,
    `- Beze změny podkladů, bez nového volání modelů: **${summary.unchangedCount}**`,
    `- Odloženo limitem běhu (${summary.maxAssessments}): **${summary.deferredCount}**`,
    `- Izolovaná selhání hodnocení, zkusí se znovu v dalším běhu: **${summary.failedCount}**`,
    ...(summary.interruption ? [`- Běh byl přerušen chybou (${inertMarkdown(summary.interruption.message.slice(0, 300))}); nehodnoceno: **${summary.interruptedCount + summary.notAssessedAfterInterruptionCount}**. Dokončená hodnocení jsou uložena, další běh ohodnotí zbytek.`] : []),
    ""
  ].join("\n");
  const routes = summary.relevanceVerdictsByRoute.filter(({ notRelevant }) => notRelevant > 0);
  // The route table stays in the body, so it is never cut with the list; the
  // routes with the most rejections come first.
  const listedRoutes = 20;
  const routeTable = routes.length > 0
    ? ["", "Změny zákonů, které hodnotitelé označili za nesouvisející se slibem, podle štítku nebo přímé vazby, která je ke slibu přivedla:", "", "| Cesta | Nesouvisející | Verdiktů celkem |", "| --- | ---: | ---: |",
      ...routes.slice(0, listedRoutes).map(({ route, notRelevant, verdicts }) => `| \`${route}\` | ${notRelevant} | ${verdicts} |`),
      ...(routes.length > listedRoutes ? ["", `*… a dalších ${routes.length - listedRoutes} cest; úplný přehled je v \`assessment-batch.json\`.*`] : []), ""].join("\n")
    : "";

  const sections = [
    {
      title: `### Návrhy, které mění hodnocení na webu (${changes.length}, z toho nové: ${changes.filter(({ newInRun }) => newInRun).length})`,
      blocks: changes.length > 0 ? changes.map(changeBlock) : ["Žádný aktuální návrh nemění hodnocení zveřejněné na webu.\n"]
    },
    ...(attention.length > 0 ? [{ title: `### Vyžaduje lidské rozhodnutí (${attention.length})`, blocks: attention }] : []),
  ];

  const intro = [
    "## Neveřejné návrhy změn hodnocení SLAVA",
    "",
    "Tento pull request ukládá automaticky připravené návrhy k lidské kontrole. Jeho sloučení **nezveřejní hodnocení ani nezmění veřejný web**. Návrh zmizí z tohoto přehledu, až hodnocení na webu změní samostatný pull request, nebo až ho nahradí novější návrh. U každé změny jsou verdikty obou automatických hodnotitelů a třetího hodnotitele s jejich zdůvodněním; úplný záznam je na stránce návrhu.",
    "",
    "### Souhrn",
    "",
    `- Návrhy, které mění hodnocení na webu: **${changes.length}**`,
    `- Vyžaduje lidské rozhodnutí: **${attention.length}**`,
    others,
    routeTable
  ].join("\n");
  // Reserved for the note that the list continues in comments.
  const noteReserve = 400;
  const pages = [];
  let page = [];
  let used = 0;
  let omitted = 0;
  const budget = () => (pages.length === 0 ? maxPullRequestBodyCharacters - intro.length - noteReserve : maxCommentCharacters - 200);
  const newPage = () => {
    pages.push(page);
    page = [];
    used = 0;
  };
  // A section heading travels with its first block, so no page ends with an
  // empty heading. Every block is one list item.
  const add = (text, continuedTitle) => {
    if (pages.length > maxContinuationComments) {
      omitted += 1;
      return;
    }
    const size = text.length + 1;
    if (used + size > budget() && page.length > 0) {
      newPage();
      if (pages.length > maxContinuationComments) {
        omitted += 1;
        return;
      }
      if (continuedTitle) {
        page.push(`\n${continuedTitle} (pokračování)\n`);
        used += continuedTitle.length + 16;
      }
    }
    page.push(text.length > budget() ? `${text.slice(0, budget() - 20)} …\n` : text);
    used += Math.min(size, budget());
  };
  for (const section of sections) {
    section.blocks.forEach((block, index) => add(
      index === 0 ? `\n${section.title}\n\n${block}` : block,
      index === 0 ? null : section.title
    ));
  }
  if (page.length > 0 && pages.length <= maxContinuationComments) pages.push(page);
  if (omitted > 0) pages.at(-1).push(`*… a dalších ${omitted} položek se sem nevešlo; úplný seznam je v \`assessment-batch.json\` v artefaktu běhu a na stránkách návrhů.*\n`);

  const total = pages.length;
  const text = (blocks) => blocks.join("\n");
  const note = total > 1
    ? `*Přehled pokračuje v ${total - 1} ${total - 1 === 1 ? "komentáři" : "komentářích"} pod tímto pull requestem, v pořadí. Každý běh je přepíše.*\n\n`
    : "";
  const body = `${intro}\n${note}${text(pages[0]).replace(/^\n/, "")}\n\nVšechny návrhy vyžadují lidskou kontrolu a nejsou schválené ke zveřejnění. Úplný přehled všech balíčků je v \`assessment-batch.json\` v artefaktu běhu.\n`;
  const comments = pages.slice(1).map((blocks, index) => `${continuationMarker}\n## Neveřejné návrhy změn hodnocení SLAVA, pokračování ${index + 2}/${total}\n\n${text(blocks).replace(/^\n/, "")}\n`);
  return { body, comments };
}
