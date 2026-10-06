import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { assessmentRuntimeConfig, loadAssessmentPrompts } from "./lib/assessment-config.mjs";
import {
  addReviewProposals,
  createReviewProposal,
  currentPublicRevisions,
  currentReviewProposal,
  mergeRelevanceVerdicts,
  planAssessmentInputs,
  proposedPublicExplanation,
  relevanceVerdictsByRoute,
  renderHumanReviewMarkdown,
  renderReviewPullRequest,
  reviewVerdicts,
  validateReviewManifest
} from "./lib/assessment-review.mjs";
import { hashAssessmentContent, hashAssessmentFingerprint, validateEvidencePackage } from "./lib/assessment-pipeline.mjs";
import { relevanceVerdictsOf, withoutIrrelevantLawChanges } from "./lib/irrelevance-verdicts.mjs";
import { loadCurrentEvidencePackages } from "./lib/evidence-package-queue.mjs";
import { log, progress } from "./lib/run-log.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function writeJsonAtomically(filePath, value) {
  const temporary = resolve(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function parseArgs(args) {
  const options = {
    packages: null,
    retryPackages: "automation/review-proposals/failures",
    proposals: "automation/review-proposals",
    runs: "automation/runs/pipeline/github-actions/assessments",
    summary: "automation/runs/pipeline/github-actions/assessment-batch.json",
    pullRequestBody: "automation/runs/pipeline/github-actions/assessment-review-pr.md",
    pullRequestComments: "automation/runs/pipeline/github-actions/assessment-review-pr-comments",
    publicRevisions: "data/assessment-revisions"
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--packages") options.packages = args[++index];
    else if (arg === "--retry-packages") options.retryPackages = args[++index];
    else if (arg === "--proposals") options.proposals = args[++index];
    else if (arg === "--runs") options.runs = args[++index];
    else if (arg === "--summary") options.summary = args[++index];
    else if (arg === "--pull-request-body") options.pullRequestBody = args[++index];
    else if (arg === "--pull-request-comments") options.pullRequestComments = args[++index];
    else if (arg === "--public-revisions") options.publicRevisions = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.packages, "--packages is required");
  return options;
}

async function runAssessment(packagePath, outputRoot, responseCache) {
  const runner = process.env.SLIBY_ASSESSMENT_RUNNER ?? "scripts/run-assessment.mjs";
  const child = spawn(process.execPath, [runner, packagePath, outputRoot], {
    cwd: process.cwd(),
    // The packages assessed at once share the account's token budget.
    env: { ...process.env, SLIBY_RESPONSE_CACHE: responseCache, SLIBY_TOKEN_BUDGET_SHARE: String(budgetShare) },
    stdio: ["ignore", "pipe", "inherit"]
  });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    process.stdout.write(chunk);
  });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`Assessment runner terminated by signal ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
  invariant(exitCode === 0, `Assessment runner failed with exit code ${exitCode}`);
  const result = JSON.parse(stdout);
  const auditPath = resolve(result.outputDirectory, "assessment-run.json");
  return validateAssessmentAudit(JSON.parse(await readFile(auditPath, "utf8")), result);
}

function validateAssessmentAudit(audit, result) {
  invariant(audit?.publicationApproved === false, "Assessment audit must remain unpublished");
  invariant(audit.assessmentFingerprint === result.assessmentFingerprint, "Assessment runner fingerprint mismatch");
  invariant(audit.assessmentContentHash === result.assessmentContentHash, "Assessment runner content hash mismatch");
  invariant(["candidate", "human-review-required", "assessment-failed"].includes(audit.resolution?.state), "Assessment runner returned an invalid resolution");
  return audit;
}

function humanReviewUrl(reviewPath) {
  if (!reviewPath || !process.env.GITHUB_REPOSITORY || !process.env.REVIEW_BRANCH) return null;
  return `https://github.com/${process.env.GITHUB_REPOSITORY}/blob/${process.env.REVIEW_BRANCH}/${reviewPath}`;
}

// Stops starting new items once shouldStop() is true; items already running
// finish. Skipped items leave their result slot undefined.
async function mapWithConcurrency(items, concurrency, worker, shouldStop = () => false) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length && !shouldStop()) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

