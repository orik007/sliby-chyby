import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashAssessmentContent, hashEvidencePackage, validateEvidencePackage } from "./assessment-pipeline.mjs";

const schemaVersion = "1.0.0";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function emptyEvidencePackageQueue() {
  return { schemaVersion, publicationApproved: false, packages: [] };
}

export function validateEvidencePackageQueue(queue) {
  invariant(queue && typeof queue === "object", "Evidence package queue must be an object");
  invariant(queue.schemaVersion === schemaVersion, "Unsupported evidence package queue schemaVersion");
  invariant(queue.publicationApproved === false, "Evidence package queue must remain unpublished");
  invariant(Array.isArray(queue.packages), "Evidence package queue packages must be an array");
  const packageHashes = new Set();
  for (const entry of queue.packages) {
    invariant(typeof entry.promiseId === "string" && entry.promiseId.length > 0, "Queued evidence package is missing promiseId");
    invariant(/^[a-f0-9]{64}$/.test(entry.packageHash), `Queued evidence package ${entry.promiseId} has an invalid packageHash`);
    invariant(!packageHashes.has(entry.packageHash), `Duplicate queued evidence package hash: ${entry.packageHash}`);
    packageHashes.add(entry.packageHash);
    invariant(/^\d{4}-\d{2}-\d{2}$/.test(entry.asOf), `Queued evidence package ${entry.promiseId} has an invalid asOf`);
    invariant(typeof entry.queuedAt === "string" && !Number.isNaN(Date.parse(entry.queuedAt)), `Queued evidence package ${entry.promiseId} has an invalid queuedAt`);
    invariant(typeof entry.path === "string" && entry.path.startsWith("packages/"), `Queued evidence package ${entry.promiseId} has an invalid path`);
    invariant(entry.blockedReason === null || entry.blockedReason === "oversized", `Queued evidence package ${entry.promiseId} has an invalid blockedReason`);
    invariant(entry.withdrawnAt == null || !Number.isNaN(Date.parse(entry.withdrawnAt)), `Queued evidence package ${entry.promiseId} has an invalid withdrawnAt`);
    invariant(entry.supersedesPackageHash == null || /^[a-f0-9]{64}$/.test(entry.supersedesPackageHash), `Queued evidence package ${entry.promiseId} has an invalid supersedesPackageHash`);
    invariant(entry.supersededByPackageHash == null || /^[a-f0-9]{64}$/.test(entry.supersededByPackageHash), `Queued evidence package ${entry.promiseId} has an invalid supersededByPackageHash`);
  }
  const byHash = new Map(queue.packages.map((entry) => [entry.packageHash, entry]));
  for (const entry of queue.packages) {
    if (entry.supersedesPackageHash) {
      const previous = byHash.get(entry.supersedesPackageHash);
      invariant(previous?.promiseId === entry.promiseId && previous.supersededByPackageHash === entry.packageHash, `Queued evidence package ${entry.packageHash} has an incomplete supersession link`);
    }
    if (entry.supersededByPackageHash) {
      const replacement = byHash.get(entry.supersededByPackageHash);
      invariant(replacement?.promiseId === entry.promiseId && replacement.supersedesPackageHash === entry.packageHash, `Queued evidence package ${entry.packageHash} has an invalid replacement link`);
    }
  }
  for (const promiseId of new Set(queue.packages.map((entry) => entry.promiseId))) {
    invariant(queue.packages.filter((entry) => entry.promiseId === promiseId && !entry.supersededByPackageHash).length === 1, `Queued evidence package ${promiseId} must have exactly one current version`);
  }
  return queue;
}

export function currentEvidencePackageEntries(queue) {
  validateEvidencePackageQueue(queue);
  return queue.packages.filter((entry) => !entry.supersededByPackageHash && entry.withdrawnAt == null).sort((left, right) => left.promiseId.localeCompare(right.promiseId));
}

function latestUnreplacedPackageEntry(queue, promiseId) {
  return queue.packages.find((entry) => entry.promiseId === promiseId && !entry.supersededByPackageHash) ?? null;
}

async function loadQueue(queueDirectory) {
  const manifestPath = resolve(queueDirectory, "manifest.json");
  if (!existsSync(manifestPath)) return emptyEvidencePackageQueue();
  return validateEvidencePackageQueue(JSON.parse(await readFile(manifestPath, "utf8")));
}

