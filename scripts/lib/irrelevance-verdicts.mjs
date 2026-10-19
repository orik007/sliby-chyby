import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * The assessors' relevance verdicts and the law changes they leave out of a
 * package. The rule is in docs/evidence-pipeline.md (Package, Assess).
 */

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * The key of a verdict (`irrelevance-key-v1`). `assessorPrompt` is `{
 * version, contentHash }`; `amendments`, the hashes of the texts of the
 * amendments that concern the change, is part of the key only when there are
 * any, so the key of a change without amendments is unchanged.
 */
export function irrelevanceKey({ promise, versions, amendments = [], assessorPrompt }) {
  invariant(assessorPrompt?.version && /^[a-f0-9]{64}$/.test(assessorPrompt.contentHash ?? ""), "irrelevanceKey needs the assessor prompt identity");
  return createHash("sha256").update(canonicalize({
    keyVersion: "irrelevance-key-v1",
    promise: { titleCz: promise.titleCz, originalTextCz: promise.originalTextCz },
    versions,
    ...(amendments.length > 0 ? { amendments } : {}),
    assessor: { version: assessorPrompt.version, contentHash: assessorPrompt.contentHash }
  })).digest("hex");
}

/**
 * The relevance verdicts of one assessment, per law change in its package
 * except one with trimmed context: `{ evidenceId, key, irrelevant, entry }`,
 * `entry` the line a later package shows when the change is left out.
 */
export function relevanceVerdictsOf({ evidencePackage, auditRecord, proposalId }) {
  const reviewA = auditRecord?.validatedAssessments?.["assessor-a"] ?? null;
  const reviewB = auditRecord?.validatedAssessments?.["assessor-b"] ?? null;
  const trimmed = new Set((evidencePackage.generation?.contextOmissions ?? []).map(({ evidenceId }) => evidenceId));
  const assessorPrompt = auditRecord?.prompts?.assessor;
  if (!assessorPrompt) return [];
  return evidencePackage.evidence.filter(({ role, id }) => role === "law-change" && !trimmed.has(id)).map((change) => {
    const verdictA = reviewA?.changeRelevance?.find(({ evidenceId }) => evidenceId === change.id) ?? null;
    const verdictB = reviewB?.changeRelevance?.find(({ evidenceId }) => evidenceId === change.id) ?? null;
    const irrelevant = verdictA?.relevant === false && verdictB?.relevant === false;
    return {
      evidenceId: change.id,
      key: irrelevanceKey({ promise: evidencePackage.promise, versions: change.structuredFacts.versions, amendments: change.structuredFacts.amendments ?? [], assessorPrompt }),
      irrelevant,
      entry: irrelevant ? { evidenceId: change.id, title: change.title, proposalId, reasonsCz: [verdictA.reasonCz, verdictB.reasonCz] } : null
    };
  });
}

/**
 * Every promise's latest relevance verdict per law change, from the proposals
 * in the review manifest (their archived package and assessment record):
 * `Map(promiseId -> Map(evidenceId -> verdict))`, by the most recently
 * evaluated proposal that judged the change.
 */
export async function loadRelevanceVerdicts(manifest) {
  const verdicts = new Map();
  const proposals = [...(manifest?.proposals ?? [])].sort((left, right) => left.evaluatedAt.localeCompare(right.evaluatedAt) || left.proposalId.localeCompare(right.proposalId));
  for (const proposal of proposals) {
    const packagePath = resolve(proposal.path, "evidence-package.json");
    const auditPath = resolve(proposal.path, "assessment-run.json");
    if (!existsSync(packagePath) || !existsSync(auditPath)) continue;
    const evidencePackage = JSON.parse(await readFile(packagePath, "utf8"));
    const auditRecord = JSON.parse(await readFile(auditPath, "utf8"));
    const byChange = verdicts.get(proposal.promiseId) ?? new Map();
    for (const verdict of relevanceVerdictsOf({ evidencePackage, auditRecord, proposalId: proposal.proposalId })) byChange.set(verdict.evidenceId, verdict);
    verdicts.set(proposal.promiseId, byChange);
  }
  return verdicts;
}

/** The line for a law change left out of this package, or null. */
export function exclusionOf({ verdicts, promise, lawChange, assessorPrompt }) {
  const verdict = verdicts?.get(promise.id)?.get(lawChange.id);
  if (!verdict?.irrelevant) return null;
  return verdict.key === irrelevanceKey({ promise, versions: lawChange.structuredFacts.versions, amendments: lawChange.structuredFacts.amendments ?? [], assessorPrompt }) ? verdict.entry : null;
}

/**
 * The package an assessment's own verdicts leave: without the given law
 * changes, their concerns, conduct left with no concern, Senate resolutions
 * no remaining change names, and amendment texts no remaining conduct names,
 * and with a line for each change left out, as the package builder makes it.
 */
export function withoutIrrelevantLawChanges(evidencePackage, entries) {
  if (entries.length === 0) return evidencePackage;
  const left = new Set(entries.map(({ evidenceId }) => evidenceId));
  const lawChanges = evidencePackage.evidence.filter(({ role, id }) => role === "law-change" && !left.has(id));
  const resolutionIds = new Set(lawChanges.flatMap(({ structuredFacts }) => structuredFacts.senateResolutionEvidenceIds ?? []));
  const kept = evidencePackage.evidence.flatMap((item) => {
    if (item.role === "law-change") return left.has(item.id) ? [] : [item];
    if (item.role === "senate-resolution") return resolutionIds.has(item.id) ? [item] : [];
    if (item.role === "conduct-evidence") {
      const concerns = item.structuredFacts.concernsLawChanges.filter(({ evidenceId }) => !left.has(evidenceId));
      return concerns.length > 0 ? [{ ...item, structuredFacts: { ...item.structuredFacts, concernsLawChanges: concerns } }] : [];
    }
    return [item];
  });
  const amendmentIds = new Set(kept.filter(({ role }) => role === "conduct-evidence").flatMap(({ structuredFacts }) => structuredFacts.amendmentEvidenceIds ?? []));
  const evidence = kept.filter((item) => item.role !== "amendment" || amendmentIds.has(item.id));
  const excludedLawChanges = [...(evidencePackage.excludedLawChanges ?? []), ...entries].sort((leftEntry, rightEntry) => leftEntry.evidenceId.localeCompare(rightEntry.evidenceId, "en", { numeric: true }));
  return { ...evidencePackage, excludedLawChanges, evidence };
}