const options = parseArgs(process.argv.slice(2));
const packageDirectory = resolve(options.packages);
const proposalRoot = resolve(options.proposals);
const runRoot = resolve(options.runs);
const summaryPath = resolve(options.summary);
const pullRequestBodyPath = resolve(options.pullRequestBody);
const pullRequestCommentsPath = resolve(options.pullRequestComments);
const relativeProposalRoot = relative(process.cwd(), proposalRoot).replaceAll("\\", "/");
invariant(relativeProposalRoot === "automation/review-proposals", "--proposals must resolve to automation/review-proposals");

const manifestPath = resolve(proposalRoot, "manifest.json");
const manifest = validateReviewManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const publicRevisionDirectory = resolve(options.publicRevisions);
const publicRevisions = currentPublicRevisions(await Promise.all((await readdir(publicRevisionDirectory))
  .filter((name) => name.endsWith(".json"))
  .map(async (name) => ({ name, ...JSON.parse(await readFile(resolve(publicRevisionDirectory, name), "utf8")) }))));
const blockedPromiseIds = new Set();

const packages = [];
const currentPackagePromiseIds = new Set();
for (const { path, evidencePackage, blockedReason } of await loadCurrentEvidencePackages(packageDirectory)) {
  currentPackagePromiseIds.add(evidencePackage.promise.id);
  packages.push({ path, evidencePackage });
  if (blockedReason) blockedPromiseIds.add(evidencePackage.promise.id);
}

async function failurePackageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return failurePackageFiles(path);
    return entry.isFile() && entry.name === "evidence-package.json" ? [path] : [];
  }));
  return nested.flat();
}

const retryDirectory = resolve(options.retryPackages);
const activeFailuresByPromise = new Map();
async function retireFailure(failure, { proposal, reason }) {
  const retirementPath = resolve(failure.directory, "retired.json");
  if (existsSync(retirementPath)) return;
  await writeFile(retirementPath, `${JSON.stringify({
    schemaVersion: "1.0.0",
    retiredAt: new Date().toISOString(),
    reason,
    replacedByProposalId: proposal.proposalId,
    replacedByAssessmentFingerprint: proposal.assessmentFingerprint
  }, null, 2)}\n`, { flag: "wx" });
}

if (existsSync(retryDirectory)) {
  for (const path of await failurePackageFiles(retryDirectory)) {
    const directory = dirname(path);
    if (existsSync(resolve(directory, "retired.json"))) continue;
    const evidencePackage = validateEvidencePackage(JSON.parse(await readFile(path, "utf8")));
    const auditRecord = JSON.parse(await readFile(resolve(directory, "assessment-run.json"), "utf8"));
    const promiseId = evidencePackage.promise.id;
    invariant(auditRecord?.promiseId === promiseId, `Failure audit does not match ${promiseId}`);
    invariant(auditRecord?.resolution?.state === "assessment-failed", `Failure audit for ${promiseId} is not an assessment failure`);
    invariant(typeof auditRecord.evaluatedAt === "string" && !Number.isNaN(Date.parse(auditRecord.evaluatedAt)), `Failure audit for ${promiseId} has an invalid evaluatedAt`);
    const failures = activeFailuresByPromise.get(promiseId) ?? [];
    failures.push({ path, directory, evidencePackage, auditRecord });
    activeFailuresByPromise.set(promiseId, failures);
  }
}

for (const [promiseId, failures] of activeFailuresByPromise) {
  const currentProposal = currentReviewProposal(manifest, promiseId);
  if (!currentProposal) continue;
  for (const failure of failures) {
    if (Date.parse(currentProposal.evaluatedAt) > Date.parse(failure.auditRecord.evaluatedAt)) {
      await retireFailure(failure, { proposal: currentProposal, reason: "superseded-by-newer-review-proposal" });
    }
  }
}

