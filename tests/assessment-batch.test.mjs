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
      { id: "change", url: "https://example.test/change", factSummary: "Úřední text změny zákona.", locator: "ČÁST PRVNÍ", publishedAt: asOf, primary: true, role: "law-change", matchBasis: { routeBasis: ["controlled-tag"], matchedTagIds: ["fiscal-rules"], directLinkIdentifiers: [] } },
      { id: "conduct", url: "https://example.test/conduct", factSummary: "Ověřený krok.", locator: "záznam", publishedAt: asOf, primary: true, role: "conduct-evidence" }
    ]
  };
}

async function writePackage(directory, evidence) {
  await writeFile(join(directory, `${evidence.promise.id}-${evidence.asOf}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
}

async function runBatch(root, packagesDirectory, maxAssessments = "10", { failPromise = "", expectedExitCode = 0 } = {}) {
  const summary = join(root, "summary.json");
  const child = spawn(process.execPath, [batchScript,
    "--packages", packagesDirectory,
    "--runs", "automation/runs",
    "--summary", summary,
    "--pull-request-body", "automation/pull-request.md"
  ], {
    cwd: root,
    env: { ...process.env, SLIBY_ASSESSMENT_RUNNER: mockRunner, SLIBY_ASSESSMENT_CONCURRENCY: "1", SLIBY_MAX_ASSESSMENTS: maxAssessments, SLIBY_MOCK_FAIL_PROMISE: failPromise },
    stdio: "pipe"
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolveExit(code));
  });
  assert.equal(exitCode, expectedExitCode, stderr);
  return JSON.parse(await readFile(summary, "utf8"));
}

test("persists an isolated double-invalid failure, then retires it after a newer successful package", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-batch-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v16.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v7.md"), "arbiter test prompt\n");
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

test("the per-run cap sends no more packages to the paid assessors, and the rest stay pending", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-limit-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v16.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v7.md"), "arbiter test prompt\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  const packages = join(root, "packages");
  await mkdir(packages);
  for (const id of ["promise-a", "promise-b", "promise-c"]) await writePackage(packages, evidencePackage(id, "2026-09-10"));

  const none = await runBatch(root, packages, "0");
  assert.equal(none.newProposalCount, 0);
  assert.equal(none.deferredCount, 3);
  assert.ok(none.deferredPackageCharacters > 0);

  const one = await runBatch(root, packages, "1");
  assert.equal(one.newProposalCount, 1);
  assert.equal(one.deferredCount, 2);

  const rest = await runBatch(root, packages, "5");
  assert.equal(rest.newProposalCount, 2);
  assert.equal(rest.unchangedCount, 1);
  assert.equal(rest.deferredCount, 0);
});

test("an interrupted batch keeps every finished assessment, and the next run assesses only the rest", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-interrupted-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v16.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v7.md"), "arbiter test prompt\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  const packages = join(root, "packages");
  await mkdir(packages);
  for (const id of ["promise-a", "promise-b", "promise-c"]) await writePackage(packages, evidencePackage(id, "2026-09-10"));

  const interrupted = await runBatch(root, packages, "10", { failPromise: "promise-b", expectedExitCode: 1 });
  assert.equal(interrupted.newProposalCount, 1);
  assert.equal(interrupted.interruption.promiseId, "promise-b");
  assert.equal(interrupted.interruptedCount, 1);
  assert.equal(interrupted.notAssessedAfterInterruptionCount, 1);
  const manifest = JSON.parse(await readFile(join(root, "automation/review-proposals/manifest.json"), "utf8"));
  assert.deepEqual(manifest.proposals.map(({ promiseId }) => promiseId), ["promise-a"]);

  // An unfinished proposal write left by a killed run must not block resuming.
  const pending = interrupted.results.find(({ promiseId }) => promiseId === "promise-c");
  const leftover = join(root, "automation/review-proposals/promise-c", pending.assessmentFingerprint);
  await mkdir(leftover, { recursive: true });
  await writeFile(join(leftover, "evidence-package.json"), "{");
  const resumed = await runBatch(root, packages, "10");
  assert.equal(resumed.unchangedCount, 1);
  assert.equal(resumed.newProposalCount, 2);
});

test("an oversized package is never sent to the assessors and is reported for human review", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-oversized-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v16.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v7.md"), "arbiter test prompt\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  const packages = join(root, "packages");
  await mkdir(packages);
  const oversized = evidencePackage("oversized-promise", "2026-09-10");
  oversized.generation = { estimatedTokens: 300_000, oversized: true };
  await writePackage(packages, oversized);
  await writePackage(packages, evidencePackage("normal-promise", "2026-09-10"));

  const summary = await runBatch(root, packages, "10");
  assert.equal(summary.newProposalCount, 1);
  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.results.find(({ promiseId }) => promiseId === "oversized-promise").disposition, "blocked-oversized");
  assert.deepEqual(summary.relevanceVerdictsByRoute, [{ route: "tag:fiscal-rules", verdicts: 2, notRelevant: 0 }]);
});
