import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { currentEvidencePackageEntries, loadBlockedEvidencePackages, loadCurrentEvidencePackages, queueEvidencePackages, validateEvidencePackageQueue } from "../scripts/lib/evidence-package-queue.mjs";

function evidencePackage(asOf, factSummary) {
  return {
    schemaVersion: "1.0.0",
    methodologyVersion: "slava-v7",
    packageId: `test-promise--${asOf}`,
    asOf,
    assessmentContext: { mode: "live", ruleVersion: "period-timing-v2", maintenanceBaseline: null },
    promise: { id: "test-promise", originalTextCz: "Testovací slib.", fulfillmentTest: "Ověřitelný výsledek.", contradictionTest: "Ověřitelný rozpor." },
    evidence: [
      { id: "promise-source", url: "https://example.test/promise", factSummary: "Přesné znění slibu.", locator: "strana 1", publishedAt: "2025-01-01", primary: true, role: "promise-source" },
      { id: "conduct", url: "https://example.test/conduct", factSummary, locator: "záznam", publishedAt: asOf, primary: true, role: "conduct-evidence" }
    ]
  };
}

async function writeInput(directory, evidence) {
  await writeFile(join(directory, "test-promise.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}

test("keeps a current enriched package across assessment failures and preserves superseded versions", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-evidence-queue-"));
  const input = join(root, "input");
  const queue = join(root, "queue");
  await mkdir(input);
  await writeInput(input, evidencePackage("2026-09-10", "První ověřený krok."));
  const first = await queueEvidencePackages({ inputDirectory: input, queueDirectory: queue, enrichmentRun: { warnings: [] } });
  assert.deepEqual(first, { added: 1, updated: 0, activeCount: 1, changed: true });
  assert.equal((await loadCurrentEvidencePackages(queue))[0].blockedByEnrichment, false);

  await writeInput(input, evidencePackage("2026-09-11", "Novější ověřený krok."));
  const second = await queueEvidencePackages({ inputDirectory: input, queueDirectory: queue, enrichmentRun: { warnings: [{ promiseId: "test-promise" }] } });
  assert.deepEqual(second, { added: 1, updated: 0, activeCount: 1, changed: true });
  const manifest = validateEvidencePackageQueue(JSON.parse(await readFile(join(queue, "manifest.json"), "utf8")));
  assert.equal(manifest.packages.length, 2);
  assert.equal(currentEvidencePackageEntries(manifest).length, 1);
  const current = await loadCurrentEvidencePackages(queue);
  assert.equal(current[0].evidencePackage.asOf, "2026-09-11");
  assert.equal(current[0].blockedByEnrichment, true);
  assert.equal((await loadBlockedEvidencePackages(queue))[0].evidencePackage.asOf, "2026-09-11");
});

test("rejects a queue whose supersession cycle has no current package", () => {
  const firstHash = "a".repeat(64);
  const secondHash = "b".repeat(64);
  assert.throws(() => validateEvidencePackageQueue({
    schemaVersion: "1.0.0",
    publicationApproved: false,
    packages: [
      { promiseId: "test-promise", packageHash: firstHash, asOf: "2026-09-10", queuedAt: "2026-09-10T00:00:00.000Z", path: `packages/test-promise/${firstHash}.json`, blockedByEnrichment: false, supersedesPackageHash: secondHash, supersededByPackageHash: secondHash },
      { promiseId: "test-promise", packageHash: secondHash, asOf: "2026-09-11", queuedAt: "2026-09-11T00:00:00.000Z", path: `packages/test-promise/${secondHash}.json`, blockedByEnrichment: false, supersedesPackageHash: firstHash, supersededByPackageHash: firstHash }
    ]
  }), /must have exactly one current version/);
});