const retryCandidates = new Map();
for (const [promiseId, failures] of activeFailuresByPromise) {
  if (currentPackagePromiseIds.has(promiseId)) continue;
  for (const failure of failures) {
    if (existsSync(resolve(failure.directory, "retired.json"))) continue;
    const previous = retryCandidates.get(promiseId);
    if (!previous || failure.auditRecord.evaluatedAt > previous.auditRecord.evaluatedAt || (
      failure.auditRecord.evaluatedAt === previous.auditRecord.evaluatedAt && failure.auditRecord.runId > previous.auditRecord.runId
    )) {
      retryCandidates.set(promiseId, failure);
    }
  }
}
packages.push(...retryCandidates.values());
// A retried failure package is not a current package of its promise.
const retryPromiseIds = new Set(retryCandidates.keys());

const prompts = await loadAssessmentPrompts();
const runtime = assessmentRuntimeConfig();
invariant(Number.isInteger(runtime.concurrency) && runtime.concurrency > 0 && runtime.concurrency <= 32, "SLIBY_ASSESSMENT_CONCURRENCY must be an integer from 1 to 32");
const { concurrency, ...assessmentRuntime } = runtime;
const maxAssessments = Number(process.env.SLIBY_MAX_ASSESSMENTS ?? "0");
invariant(Number.isInteger(maxAssessments) && maxAssessments >= 0, "SLIBY_MAX_ASSESSMENTS must be a non-negative integer");
const plan = planAssessmentInputs({ packages, manifest, blockedPromiseIds, prompts, runtime: assessmentRuntime });

// The content hash and fingerprint of the package this assessment's own
// verdicts leave (docs/evidence-pipeline.md, Assess); null when they leave
// nothing out, or leave no law change.
function reducedPackageOf(item, auditRecord) {
  const proposalId = `${item.promiseId}--${auditRecord.assessmentFingerprint.slice(0, 12)}`;
  const entries = relevanceVerdictsOf({ evidencePackage: item.evidencePackage, auditRecord, proposalId }).filter(({ irrelevant }) => irrelevant).map(({ entry }) => entry);
  if (entries.length === 0) return null;
  const reduced = withoutIrrelevantLawChanges(item.evidencePackage, entries);
  if (!reduced.evidence.some(({ role }) => role === "law-change")) return null;
  const assessmentContentHash = hashAssessmentContent(reduced);
  return { assessmentContentHash, assessmentFingerprint: hashAssessmentFingerprint({ assessmentContentHash, prompts, runtime: assessmentRuntime }) };
}
const newProposals = [];
const results = [];

await mkdir(runRoot, { recursive: true });
const assessmentItems = [];
for (const item of plan) {
  if (item.disposition !== "assess") {
    const existingProposal = item.disposition === "unchanged" ? currentReviewProposal(manifest, item.promiseId) : null;
    results.push({
      promiseId: item.promiseId,
      promiseTitleCz: item.evidencePackage.promise.titleCz,
      assessmentFingerprint: item.assessmentFingerprint,
      disposition: item.disposition,
      resolutionState: null,
      candidateStatus: null,
      reviewUrl: humanReviewUrl(existingProposal?.humanReviewPath)
    });
    continue;
  }
  // Packages beyond the per-run cap stay queued and are assessed in a later
  // run; they are reported with their size so the cost can be estimated.
  if (assessmentItems.length >= maxAssessments) {
    results.push({
      promiseId: item.promiseId,
      promiseTitleCz: item.evidencePackage.promise.titleCz,
      assessmentFingerprint: item.assessmentFingerprint,
      disposition: "deferred-by-limit",
      resolutionState: null,
      candidateStatus: null,
      reviewUrl: null,
      packageCharacters: JSON.stringify(item.evidencePackage).length
    });
    continue;
  }
  assessmentItems.push(item);
}

// Each paid assessment is saved at once: its proposal files are written as
// soon as it finishes and the manifest is rewritten atomically after every
// proposal. A failure (for example exhausted API credit) stops new
// assessments; the finished ones stay saved, and a later run assesses only
// what is still missing.
let currentManifest = manifest;
let manifestWrites = Promise.resolve();
function saveProposal(proposal) {
  currentManifest = addReviewProposals(currentManifest, [proposal]);
  const snapshot = currentManifest;
  manifestWrites = manifestWrites.then(() => writeJsonAtomically(manifestPath, snapshot));
  return manifestWrites;
}
let interruption = null;

