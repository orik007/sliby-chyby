import { assessmentStatuses, hashAssessmentContent, hashAssessmentFingerprint, hashEvidencePackage, validateEvidencePackage } from "./assessment-pipeline.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export const reviewManifestSchemaVersion = "1.0.0";
export const assessmentFingerprintVersion = "assessment-fingerprint-v1";

export function emptyReviewManifest() {
  return {
    schemaVersion: reviewManifestSchemaVersion,
    fingerprintVersion: assessmentFingerprintVersion,
    publicationApproved: false,
    proposals: []
  };
}

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
          ? "blocked-enrichment-warning"
          : "assess";
      return { path, evidencePackage, ...identity, disposition };
    })
    .sort((left, right) => left.promiseId.localeCompare(right.promiseId));
}

export function createReviewProposal({ auditRecord, proposalDirectory, supersedesProposalId = null }) {
  invariant(auditRecord?.publicationApproved === false, "Assessment audit must remain unpublished");
  invariant(["candidate", "human-review-required"].includes(auditRecord?.resolution?.state), "Assessment audit has no reviewable resolution");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.assessmentFingerprint), "Assessment audit has an invalid fingerprint");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.assessmentContentHash), "Assessment audit has an invalid content hash");
  invariant(/^[a-f0-9]{64}$/.test(auditRecord.packageHash), "Assessment audit has an invalid package hash");
  const promiseId = auditRecord.assessorA?.output?.promiseId;
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
    resolutionState: auditRecord.resolution.state,
    resolutionReason: auditRecord.resolution.reason,
    candidateStatus: auditRecord.resolution.status,
    confidence: auditRecord.resolution.state === "candidate"
      ? [auditRecord.assessorA.output.confidence, auditRecord.assessorB.output.confidence]
      : null,
    supersedesProposalId,
    supersededByProposalId: null,
    humanReviewRequired: true,
    publicationApproved: false,
    path: proposalDirectory.replaceAll("\\", "/"),
    humanReviewPath: `${proposalDirectory.replaceAll("\\", "/")}/review.md`
  };
}

const readerStatus = {
  fulfilled: { label: "Splněno", score: "+2" },
  "moving-towards": { label: "Směřuje ke splnění", score: "+1" },
  "no-progress": { label: "Bez podstatného posunu", score: "0" },
  "moving-against": { label: "Směřuje proti slibu", score: "−1" },
  "acting-against": { label: "Jedná proti slibu", score: "−2" }
};

function evidenceLabel(evidence) {
  if (evidence.role === "promise-source") return "Původní volební slib";
  if (evidence.type === "legislative-document") return "Úplné znění návrhu zákona na webu Poslanecké sněmovny";
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

export function renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal }) {
  validateEvidencePackage(evidencePackage);
  const reviews = [
    ["První posudek", auditRecord.assessorA.output],
    ["Druhý posudek", auditRecord.assessorB.output]
  ];
  const chosen = auditRecord.resolution.selectedReview === "assessor-b"
    ? auditRecord.assessorB.output
    : auditRecord.assessorA.output;
  const proposed = proposal.candidateStatus ? readerStatus[proposal.candidateStatus] : null;
  const hasPublicCandidate = proposal.resolutionState === "candidate";
  if (hasPublicCandidate && !proposed) {
    throw new Error(`Candidate review proposal ${proposal.proposalId} must use a supported candidateStatus.`);
  }
  const publicExplanation = hasPublicCandidate
    ? simplifyPublicExplanation(chosen.explanationCz)
    : null;
  const resolutionLabel = {
    "assessor-consensus": "oba automatické posudky se shodly",
    "arbiter-selection": "o neshodě automatických posudků rozhodl třetí hodnotitel",
    "insufficient-evidence": "oba automatické posudky označily podklady za nedostatečné",
    "arbiter-cannot-decide": "třetí hodnotitel nedokázal spor rozhodnout",
    "arbiter-selected-insufficient-evidence": "třetí hodnotitel vybral posudek s nedostatečnými podklady"
  }[proposal.resolutionReason] ?? proposal.resolutionReason;
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
  if (!auditRecord.arbiter) {
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
    lines.push("### Odlišné posudky", "");
    for (const [name, review] of reviews) {
      const status = readerStatus[review.status];
      lines.push(`#### ${name}: ${status.label} (${status.score})`, "", review.explanationCz, "");
      if (review.uncertainties.length > 0) {
        lines.push("Co zůstává nejisté:", "", ...review.uncertainties.map((item) => `- ${item}`), "");
      }
    }
    lines.push("### Rozhodnutí třetího hodnotitele", "", auditRecord.arbiter.output.explanationCz, "");
  }
  const citedIds = new Set([
    ...evidencePackage.evidence.filter(({ role }) => role === "promise-source").map(({ id }) => id),
    ...auditRecord.assessorA.output.citedEvidenceIds,
    ...auditRecord.assessorB.output.citedEvidenceIds,
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
