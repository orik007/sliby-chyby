import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashEvidencePackage, validateEvidencePackage } from "./assessment-pipeline.mjs";

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
    invariant(typeof entry.blockedByEnrichment === "boolean", `Queued evidence package ${entry.promiseId} must record enrichment state`);
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
  return queue.packages.filter((entry) => !entry.supersededByPackageHash).sort((left, right) => left.promiseId.localeCompare(right.promiseId));
}

async function loadQueue(queueDirectory) {
  const manifestPath = resolve(queueDirectory, "manifest.json");
  if (!existsSync(manifestPath)) return emptyEvidencePackageQueue();
  return validateEvidencePackageQueue(JSON.parse(await readFile(manifestPath, "utf8")));
}

async function inputPackages(inputDirectory) {
  const entries = await readdir(resolve(inputDirectory), { withFileTypes: true });
  const packages = [];
  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json") && item.name !== "enrichment-run.json").sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(inputDirectory, entry.name);
    packages.push({ path, evidencePackage: validateEvidencePackage(JSON.parse(await readFile(path, "utf8"))) });
  }
  return packages;
}

export async function queueEvidencePackages({ inputDirectory, queueDirectory, enrichmentRun }) {
  invariant(Array.isArray(enrichmentRun?.warnings), "Invalid enrichment run warnings");
  const queuePath = resolve(queueDirectory);
  const queue = await loadQueue(queuePath);
  const blockedPromiseIds = new Set(enrichmentRun.warnings.map(({ promiseId }) => promiseId));
  const now = new Date().toISOString();
  let changed = false;
  let added = 0;
  let updated = 0;
  for (const { evidencePackage } of await inputPackages(inputDirectory)) {
    const packageHash = hashEvidencePackage(evidencePackage);
    const blockedByEnrichment = blockedPromiseIds.has(evidencePackage.promise.id);
    const matching = queue.packages.find((entry) => entry.packageHash === packageHash);
    if (matching) {
      if (matching.blockedByEnrichment !== blockedByEnrichment) {
        matching.blockedByEnrichment = blockedByEnrichment;
        changed = true;
        updated += 1;
      }
      continue;
    }
    const current = currentEvidencePackageEntries(queue).find((entry) => entry.promiseId === evidencePackage.promise.id);
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
      blockedByEnrichment,
      supersedesPackageHash: current?.packageHash ?? null,
      supersededByPackageHash: null
    });
    changed = true;
    added += 1;
  }
  if (changed) {
    queue.packages.sort((left, right) => left.promiseId.localeCompare(right.promiseId) || left.queuedAt.localeCompare(right.queuedAt));
    await mkdir(queuePath, { recursive: true });
    await writeFile(resolve(queuePath, "manifest.json"), `${JSON.stringify(validateEvidencePackageQueue(queue), null, 2)}\n`);
  }
  return { added, updated, activeCount: currentEvidencePackageEntries(queue).length, changed };
}

export async function loadCurrentEvidencePackages(queueDirectory) {
  const queuePath = resolve(queueDirectory);
  const manifestPath = resolve(queuePath, "manifest.json");
  if (!existsSync(manifestPath)) {
    return (await inputPackages(queuePath)).map(({ path, evidencePackage }) => ({ path, evidencePackage, blockedByEnrichment: false }));
  }
  const queue = await loadQueue(queuePath);
  const packages = [];
  for (const entry of currentEvidencePackageEntries(queue)) {
    const path = resolve(queuePath, entry.path);
    const evidencePackage = validateEvidencePackage(JSON.parse(await readFile(path, "utf8")));
    invariant(evidencePackage.promise.id === entry.promiseId, `Queued package ${entry.packageHash} has an unexpected promise ID`);
    invariant(hashEvidencePackage(evidencePackage) === entry.packageHash, `Queued package ${entry.packageHash} has changed`);
    packages.push({ path, evidencePackage, blockedByEnrichment: entry.blockedByEnrichment });
  }
  return packages;
}

export async function loadBlockedEvidencePackages(queueDirectory) {
  return (await loadCurrentEvidencePackages(queueDirectory)).filter(({ blockedByEnrichment }) => blockedByEnrichment);
}