log(`assessment: ${plan.length} current packages; ${assessmentItems.length} to assess now (cap ${maxAssessments}), ${results.filter(({ disposition }) => disposition === "unchanged").length} unchanged, ${results.filter(({ disposition }) => disposition === "deferred-by-limit").length} deferred by the cap, ${results.filter(({ disposition }) => disposition === "blocked-oversized").length} blocked`);
const tickAssessments = progress("assessment", assessmentItems.length, { every: 1 });
// The packages assessed at the same time share the account's token budget.
const budgetShare = Math.max(1, Math.min(concurrency, assessmentItems.length));
const assessed = await mapWithConcurrency(assessmentItems, concurrency, async (item) => {
  log(`assessing ${item.promiseId}`);
  // Paid model responses of an unfinished assessment wait here until the
  // assessment is saved, so a retry pays only for the missing calls.
  const responseCache = resolve(proposalRoot, "responses", item.promiseId, item.assessmentFingerprint);
  let auditRecord;
  try {
    auditRecord = await runAssessment(item.path, runRoot, responseCache);
  } catch (error) {
    interruption ??= { promiseId: item.promiseId, message: error instanceof Error ? error.message : String(error) };
    log(`assessment of ${item.promiseId} stopped by an error; no new assessments start: ${interruption.message}`);
    tickAssessments(`${item.promiseId}: interrupted`);
    return { interrupted: true, result: {
      promiseId: item.promiseId, promiseTitleCz: item.evidencePackage.promise.titleCz, assessmentFingerprint: item.assessmentFingerprint,
      disposition: "interrupted-by-error", resolutionState: null, candidateStatus: null, reviewUrl: null,
      error: error instanceof Error ? error.message : String(error)
    } };
  }
  invariant(auditRecord.assessmentFingerprint === item.assessmentFingerprint, `Fingerprint changed while assessing ${item.promiseId}`);
  if (auditRecord.resolution.state === "assessment-failed") {
    const relativeFailureDirectory = `automation/review-proposals/failures/${item.promiseId}/${item.assessmentFingerprint}`;
    const failureDirectory = resolve(relativeFailureDirectory);
    await mkdir(failureDirectory, { recursive: true });
    await writeFile(resolve(failureDirectory, "evidence-package.json"), `${JSON.stringify(item.evidencePackage, null, 2)}\n`);
    await writeFile(resolve(failureDirectory, "assessment-run.json"), `${JSON.stringify(auditRecord, null, 2)}\n`);
    await rm(responseCache, { recursive: true, force: true });
    tickAssessments(`${item.promiseId}: both assessor outputs invalid, failure saved`);
    return { proposal: null, result: {
      promiseId: item.promiseId, promiseTitleCz: item.evidencePackage.promise.titleCz,
      assessmentFingerprint: item.assessmentFingerprint, disposition: "assessment-failed",
      resolutionState: null, candidateStatus: null, reviewUrl: null, error: auditRecord.resolution.reason,
      validationErrors: auditRecord.assessorValidationErrors
    } };
  }
  const relativeProposalDirectory = `automation/review-proposals/${item.promiseId}/${item.assessmentFingerprint}`;
  const proposalDirectory = resolve(relativeProposalDirectory);
  await mkdir(resolve(proposalRoot, item.promiseId), { recursive: true });
  // A proposal to assess is not in the manifest, so an existing directory is
  // an unfinished write from an interrupted run.
  await rm(proposalDirectory, { recursive: true, force: true });
  await mkdir(proposalDirectory, { recursive: false });
  await writeFile(resolve(proposalDirectory, "evidence-package.json"), `${JSON.stringify(item.evidencePackage, null, 2)}\n`, { flag: "wx" });
  await writeFile(resolve(proposalDirectory, "assessment-run.json"), `${JSON.stringify(auditRecord, null, 2)}\n`, { flag: "wx" });
  const previousProposal = currentReviewProposal(currentManifest, item.promiseId);
  const proposal = createReviewProposal({ auditRecord, proposalDirectory: relativeProposalDirectory, supersedesProposalId: previousProposal?.proposalId ?? null, publicRevisionAtEvaluation: publicRevisions.get(item.promiseId)?.revision ?? 0, reduced: reducedPackageOf(item, auditRecord) });
  await writeFile(resolve(proposalDirectory, "proposal.json"), `${JSON.stringify(proposal, null, 2)}\n`, { flag: "wx" });
  await writeFile(resolve(proposalDirectory, "review.md"), renderHumanReviewMarkdown({ evidencePackage: item.evidencePackage, auditRecord, proposal }), { flag: "wx" });
  await Promise.all((activeFailuresByPromise.get(item.promiseId) ?? []).map((failure) => retireFailure(failure, {
    proposal,
    reason: "replaced-by-successful-assessment"
  })));
  await saveProposal(proposal);
  await rm(responseCache, { recursive: true, force: true });
  tickAssessments(`${item.promiseId}: ${auditRecord.resolution.state}${auditRecord.resolution.status ? ` (${auditRecord.resolution.status})` : ""}, saved`);
  return { proposal, result: {
    promiseId: item.promiseId, promiseTitleCz: item.evidencePackage.promise.titleCz, assessmentFingerprint: item.assessmentFingerprint,
    disposition: "assessed", resolutionState: auditRecord.resolution.state, candidateStatus: auditRecord.resolution.status, reviewUrl: humanReviewUrl(proposal.humanReviewPath),
    relevanceVerdicts: relevanceVerdictsByRoute(item.evidencePackage, auditRecord)
  } };
}, () => interruption !== null);
for (const [index, outcome] of assessed.entries()) {
  if (!outcome) {
    const item = assessmentItems[index];
    results.push({
      promiseId: item.promiseId,
      promiseTitleCz: item.evidencePackage.promise.titleCz,
      assessmentFingerprint: item.assessmentFingerprint,
      disposition: "not-assessed-after-interruption",
      resolutionState: null,
      candidateStatus: null,
      reviewUrl: null
    });
    continue;
  }
  if (outcome?.proposal) newProposals.push(outcome.proposal);
  results.push(outcome.result);
}
await manifestWrites;

