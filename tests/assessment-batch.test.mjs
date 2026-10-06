import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { continuationMarker, renderReviewPullRequest } from "../scripts/lib/assessment-review.mjs";

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
      originalTextCz: "Testovací slib."
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

async function writePublicRevisions(root, statuses, { revision = 1, publishedAt = "2026-09-07" } = {}) {
  const directory = join(root, "data/assessment-revisions");
  await mkdir(directory, { recursive: true });
  for (const [promiseId, status] of Object.entries(statuses)) {
    const id = `${promiseId}--${String(revision).padStart(3, "0")}`;
    await writeFile(join(directory, `${id}.json`), `${JSON.stringify({ id, promiseId, revision, status, explanationShort: "Stav.", publishedAt, evidenceSourceIds: ["source"], isDemo: false }, null, 2)}\n`);
  }
}

async function runBatch(root, packagesDirectory, maxAssessments = "10", { failPromise = "", humanReviewPromise = "", expectedExitCode = 0, environment = {} } = {}) {
  const summary = join(root, "summary.json");
  const child = spawn(process.execPath, [batchScript,
    "--packages", packagesDirectory,
    "--runs", "automation/runs",
    "--summary", summary,
    "--pull-request-body", "automation/pull-request.md"
  ], {
    cwd: root,
    // Only the listed settings reach the batch: the workflow's own
    // environment (review branch, models, API key) must not change a test.
    env: { PATH: process.env.PATH, SLIBY_ASSESSMENT_RUNNER: mockRunner, SLIBY_ASSESSMENT_CONCURRENCY: "1", SLIBY_MAX_ASSESSMENTS: maxAssessments, SLIBY_MOCK_FAIL_PROMISE: failPromise, SLIBY_MOCK_HUMAN_REVIEW_PROMISE: humanReviewPromise, ...environment },
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
  await writeFile(join(root, "automation/prompts/assessor-v21.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v14.md"), "arbiter test prompt\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/scoring.md"), "scoring test rule\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  await writePublicRevisions(root, { "failed-promise": "no-progress", "successful-peer": "no-progress" });

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
  await writeFile(join(root, "automation/prompts/assessor-v21.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v14.md"), "arbiter test prompt\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/scoring.md"), "scoring test rule\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  await writePublicRevisions(root, { "promise-a": "no-progress", "promise-b": "no-progress", "promise-c": "no-progress" });
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
  await writeFile(join(root, "automation/prompts/assessor-v21.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v14.md"), "arbiter test prompt\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/scoring.md"), "scoring test rule\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  await writePublicRevisions(root, { "promise-a": "no-progress", "promise-b": "no-progress", "promise-c": "no-progress" });
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
  await writeFile(join(root, "automation/prompts/assessor-v21.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v14.md"), "arbiter test prompt\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/scoring.md"), "scoring test rule\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  await writePublicRevisions(root, { "oversized-promise": "no-progress", "normal-promise": "no-progress" });
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

test("the review pull request lists every current proposal that changes the public score, and what needs a person", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-changes-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v21.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v14.md"), "arbiter test prompt\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/scoring.md"), "scoring test rule\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  // The mock assessors propose "moving-towards" for every promise.
  await writePublicRevisions(root, { "changed-promise": "no-progress", "confirmed-promise": "moving-towards", "oversized-promise": "no-progress" });
  const packages = join(root, "packages");
  await mkdir(packages);
  await writePackage(packages, evidencePackage("changed-promise", "2026-09-10"));
  await writePackage(packages, evidencePackage("confirmed-promise", "2026-09-10"));
  const oversized = evidencePackage("oversized-promise", "2026-09-10");
  oversized.generation = { estimatedTokens: 300_000, oversized: true };
  await writePackage(packages, oversized);

  const summary = await runBatch(root, packages, "10");
  assert.equal(summary.newProposalCount, 2);
  assert.equal(summary.scoreChangeCount, 1);
  assert.equal(summary.confirmedCount, 1);
  const body = await readFile(join(root, "automation/pull-request.md"), "utf8");
  assert.match(body, /### Návrhy, které mění hodnocení na webu \(1, z toho nové: 1\)/);
  assert.match(body, /#### Testovací slib changed-promise \(`changed-promise`\)/);
  assert.match(body, /Na webu: \*\*Zatím bez ověřeného podstatného posunu \(0\)\*\* → navrženo: \*\*Směřuje ke splnění \(\+1\)\*\*/);
  assert.match(body, /- \*\*První hodnotitel:\*\* Směřuje ke splnění \(\+1\)\. Strana provedla ověřený krok související s tímto slibem\.\n- \*\*Druhý hodnotitel:\*\* Směřuje ke splnění \(\+1\)\. [^\n]+\n- \*\*Třetí hodnotitel:\*\* nevolán, posudky se shodly\./);
  assert.match(body, /\*Nový návrh z tohoto běhu\.\*/);
  assert.doesNotMatch(body, /confirmed-promise/);
  assert.match(body, /### Vyžaduje lidské rozhodnutí \(1\)\n\n- Testovací slib oversized-promise \(`oversized-promise`\): balíček je větší, než model dokáže přečíst/);
  assert.match(body, /Nové návrhy, které potvrzují hodnocení na webu: \*\*1\*\*/);

  // An unreviewed change stays listed in later runs, no longer marked new.
  const rerun = await runBatch(root, packages, "10");
  assert.equal(rerun.unchangedCount, 2);
  assert.equal(rerun.scoreChangeCount, 1);
  const rerunBody = await readFile(join(root, "automation/pull-request.md"), "utf8");
  assert.match(rerunBody, /\(1, z toho nové: 0\)/);
  assert.match(rerunBody, /Testovací slib changed-promise/);
  assert.doesNotMatch(rerunBody, /nový návrh z tohoto běhu/i);

  // Newer evidence not yet assessed marks the proposal as outdated.
  await writePackage(packages, evidencePackage("changed-promise", "2026-09-11"));
  await rm(join(packages, "changed-promise-2026-09-10.json"));
  const deferred = await runBatch(root, packages, "0");
  assert.equal(deferred.deferredCount, 1);
  assert.match(await readFile(join(root, "automation/pull-request.md"), "utf8"), /\*Podklady se od návrhu změnily, nový návrh zatím nevznikl\.\*/);

  // Once the public site shows the proposed score, the change is no longer listed.
  await writePublicRevisions(root, { "changed-promise": "moving-towards" }, { revision: 2 });
  const published = await runBatch(root, packages, "0");
  assert.equal(published.scoreChangeCount, 0);
  assert.match(await readFile(join(root, "automation/pull-request.md"), "utf8"), /Žádný aktuální návrh nemění hodnocení zveřejněné na webu\./);
});

test("a proposal for a promise without a public score is listed as a change", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-no-public-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v21.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v14.md"), "arbiter test prompt\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/scoring.md"), "scoring test rule\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  await writePublicRevisions(root, {});
  const packages = join(root, "packages");
  await mkdir(packages);
  await writePackage(packages, evidencePackage("unknown-promise", "2026-09-10"));
  const summary = await runBatch(root, packages, "10");
  assert.equal(summary.scoreChangeCount, 1);
  assert.match(await readFile(join(root, "automation/pull-request.md"), "utf8"), /Na webu: \*\*bez hodnocení na webu\*\* → navrženo/);
});

test("a human review stays listed until a public revision follows it, and a withdrawn package is marked", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-human-review-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v21.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v14.md"), "arbiter test prompt\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/scoring.md"), "scoring test rule\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  await writePublicRevisions(root, { "review-promise": "no-progress", "changed-promise": "no-progress" });
  const packages = join(root, "packages");
  await mkdir(packages);
  await writePackage(packages, evidencePackage("review-promise", "2026-09-10"));
  await writePackage(packages, evidencePackage("changed-promise", "2026-09-10"));

  const first = await runBatch(root, packages, "10", { humanReviewPromise: "review-promise" });
  assert.equal(first.humanReviewCount, 1);
  const body = await readFile(join(root, "automation/pull-request.md"), "utf8");
  assert.match(body, /### Vyžaduje lidské rozhodnutí \(1\)\n\n- Testovací slib review-promise \(`review-promise`\): oba automatické posudky označily podklady za nedostatečné \(nový návrh z tohoto běhu\)/);

  // The change proposal's package is withdrawn: it stays listed and is marked.
  await rm(join(packages, "changed-promise-2026-09-10.json"));
  const withdrawn = await runBatch(root, packages, "10", { humanReviewPromise: "review-promise" });
  assert.equal(withdrawn.scoreChangeCount, 1);
  assert.match(await readFile(join(root, "automation/pull-request.md"), "utf8"), /#### Testovací slib changed-promise[^]*\*Slib už nemá žádný aktuální balíček podkladů\.\*/);

  // Any later public revision settles a proposal, whatever score it gives.
  await writePublicRevisions(root, { "review-promise": "no-progress", "changed-promise": "acting-against" }, { revision: 2, publishedAt: "2026-09-12" });
  const settled = await runBatch(root, packages, "10", { humanReviewPromise: "review-promise" });
  assert.equal(settled.humanReviewCount, 0);
  assert.equal(settled.scoreChangeCount, 0);
});

function reviewSummary(pendingReviews, results = []) {
  return { pendingReviews, results, confirmedCount: 0, unchangedCount: 0, maxAssessments: 0, deferredCount: 0, failedCount: 0, interruption: null, relevanceVerdictsByRoute: [] };
}

function scoreChange(index, explanationCz, verdicts = null) {
  return { promiseId: `promise-${index}`, promiseTitleCz: `Slib ${index}`, partyName: "ANO 2011", kind: "score-change", publicStatus: "no-progress", candidateStatus: "moving-towards", resolutionReason: verdicts?.arbiter ? "arbiter-selection" : "assessor-consensus", explanationCz, verdicts, reviewUrl: null, newInRun: true, packageState: "current" };
}

const assessorVerdict = (explanationCz, status = "moving-towards") => ({ status, evidenceSufficient: true, explanationCz });

test("each listed change shows both assessors and the arbiter with their reasons, as inert text", () => {
  const verdicts = { assessorA: assessorVerdict("Viz @someone a #12."), assessorB: null, arbiter: { choice: "assessor-a", explanationCz: "První posudek odpovídá **podkladům**." } };
  const { body, comments } = renderReviewPullRequest(reviewSummary([scoreChange(1, "Viz @someone a #12.", verdicts)], [{ promiseId: "promise-1", promiseTitleCz: "Slib 1", disposition: "blocked-oversized", reviewUrl: null }]));
  assert.deepEqual(comments, []);
  assert.match(body, /ANO 2011 · Na webu: \*\*Zatím bez ověřeného podstatného posunu \(0\)\*\* → navrženo: \*\*Směřuje ke splnění \(\+1\)\*\* · o neshodě automatických posudků rozhodl třetí hodnotitel/);
  assert.match(body, /- \*\*První hodnotitel:\*\* Směřuje ke splnění \(\+1\)\. Viz @\u200bsomeone a \\#\u200b12\./);
  assert.match(body, /- \*\*Druhý hodnotitel:\*\* výstup neprošel kontrolou, nepoužil se\./);
  assert.match(body, /- \*\*Třetí hodnotitel:\*\* vybral první posudek\. První posudek odpovídá \\\*\\\*podkladům\\\*\\\*\./);
  assert.match(body, /### Vyžaduje lidské rozhodnutí \(1\)\n\n- Slib 1 \(`promise-1`\): balíček je větší, než model dokáže přečíst/);

  const consensus = renderReviewPullRequest(reviewSummary([scoreChange(2, "x", { assessorA: assessorVerdict("A."), assessorB: assessorVerdict("B."), arbiter: null })]));
  assert.match(consensus.body, /- \*\*Třetí hodnotitel:\*\* nevolán, posudky se shodly\./);
  const trimmed = renderReviewPullRequest(reviewSummary([{ ...scoreChange(3, "x"), newInRun: false, contextTrimmed: true }]));
  assert.match(trimmed.body, /\*Balíček se modelům vešel jen bez části kontextu; co chybělo, je na stránce návrhu\.\*/);
});

test("a list too long for the body continues, in order and complete, in comments within GitHub's limit", () => {
  const many = Array.from({ length: 700 }, (_, index) => scoreChange(index, "x", { assessorA: assessorVerdict("Dlouhé vysvětlení. ".repeat(30)), assessorB: assessorVerdict("Jiné vysvětlení. ".repeat(30)), arbiter: null }));
  const humans = Array.from({ length: 300 }, (_, index) => ({ promiseId: `human-${index}`, promiseTitleCz: `Lidské ${index}`, partyName: "SPD", kind: "human-review", resolutionReason: "insufficient-evidence", reviewUrl: null, newInRun: false, packageState: "current" }));
  const { body, comments } = renderReviewPullRequest(reviewSummary([...many, ...humans]));
  assert.ok(body.length <= 56_000, `body has ${body.length} characters`);
  assert.ok(comments.length > 1);
  for (const comment of comments) {
    assert.ok(comment.length <= 61_000, `a comment has ${comment.length} characters`);
    assert.ok(comment.startsWith(`${continuationMarker}\n`));
  }
  assert.match(body, new RegExp(`Přehled pokračuje v ${comments.length} komentářích pod tímto pull requestem`));
  assert.match(comments[0], new RegExp(`pokračování 2/${comments.length + 1}`));
  const all = [body, ...comments].join("\n");
  const listed = [...all.matchAll(/\(`((?:promise|human)-\d+)`\)/g)].map(([, id]) => id);
  assert.deepEqual(listed, [...many.map(({ promiseId }) => promiseId), ...humans.map(({ promiseId }) => promiseId)], "every item is listed once, in order");
  assert.match(all, /### Návrhy, které mění hodnocení na webu \(700, z toho nové: 700\) \(pokračování\)/);
  // No page ends with a heading whose first item moved to the next page.
  for (const page of [body.slice(0, body.indexOf("\n\nVšechny návrhy")), ...comments]) assert.doesNotMatch(page.trimEnd(), /\n###[^\n]*$/);
  assert.match(body, /### Souhrn\n\n- Návrhy, které mění hodnocení na webu: \*\*700\*\*\n- Vyžaduje lidské rozhodnutí: \*\*300\*\*/);
});

test("the continuation stops at a bounded number of comments and says what was left out", () => {
  const huge = Array.from({ length: 6_000 }, (_, index) => scoreChange(index, "x", { assessorA: assessorVerdict("Velmi dlouhé vysvětlení. ".repeat(80)), assessorB: assessorVerdict("Jiné. ".repeat(250)), arbiter: null }));
  const humans = Array.from({ length: 3 }, (_, index) => ({ promiseId: `human-${index}`, promiseTitleCz: `Lidské ${index}`, kind: "human-review", resolutionReason: "insufficient-evidence", reviewUrl: null, newInRun: false, packageState: "current" }));
  const summary = { ...reviewSummary([...huge, ...humans]), failedCount: 7, relevanceVerdictsByRoute: [{ route: "tag:example", notRelevant: 3, verdicts: 5 }] };
  const { body, comments } = renderReviewPullRequest(summary);
  assert.equal(comments.length, 40);
  // The note counts exactly the items left out, never a heading.
  const listed = new Set([...[body, ...comments].join("\n").matchAll(/\(`((?:promise|human)-\d+)`\)/g)].map(([, id]) => id));
  const [, omitted] = comments.at(-1).match(/… a dalších (\d+) položek se sem nevešlo; úplný seznam je v `assessment-batch.json`/);
  assert.equal(Number(omitted), huge.length + humans.length - listed.size);
  // The counts and the route table stay in the body, however long the list.
  assert.match(body, /Izolovaná selhání hodnocení, zkusí se znovu v dalším běhu: \*\*7\*\*/);
  assert.match(body, /\| `tag:example` \| 3 \| 5 \|/);
  assert.ok(comments.every((comment) => comment.length <= 61_000));
  // A reason longer than the listed limit is cut in the list.
  assert.match(comments[0], /Velmi dlouhé vysvětlení\. [^\n]* …\n/);
});

test("in the workflow, each listed promise links to its review page on the audit branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "slava-assessment-links-"));
  await mkdir(join(root, "automation/prompts"), { recursive: true });
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await writeFile(join(root, "automation/prompts/assessor-v21.md"), "assessor test prompt\n");
  await writeFile(join(root, "automation/prompts/arbiter-v14.md"), "arbiter test prompt\n");
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs/scoring.md"), "scoring test rule\n");
  await writeFile(join(root, "automation/review-proposals/manifest.json"), `${JSON.stringify({ schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [] }, null, 2)}\n`);
  await writePublicRevisions(root, { "linked-promise": "no-progress" });
  const packages = join(root, "packages");
  await mkdir(packages);
  await writePackage(packages, evidencePackage("linked-promise", "2026-09-10"));
  const summary = await runBatch(root, packages, "10", { environment: { GITHUB_REPOSITORY: "example/repository", REVIEW_BRANCH: "automation/assessment-review" } });
  const [pending] = summary.pendingReviews;
  assert.match(pending.reviewUrl, /^https:\/\/github\.com\/example\/repository\/blob\/automation\/assessment-review\/automation\/review-proposals\/linked-promise\/[a-f0-9]{64}\/review\.md$/);
  const body = await readFile(join(root, "automation/pull-request.md"), "utf8");
  assert.ok(body.includes(`#### [Testovací slib linked-promise](${pending.reviewUrl}) (\`linked-promise\`)`));
});
