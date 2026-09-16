import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const batchScript = resolve(repositoryRoot, "scripts/run-assessment-batch.mjs");
const mockRunner = resolve(repositoryRoot, "tests/fixtures/mock-assessment-runner.mjs");

function evidencePackage(promiseId, asOf) {
  return {
    schemaVersion: "1.0.0",
    methodologyVersion: "slava-v7",
    packageId: `${promiseId}--${asOf}`,
    asOf,
    assessmentContext: { mode: "live", ruleVersion: "period-timing-v2", maintenanceBaseline: null },
    promise: {
      id: promiseId,
      titleCz: `Testovací slib ${promiseId}`,
      originalTextCz: "Testovací slib.",
      fulfillmentTest: "Ověřitelný výsledek.",
      contradictionTest: "Ověřitelný rozpor."
    },
    evidence: [
      { id: "promise-source", url: "https://example.test/promise", factSummary: "Přesné znění slibu.", locator: "strana 1", publishedAt: "2025-01-01", primary: true, role: "promise-source" },
      { id: "conduct", url: "https://example.test/conduct", factSummary: "Ověřený krok.", locator: "záznam", publishedAt: asOf, primary: true, role: "conduct-evidence" }
    ]
  };
}

async function writePackage(directory, evidence) {
  await writeFile(join(directory, `${evidence.promise.id}-${evidence.asOf}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
}

async function runBatch(root, packagesDirectory) {
  const enrichmentRun = join(root, "enrichment-run.json");
  const summary = join(root, "summary.json");
  await writeFile(enrichmentRun, `${JSON.stringify({ warnings: [] })}\n`);
  const child = spawn(process.execPath, [batchScript,
    "--packages", packagesDirectory,
    "--enrichment-run", enrichmentRun,
    "--runs", "automation/runs",
    "--summary", summary,
    "--pull-request-body", "automation/pull-request.md"
  ], {
    cwd: root,
    env: { ...process.env, SLIBY_ASSESSMENT_RUNNER: mockRunner, SLIBY_ASSESSMENT_CONCURRENCY: "1" },
    stdio: "pipe"
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolveExit(code));
  });
  assert.equal(exitCode, 0, stderr);
  return JSON.parse(await readFile(summary, "utf8"));
}

test("persists an isolated double-invalid failure, then retires it after a newer successful package", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-batch-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v13.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v5.md"), "arbiter test prompt\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);

  const firstPackages = join(root, "first-packages");
  await mkdir(firstPackages);
  await writePackage(firstPackages, evidencePackage("failed-promise", "2026-09-10"));
  await writePackage(firstPackages, evidencePackage("successful-peer", "2026-09-10"));
  const first = await runBatch(root, firstPackages);
  assert.equal(first.failedCount, 1);
  assert.equal(first.newProposalCount, 1);
  const failureDirectory = join(root, "automation/review-proposals/failures/failed-promise");
  const [failureFingerprint] = await readdir(failureDirectory);
  assert.ok(await readFile(join(failureDirectory, failureFingerprint, "assessment-run.json"), "utf8"));

  const retryPackages = join(root, "retry-packages");
  await mkdir(retryPackages);
  const retry = await runBatch(root, retryPackages);
  assert.equal(retry.packageCount, 1);
  assert.equal(retry.failedCount, 1);

  const newerPackages = join(root, "newer-packages");
  await mkdir(newerPackages);
  await writePackage(newerPackages, evidencePackage("failed-promise", "2026-09-11"));
  const second = await runBatch(root, newerPackages);
  assert.equal(second.failedCount, 0);
  assert.equal(second.newProposalCount, 1);
  const retirement = JSON.parse(await readFile(join(failureDirectory, failureFingerprint, "retired.json"), "utf8"));
  assert.equal(retirement.reason, "replaced-by-successful-assessment");

  const emptyPackages = join(root, "empty-packages");
  await mkdir(emptyPackages);
  const third = await runBatch(root, emptyPackages);
  assert.equal(third.packageCount, 0);
  assert.equal(third.failedCount, 0);
});
