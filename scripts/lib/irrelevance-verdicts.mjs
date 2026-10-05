import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Law changes both assessors found not relevant to a promise are left out of
 * its later packages (docs/evidence-pipeline.md, Package). A verdict applies
 * only while what it judged is unchanged: the law change's versions with
 * their text and context, the promise's title and wording, and the assessor
 * prompt with the scoring rule. Any change to these brings the law change
 * back, to be judged again. A new vote on the same text does not: relevance
 * depends on what the law change says, not on how the party voted.
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

/** What a verdict judged, as one hash. `assessorPrompt` is `{ version, contentHash }`. */
export function irrelevanceKey({ promise, versions, assessorPrompt }) {
  invariant(assessorPrompt?.version && /^[a-f0-9]{64}$/.test(assessorPrompt.contentHash ?? ""), "irrelevanceKey needs the assessor prompt identity");
  return createHash("sha256").update(canonicalize({
    keyVersion: "irrelevance-key-v1",
    promise: { titleCz: promise.titleCz, originalTextCz: promise.originalTextCz },
    versions,
    assessor: { version: assessorPrompt.version, contentHash: assessorPrompt.contentHash }
  })).digest("hex");
}

/**
 * The relevance verdicts of one assessment, per law change in its package:
 * `{ evidenceId, key, irrelevant, entry }`, `irrelevant` only when both
 * assessor outputs are valid and both say not relevant, and `entry` the line
 * a later package shows for a change left out. A law change whose context
 * was trimmed in that package (`generation.contextOmissions`) was not judged
 * on its whole text and context, so it gives no verdict.
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
      key: irrelevanceKey({ promise: evidencePackage.promise, versions: change.structuredFacts.versions, assessorPrompt }),
      irrelevant,
      entry: irrelevant ? { evidenceId: change.id, title: change.title, proposalId, reasonsCz: [verdictA.reasonCz, verdictB.reasonCz] } : null
    };
  });
}

/**
 * Every promise's latest relevance verdict per law change and key, from the
 * proposals in the review manifest (their archived package and assessment
 * record): `Map(promiseId -> Map(evidenceId -> Map(key -> verdict)))`, the
 * verdict of the most recently evaluated proposal that judged that change
 * with that key. Only the latest counts, so a change one assessor later found
 * relevant is never left out on an older verdict.
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
    for (const verdict of relevanceVerdictsOf({ evidencePackage, auditRecord, proposalId: proposal.proposalId })) {
      const byKey = byChange.get(verdict.evidenceId) ?? new Map();
      byKey.set(verdict.key, verdict);
      byChange.set(verdict.evidenceId, byKey);
    }
    verdicts.set(proposal.promiseId, byChange);
  }
  return verdicts;
}

/**
 * The line for a law change that is left out of this package, or null: the
 * law change's latest verdict with the key of its current text and context,
 * this promise, and the current assessor prompt says both assessors found it
 * not relevant.
 */
export function exclusionOf({ verdicts, promise, lawChange, assessorPrompt }) {
  const byKey = verdicts?.get(promise.id)?.get(lawChange.id);
  if (!byKey) return null;
  const verdict = byKey.get(irrelevanceKey({ promise, versions: lawChange.structuredFacts.versions, assessorPrompt }));
  return verdict?.irrelevant ? verdict.entry : null;
}

/**
 * The package an assessment's own verdicts would leave: without the law
 * changes both of its assessors found not relevant, their concerns, conduct
 * that concerns none of the remaining changes, and Senate resolutions no
 * remaining change names, and with a line for each change left out. A
 * package rebuilt without them is the same as this one, so it keeps the
 * assessment (docs/evidence-pipeline.md, Assess).
 */
export function withoutIrrelevantLawChanges(evidencePackage, entries) {
  if (entries.length === 0) return evidencePackage;
  const left = new Set(entries.map(({ evidenceId }) => evidenceId));
  const lawChanges = evidencePackage.evidence.filter(({ role, id }) => role === "law-change" && !left.has(id));
  const resolutionIds = new Set(lawChanges.flatMap(({ structuredFacts }) => structuredFacts.senateResolutionEvidenceIds ?? []));
  const evidence = evidencePackage.evidence.flatMap((item) => {
    if (item.role === "law-change") return left.has(item.id) ? [] : [item];
    if (item.role === "senate-resolution") return resolutionIds.has(item.id) ? [item] : [];
    if (item.role === "conduct-evidence") {
      const concerns = item.structuredFacts.concernsLawChanges.filter(({ evidenceId }) => !left.has(evidenceId));
      return concerns.length > 0 ? [{ ...item, structuredFacts: { ...item.structuredFacts, concernsLawChanges: concerns } }] : [];
    }
    return [item];
  });
  const excludedLawChanges = [...(evidencePackage.excludedLawChanges ?? []), ...entries].sort((leftEntry, rightEntry) => leftEntry.evidenceId.localeCompare(rightEntry.evidenceId, "en", { numeric: true }));
  return { ...evidencePackage, excludedLawChanges, evidence };
}
