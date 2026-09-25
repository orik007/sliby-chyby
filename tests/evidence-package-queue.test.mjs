import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { currentEvidencePackageEntries, loadCurrentEvidencePackages, queueEvidencePackages, validateEvidencePackageQueue } from "../scripts/lib/evidence-package-queue.mjs";

function evidencePackage(asOf, factSummary, { oversized = false } = {}) {
  return {
    schemaVersion: "1.0.0",
    methodologyVersion: "slava-v7",
    packageId: `test-promise--${asOf}`,
    asOf,
    assessmentContext: { mode: "live", ruleVersion: "period-timing-v2", maintenanceBaseline: null },
    promise: { id: "test-promise", originalTextCz: "Testovací slib.", fulfillmentTest: "Ověřitelný výsledek.", contradictionTest: "Ověřitelný rozpor." },
    evidence: [
      { id: "promise-source", url: "https://example.test/promise", factSummary: "Přesné znění slibu.", locator: "strana 1", publishedAt: "2025-01-01", primary: true, role: "promise-source" },
      { id: "change", url: "https://example.test/change", factSummary: "Úřední text změny zákona.", locator: "ČÁST PRVNÍ", publishedAt: asOf, primary: true, role: "law-change" },
      { id: "conduct", url: "https://example.test/conduct", factSummary, locator: "záznam", publishedAt: asOf, primary: true, role: "conduct-evidence" }
    ],
    generation: { estimatedTokens: oversized ? 300_000 : 1_000, oversized }
  };
}

async function writeInput(directory, evidence) {
  await writeFile(join(directory, "test-promise.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}

test("keeps a current package, blocks an oversized one, and preserves superseded versions", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-evidence-queue-"));
  const input = join(root, "input");
  const queue = join(root, "queue");
  await mkdir(input);
  await writeInput(input, evidencePackage("2026-09-10", "První ověřený krok."));
  const first = await queueEvidencePackages({ inputDirectory: input, queueDirectory: queue });
  assert.deepEqual(first, { added: 1, updated: 0, withdrawn: 0, activeCount: 1, changed: true });
  assert.equal((await loadCurrentEvidencePackages(queue))[0].blockedReason, null);

  await writeInput(input, evidencePackage("2026-09-11", "Novější ověřený krok.", { oversized: true }));
  const second = await queueEvidencePackages({ inputDirectory: input, queueDirectory: queue });
  assert.deepEqual(second, { added: 1, updated: 0, withdrawn: 0, activeCount: 1, changed: true });
  const manifest = validateEvidencePackageQueue(JSON.parse(await readFile(join(queue, "manifest.json"), "utf8")));
  assert.equal(manifest.packages.length, 2);
  assert.equal(currentEvidencePackageEntries(manifest).length, 1);
  const current = await loadCurrentEvidencePackages(queue);
  assert.equal(current[0].evidencePackage.asOf, "2026-09-11");
  assert.equal(current[0].blockedReason, "oversized");
});

test("rejects a queue whose supersession cycle has no current package", () => {
  const firstHash = "a".repeat(64);
  const secondHash = "b".repeat(64);
  assert.throws(() => validateEvidencePackageQueue({
    schemaVersion: "1.0.0",
    publicationApproved: false,
    packages: [
      { promiseId: "test-promise", packageHash: firstHash, asOf: "2026-09-10", queuedAt: "2026-09-10T00:00:00.000Z", path: `packages/test-promise/${firstHash}.json`, blockedReason: null, supersedesPackageHash: secondHash, supersededByPackageHash: secondHash },
      { promiseId: "test-promise", packageHash: secondHash, asOf: "2026-09-11", queuedAt: "2026-09-11T00:00:00.000Z", path: `packages/test-promise/${secondHash}.json`, blockedReason: null, supersedesPackageHash: firstHash, supersededByPackageHash: firstHash }
    ]
  }), /must have exactly one current version/);
});


test("a daily rebuild with unchanged assessable content keeps the current package", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-evidence-queue-unchanged-"));
  const input = join(root, "input");
  const queue = join(root, "queue");
  await mkdir(input);
  const first = evidencePackage("2026-09-10", "Ověřený krok.");
  await writeInput(input, first);
  await queueEvidencePackages({ inputDirectory: input, queueDirectory: queue });

  // Next day: same evidence, only the run's cutoff and package ID differ.
  await writeInput(input, { ...structuredClone(first), asOf: "2026-09-11", packageId: "test-promise--2026-09-11" });
  const second = await queueEvidencePackages({ inputDirectory: input, queueDirectory: queue });
  assert.deepEqual(second, { added: 0, updated: 0, withdrawn: 0, activeCount: 1, changed: false });
  assert.equal((await loadCurrentEvidencePackages(queue))[0].evidencePackage.asOf, "2026-09-10");
});

test("a promise that no longer gets a package has no current package, and returns when it gets one again", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-evidence-queue-withdrawn-"));
  const input = join(root, "input");
  const empty = join(root, "empty");
  const queue = join(root, "queue");
  await mkdir(input);
  await mkdir(empty);
  const first = evidencePackage("2026-09-10", "Ověřený krok.");
  await writeInput(input, first);
  await queueEvidencePackages({ inputDirectory: input, queueDirectory: queue });

  const withdrawn = await queueEvidencePackages({ inputDirectory: empty, queueDirectory: queue });
  assert.deepEqual(withdrawn, { added: 0, updated: 0, withdrawn: 1, activeCount: 0, changed: true });
  assert.deepEqual(await loadCurrentEvidencePackages(queue), []);

  await writeInput(input, { ...structuredClone(first), asOf: "2026-09-12", packageId: "test-promise--2026-09-12" });
  const restored = await queueEvidencePackages({ inputDirectory: input, queueDirectory: queue });
  assert.deepEqual(restored, { added: 0, updated: 1, withdrawn: 0, activeCount: 1, changed: true });
});
