import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { assessmentRuntimeConfig, loadAssessmentPrompts } from "./lib/assessment-config.mjs";
import {
  addReviewProposals,
  createReviewProposal,
  currentReviewProposal,
  planAssessmentInputs,
  renderHumanReviewMarkdown,
  validateReviewManifest
} from "./lib/assessment-review.mjs";
import { validateEvidencePackage } from "./lib/assessment-pipeline.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(args) {
  const options = {
    packages: null,
    enrichmentRun: null,
    proposals: "automation/review-proposals",
    runs: "automation/runs/pipeline/github-actions/assessments",
    summary: "automation/runs/pipeline/github-actions/assessment-batch.json",
    pullRequestBody: "automation/runs/pipeline/github-actions/assessment-review-pr.md"
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--packages") options.packages = args[++index];
    else if (arg === "--enrichment-run") options.enrichmentRun = args[++index];
    else if (arg === "--proposals") options.proposals = args[++index];
    else if (arg === "--runs") options.runs = args[++index];
    else if (arg === "--summary") options.summary = args[++index];
    else if (arg === "--pull-request-body") options.pullRequestBody = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.packages, "--packages is required");
  invariant(options.enrichmentRun, "--enrichment-run is required");
  return options;
}

async function runAssessment(packagePath, outputRoot) {
  const child = spawn(process.execPath, ["scripts/run-assessment.mjs", packagePath, outputRoot], {
    cwd: process.cwd(),
    env: process.env,
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
  invariant(["candidate", "human-review-required"].includes(audit.resolution?.state), "Assessment runner did not produce a reviewable resolution");
  return audit;
}

function pullRequestBody(summary) {
  const statusLabels = {
    fulfilled: "splněno",
    "moving-towards": "směřuje ke splnění",
    "no-progress": "bez podstatného posunu",
    "moving-against": "směřuje proti slibu",
    "acting-against": "jedná proti slibu"
  };
  const dispositionLabels = {
    assessed: "nový návrh připraven ke kontrole",
    unchanged: "beze změny",
    "blocked-enrichment-warning": "čeká na úplný úřední dokument"
  };
  const lines = [
    "## Neveřejné návrhy hodnocení SLAVA",
    "",
    "Tento pull request ukládá automaticky připravené návrhy k lidské kontrole. Jeho sloučení **nezveřejní hodnocení ani nezmění veřejný web**.",
    "",
    "| Slib | Výsledek zpracování | Navržené hodnocení |",
    "| --- | --- | --- |"
  ];
  for (const result of summary.results) {
    const pipelineResult = result.resolutionState === "human-review-required"
      ? "nelze férově rozhodnout bez člověka"
      : dispositionLabels[result.disposition] ?? result.disposition;
    const promiseLabel = result.reviewUrl ? `[${result.promiseTitleCz}](${result.reviewUrl})` : result.promiseTitleCz;
    lines.push(`| ${promiseLabel} (\`${result.promiseId}\`) | ${pipelineResult} | ${statusLabels[result.candidateStatus] ?? "—"} |`);
  }
  lines.push(
    "",
    `Nové návrhy ke kontrole: **${summary.newProposalCount}**`,
    `Nezměněné podklady bez nového volání modelů: **${summary.unchangedCount}**`,
    `Případy čekající na úplný úřední dokument: **${summary.blockedCount}**`,
    "",
    "Všechny návrhy vyžadují lidskou kontrolu a nejsou schválené ke zveřejnění."
  );
  return `${lines.join("\n")}\n`;
}

function humanReviewUrl(reviewPath) {
  if (!reviewPath || !process.env.GITHUB_REPOSITORY || !process.env.REVIEW_BRANCH) return null;
  return `https://github.com/${process.env.GITHUB_REPOSITORY}/blob/${process.env.REVIEW_BRANCH}/${reviewPath}`;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
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
const relativeProposalRoot = relative(process.cwd(), proposalRoot).replaceAll("\\", "/");
invariant(relativeProposalRoot === "automation/review-proposals", "--proposals must resolve to automation/review-proposals");

const manifestPath = resolve(proposalRoot, "manifest.json");
const manifest = validateReviewManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const enrichmentRun = JSON.parse(await readFile(resolve(options.enrichmentRun), "utf8"));
invariant(Array.isArray(enrichmentRun?.warnings), "Invalid enrichment run warnings");
const blockedPromiseIds = new Set(enrichmentRun.warnings.map(({ promiseId }) => promiseId));

const packageFiles = (await readdir(packageDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "enrichment-run.json")
  .map((entry) => resolve(packageDirectory, entry.name))
  .sort();
const packages = [];
for (const path of packageFiles) {
  packages.push({ path, evidencePackage: validateEvidencePackage(JSON.parse(await readFile(path, "utf8"))) });
}

const prompts = await loadAssessmentPrompts();
const runtime = assessmentRuntimeConfig();
invariant(Number.isInteger(runtime.concurrency) && runtime.concurrency > 0 && runtime.concurrency <= 8, "SLIBY_ASSESSMENT_CONCURRENCY must be an integer from 1 to 8");
const { concurrency, ...assessmentRuntime } = runtime;
const plan = planAssessmentInputs({ packages, manifest, blockedPromiseIds, prompts, runtime: assessmentRuntime });
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
  assessmentItems.push(item);
}

const assessed = await mapWithConcurrency(assessmentItems, concurrency, async (item) => {
  const auditRecord = await runAssessment(item.path, runRoot);
  invariant(auditRecord.assessmentFingerprint === item.assessmentFingerprint, `Fingerprint changed while assessing ${item.promiseId}`);
  const relativeProposalDirectory = `automation/review-proposals/${item.promiseId}/${item.assessmentFingerprint}`;
  const proposalDirectory = resolve(relativeProposalDirectory);
  await mkdir(resolve(proposalRoot, item.promiseId), { recursive: true });
  await mkdir(proposalDirectory, { recursive: false });
  await writeFile(resolve(proposalDirectory, "evidence-package.json"), `${JSON.stringify(item.evidencePackage, null, 2)}\n`, { flag: "wx" });
  await writeFile(resolve(proposalDirectory, "assessment-run.json"), `${JSON.stringify(auditRecord, null, 2)}\n`, { flag: "wx" });
  const previousProposal = currentReviewProposal(manifest, item.promiseId);
  const proposal = createReviewProposal({
    auditRecord,
    proposalDirectory: relativeProposalDirectory,
    supersedesProposalId: previousProposal?.proposalId ?? null
  });
  await writeFile(resolve(proposalDirectory, "proposal.json"), `${JSON.stringify(proposal, null, 2)}\n`, { flag: "wx" });
  await writeFile(resolve(proposalDirectory, "review.md"), renderHumanReviewMarkdown({ evidencePackage: item.evidencePackage, auditRecord, proposal }), { flag: "wx" });
  return {
    proposal,
    result: {
      promiseId: item.promiseId,
      promiseTitleCz: item.evidencePackage.promise.titleCz,
      assessmentFingerprint: item.assessmentFingerprint,
      disposition: "assessed",
      resolutionState: auditRecord.resolution.state,
      candidateStatus: auditRecord.resolution.status,
      reviewUrl: humanReviewUrl(proposal.humanReviewPath)
    }
  };
});
for (const { proposal, result } of assessed) {
  newProposals.push(proposal);
  results.push(result);
}

const updatedManifest = addReviewProposals(manifest, newProposals);
await writeFile(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`);

const summary = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  publicationApproved: false,
  packageCount: plan.length,
  newProposalCount: newProposals.length,
  unchangedCount: results.filter(({ disposition }) => disposition === "unchanged").length,
  blockedCount: results.filter(({ disposition }) => disposition === "blocked-enrichment-warning").length,
  assessmentConcurrency: concurrency,
  proposalRoot: relativeProposalRoot,
  results
};
await mkdir(resolve(summaryPath, ".."), { recursive: true });
await mkdir(resolve(pullRequestBodyPath, ".."), { recursive: true });
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(pullRequestBodyPath, pullRequestBody(summary));

console.log(JSON.stringify({
  packageCount: summary.packageCount,
  newProposalCount: summary.newProposalCount,
  unchangedCount: summary.unchangedCount,
  blockedCount: summary.blockedCount,
  summaryPath,
  pullRequestBodyPath,
  publicationApproved: false
}, null, 2));