async function inputPackages(inputDirectory) {
  const entries = await readdir(resolve(inputDirectory), { withFileTypes: true });
  const packages = [];
  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(inputDirectory, entry.name);
    packages.push({ path, evidencePackage: validateEvidencePackage(JSON.parse(await readFile(path, "utf8"))) });
  }
  return packages;
}

export async function queueEvidencePackages({ inputDirectory, queueDirectory }) {
  const queuePath = resolve(queueDirectory);
  const queue = await loadQueue(queuePath);
  const now = new Date().toISOString();
  let changed = false;
  let added = 0;
  let updated = 0;
  const input = await inputPackages(inputDirectory);
  const inputPromiseIds = new Set(input.map(({ evidencePackage }) => evidencePackage.promise.id));
  for (const { evidencePackage } of input) {
    const packageHash = hashEvidencePackage(evidencePackage);
    // A package too large to assess at the normal price is kept for human
    // review and never trimmed (docs/evidence-pipeline.md, Package).
    const blockedReason = evidencePackage.generation?.oversized ? "oversized" : null;
    const current = latestUnreplacedPackageEntry(queue, evidencePackage.promise.id);
    // Every run rebuilds each package from the whole record history; a
    // package whose assessable content is unchanged keeps the current entry.
    const unchanged = current
      && hashAssessmentContent(JSON.parse(await readFile(resolve(queuePath, current.path), "utf8"))) === hashAssessmentContent(evidencePackage);
    const existing = unchanged ? current : queue.packages.find((entry) => entry.packageHash === packageHash);
    if (existing) {
      if (existing.withdrawnAt != null) {
        existing.withdrawnAt = null;
        changed = true;
        updated += 1;
      }
      if (existing.blockedReason !== blockedReason) {
        existing.blockedReason = blockedReason;
        changed = true;
        updated += 1;
      }
      continue;
    }
    if (current) current.supersededByPackageHash = packageHash;
    const packagePath = `packages/${evidencePackage.promise.id}/${packageHash}.json`;
    const destination = resolve(queuePath, packagePath);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await writeFile(destination, `${JSON.stringify(evidencePackage, null, 2)}\n`, { flag: "wx" });
    queue.packages.push({
      promiseId: evidencePackage.promise.id,
      packageHash,
      asOf: evidencePackage.asOf,
      queuedAt: now,
      path: packagePath,
      blockedReason,
      withdrawnAt: null,
      supersedesPackageHash: current?.packageHash ?? null,
      supersededByPackageHash: null
    });
    changed = true;
    added += 1;
  }
  // Every run builds the complete package set, so a promise that no longer
  // gets a package has no current package to assess.
  let withdrawn = 0;
  for (const entry of currentEvidencePackageEntries(queue)) {
    if (inputPromiseIds.has(entry.promiseId)) continue;
    entry.withdrawnAt = now;
    changed = true;
    withdrawn += 1;
  }
  if (changed) {
    queue.packages.sort((left, right) => left.promiseId.localeCompare(right.promiseId) || left.queuedAt.localeCompare(right.queuedAt));
    await mkdir(queuePath, { recursive: true });
    await writeFile(resolve(queuePath, "manifest.json"), `${JSON.stringify(validateEvidencePackageQueue(queue), null, 2)}\n`);
  }
  return { added, updated, withdrawn, activeCount: currentEvidencePackageEntries(queue).length, changed };
}

export async function loadCurrentEvidencePackages(queueDirectory) {
  const queuePath = resolve(queueDirectory);
  const manifestPath = resolve(queuePath, "manifest.json");
  if (!existsSync(manifestPath)) {
    return (await inputPackages(queuePath)).map(({ path, evidencePackage }) => ({ path, evidencePackage, blockedReason: evidencePackage.generation?.oversized ? "oversized" : null }));
  }
  const queue = await loadQueue(queuePath);
  const packages = [];
  for (const entry of currentEvidencePackageEntries(queue)) {
    const path = resolve(queuePath, entry.path);
    const evidencePackage = validateEvidencePackage(JSON.parse(await readFile(path, "utf8")));
    invariant(evidencePackage.promise.id === entry.promiseId, `Queued package ${entry.packageHash} has an unexpected promise ID`);
    invariant(hashEvidencePackage(evidencePackage) === entry.packageHash, `Queued package ${entry.packageHash} has changed`);
    packages.push({ path, evidencePackage, blockedReason: entry.blockedReason });
  }
  return packages;
}