// The current proposals that still need a person (docs/evidence-pipeline.md,
// step 10). A file that cannot be read only loses the explanation or title.
async function readProposalFile(proposal, name) {
  try {
    return JSON.parse(await readFile(resolve(proposal.path, name), "utf8"));
  } catch (error) {
    log(`cannot read ${name} of proposal ${proposal.proposalId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
function explanationOf(proposal, auditRecord) {
  try {
    return proposedPublicExplanation(auditRecord);
  } catch (error) {
    log(`cannot read the explanation of proposal ${proposal.proposalId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
function verdictsOf(proposal, auditRecord) {
  try {
    return reviewVerdicts(auditRecord);
  } catch (error) {
    log(`cannot read the verdicts of proposal ${proposal.proposalId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
const newProposalIds = new Set(newProposals.map(({ proposalId }) => proposalId));
const planByPromise = new Map(plan.map((item) => [item.promiseId, item]));
const pendingReviews = (await Promise.all(currentManifest.proposals.filter(({ supersededByProposalId }) => !supersededByProposalId).map(async (proposal) => {
  const publicRevision = publicRevisions.get(proposal.promiseId) ?? null;
  if ((publicRevision?.revision ?? 0) > proposal.publicRevisionAtEvaluation) return null;
  if (proposal.resolutionState === "candidate" && proposal.candidateStatus === (publicRevision?.status ?? null)) return null;
  const item = retryPromiseIds.has(proposal.promiseId) ? null : planByPromise.get(proposal.promiseId);
  const packageState = !item
    ? "withdrawn"
    : item.assessmentContentHash === proposal.assessmentContentHash || item.assessmentContentHash === proposal.reducedAssessmentContentHash
      ? "current"
      : "changed";
  const isCandidate = proposal.resolutionState === "candidate";
  const auditRecord = isCandidate ? await readProposalFile(proposal, "assessment-run.json") : null;
  const evidencePackage = planByPromise.get(proposal.promiseId)?.evidencePackage ?? await readProposalFile(proposal, "evidence-package.json");
  // Whether the package the proposal assessed was fitted without part of its
  // context: the queued one only while it is the very package assessed.
  const assessedPackage = packageState === "current" && item.assessmentContentHash === proposal.assessmentContentHash ? item.evidencePackage : await readProposalFile(proposal, "evidence-package.json");
  return {
    promiseId: proposal.promiseId,
    promiseTitleCz: evidencePackage?.promise?.titleCz ?? proposal.promiseId,
    kind: isCandidate ? "score-change" : "human-review",
    publicStatus: publicRevision?.status ?? null,
    candidateStatus: proposal.candidateStatus,
    resolutionReason: proposal.resolutionReason,
    partyName: evidencePackage?.promise?.partyName ?? null,
    explanationCz: auditRecord ? explanationOf(proposal, auditRecord) : null,
    verdicts: auditRecord ? verdictsOf(proposal, auditRecord) : null,
    reviewUrl: humanReviewUrl(proposal.humanReviewPath),
    newInRun: newProposalIds.has(proposal.proposalId),
    packageState,
    contextTrimmed: Boolean(assessedPackage?.generation?.contextOmissions)
  };
}))).filter(Boolean);
pendingReviews.sort((left, right) => left.promiseId.localeCompare(right.promiseId));

const summary = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  publicationApproved: false,
  packageCount: plan.length,
  newProposalCount: newProposals.length,
  scoreChangeCount: pendingReviews.filter(({ kind }) => kind === "score-change").length,
  humanReviewCount: pendingReviews.filter(({ kind }) => kind === "human-review").length,
  confirmedCount: newProposals.filter(({ promiseId, resolutionState, candidateStatus }) => resolutionState === "candidate" && candidateStatus === publicRevisions.get(promiseId)?.status).length,
  unchangedCount: results.filter(({ disposition }) => disposition === "unchanged").length,
  blockedCount: results.filter(({ disposition }) => disposition === "blocked-oversized").length,
  failedCount: results.filter(({ disposition }) => disposition === "assessment-failed").length,
  maxAssessments,
  deferredCount: results.filter(({ disposition }) => disposition === "deferred-by-limit").length,
  deferredPackageCharacters: results.filter(({ disposition }) => disposition === "deferred-by-limit").reduce((sum, { packageCharacters }) => sum + packageCharacters, 0),
  interruption,
  interruptedCount: results.filter(({ disposition }) => disposition === "interrupted-by-error").length,
  notAssessedAfterInterruptionCount: results.filter(({ disposition }) => disposition === "not-assessed-after-interruption").length,
  // Law changes the assessors found not relevant, by the tag or direct link
  // that routed them: a route with many rejections is too broad.
  relevanceVerdictsByRoute: mergeRelevanceVerdicts(results.map(({ relevanceVerdicts }) => relevanceVerdicts ?? [])),
  promptCharacters: prompts.assessor.instructions.length + prompts.arbiter.instructions.length,
  assessmentConcurrency: concurrency,
  proposalRoot: relativeProposalRoot,
  pendingReviews,
  results
};
await mkdir(resolve(summaryPath, ".."), { recursive: true });
await mkdir(resolve(pullRequestBodyPath, ".."), { recursive: true });
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
// The body and, when the list is too long for it, numbered continuation
// comments the workflow posts in order.
const pullRequest = renderReviewPullRequest(summary);
await writeFile(pullRequestBodyPath, pullRequest.body);
await rm(pullRequestCommentsPath, { recursive: true, force: true });
await mkdir(pullRequestCommentsPath, { recursive: true });
for (const [index, comment] of pullRequest.comments.entries()) {
  await writeFile(resolve(pullRequestCommentsPath, `${String(index + 1).padStart(3, "0")}.md`), comment);
}

console.log(JSON.stringify({
  packageCount: summary.packageCount,
  newProposalCount: summary.newProposalCount,
  unchangedCount: summary.unchangedCount,
  blockedCount: summary.blockedCount,
  failedCount: summary.failedCount,
  deferredCount: summary.deferredCount,
  deferredPackageCharacters: summary.deferredPackageCharacters,
  summaryPath,
  pullRequestBodyPath,
  pullRequestComments: pullRequest.comments.length,
  interruption,
  publicationApproved: false
}, null, 2));
// The summary and every finished proposal are saved; the run still fails so
// the interruption is visible, and a later run assesses the rest.
if (interruption) {
  console.error(`Assessment stopped after an error for ${interruption.promiseId}: ${interruption.message}`);
  process.exitCode = 1;
}
