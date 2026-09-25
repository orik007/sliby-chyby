import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

// One real Chamber print (tisk 189, the revenue-registration bill) taken from
// the collector and print-text runs of 25 September 2026: its six law
// changes with their proposed, approved, and passed texts, the Senate's
// resolution, the three attributable records (the government's submission,
// the third-reading approval, and the vote insisting on the bill after the
// Senate's return), and two records that cannot be attributable conduct. The
// pipeline scripts run as in the workflow, with a deterministic stand-in for
// the model provider (tests/fixtures/stub-openai.mjs).
const repositoryRoot = resolve(import.meta.dirname, "..");
const fixtures = resolve(repositoryRoot, "tests/fixtures/pipeline");
const stub = resolve(repositoryRoot, "tests/fixtures/stub-openai.mjs");
const script = (name) => resolve(repositoryRoot, "scripts", name);
const vatPromiseId = "ano-2025-restaurant-nonalcoholic-vat-12";
const dissentingModel = "stub-dissenting-model";

async function run(args, { cwd = repositoryRoot, environment = {} } = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    // Only these settings reach the scripts: no key, network, or workflow
    // setting of the machine running the tests.
    env: { PATH: process.env.PATH, OPENAI_API_KEY: "stub", ...environment },
    stdio: "pipe"
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", resolveExit);
  });
  assert.equal(code, 0, stderr);
  return { stdout, stderr };
}

async function modelCalls(path) {
  try {
    return (await readFile(path, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("one real print runs through routing, packaging, assessment, and the review report", { timeout: 240_000 }, async () => {
  const work = await mkdtemp(join(tmpdir(), "slava-pipeline-"));
  const routingOutput = join(work, "routing");
  const routingArgs = (output, log) => [["--import", stub, script("run-topic-routing.mjs"),
    "--collector-run", join(fixtures, "collector-run.json"),
    "--print-parts", join(fixtures, "print-parts.json"),
    "--tag-cache", join(work, "tag-cache"),
    "--as-of", "2026-09-25",
    "--output", output].flat(), { environment: { STUB_OPENAI_LOG: log } }];

  // Routing: screening, relevance checks, and packages.
  await run(...routingArgs(routingOutput, join(work, "routing-calls.jsonl")));
  const report = await readJson(join(routingOutput, "topic-routing-report.json"));
  assert.equal(report.completed, true);
  assert.deepEqual({
    records: report.counts.sourceRecordCount,
    skipped: report.counts.notAttributableSkippedCount,
    conduct: report.counts.conductRecordCount,
    lawChanges: report.counts.lawChangeCount,
    technical: report.counts.technicalLawChangeCount,
    routed: report.counts.routedLawChangeCount,
    directLinks: report.counts.directLinkLawChangeCount,
    packages: report.counts.packageCount,
    invalid: report.counts.invalidScreenerCount + report.counts.invalidRelevanceCheckCount + report.counts.invalidPromiseTaggerCount
  }, { records: 5, skipped: 2, conduct: 3, lawChanges: 6, technical: 1, routed: 1, directLinks: 1, packages: 2, invalid: 0 });

  // Only the value-added tax law change reaches promises: through the act it
  // amends, which the VAT tag maps, to the promises tagged with it.
  const packageFiles = (await readdir(join(routingOutput, "evidence-packages"))).sort();
  assert.equal(packageFiles.length, 2);
  const packages = await Promise.all(packageFiles.map((file) => readJson(join(routingOutput, "evidence-packages", file))));
  const vatPackage = packages.find(({ promise }) => promise.id === vatPromiseId);
  assert.ok(vatPackage, `a package for ${vatPromiseId}`);
  for (const evidencePackage of packages) {
    const lawChanges = evidencePackage.evidence.filter(({ role }) => role === "law-change");
    assert.deepEqual(lawChanges.map(({ structuredFacts }) => structuredFacts.changeId), ["43310-3"]);
    assert.deepEqual(lawChanges[0].matchBasis.directLinkIdentifiers, ["cz-act-235-2004"]);
    // The technical part (the effective date) and the records that cannot be
    // conduct are in no package.
    const ids = evidencePackage.evidence.map(({ id }) => id);
    assert.ok(!ids.includes("psp-core-2025--law-change-43310-6"));
    assert.ok(!ids.includes("psp-core-2025--print-step-211391") && !ids.includes("psp-core-2025--vote-87641"));
  }

  // The law change carries each version, with the passed text stored as the
  // approved one it re-adopted, and the Senate resolution once.
  const [vatChange] = vatPackage.evidence.filter(({ role }) => role === "law-change");
  assert.deepEqual(Object.keys(vatChange.structuredFacts.versions), ["proposed", "approved", "passed"]);
  assert.equal(vatChange.structuredFacts.versions.passed.sameAs, "approved");
  const resolutions = vatPackage.evidence.filter(({ role }) => role === "senate-resolution");
  assert.equal(resolutions.length, 1);
  assert.deepEqual(vatChange.structuredFacts.senateResolutionEvidenceIds, [resolutions[0].id]);

  // Each conduct is attributed to the party and concerns the version it decided on.
  const conduct = Object.fromEntries(vatPackage.evidence.filter(({ role }) => role === "conduct-evidence").map((item) => [item.id, item]));
  assert.deepEqual(Object.keys(conduct).sort(), ["psp-core-2025--print-step-211390", "psp-core-2025--vote-88356", "psp-core-2025--vote-88456"]);
  const concern = (id) => conduct[id].structuredFacts.concernsLawChanges[0];
  assert.equal(conduct["psp-core-2025--print-step-211390"].matchBasis.attributionStatus, "verified-government-proposal");
  assert.equal(concern("psp-core-2025--print-step-211390").version, "proposed");
  assert.equal(conduct["psp-core-2025--vote-88356"].matchBasis.attributionStatus, "verified-party-vote");
  assert.equal(conduct["psp-core-2025--vote-88356"].structuredFacts.relevantPartyVoteSummary.majorityChoice, "yes");
  assert.deepEqual([concern("psp-core-2025--vote-88356").version, concern("psp-core-2025--vote-88356").withSenateResolution], ["approved", false]);
  assert.deepEqual([concern("psp-core-2025--vote-88456").version, concern("psp-core-2025--vote-88456").withSenateResolution], ["passed", true]);

  // A rerun pays for nothing: every model result is cached.
  await run(...routingArgs(join(work, "routing-again"), join(work, "routing-again-calls.jsonl")));
  assert.equal((await modelCalls(join(work, "routing-again-calls.jsonl"))).length, 0);

  // Queue the packages in an audit-branch checkout with the published scores.
  const root = join(work, "audit");
  await mkdir(join(root, "automation/review-proposals"), { recursive: true });
  await cp(join(repositoryRoot, "automation/prompts"), join(root, "automation/prompts"), { recursive: true });
  await cp(join(repositoryRoot, "automation/model-prices.json"), join(root, "automation/model-prices.json"));
  await cp(join(repositoryRoot, "automation/review-proposals/manifest.json"), join(root, "automation/review-proposals/manifest.json"));
  await cp(join(repositoryRoot, "data/assessment-revisions"), join(root, "data/assessment-revisions"), { recursive: true });
  await run([script("queue-evidence-packages.mjs"), "--input", join(routingOutput, "evidence-packages"), "--queue", join(root, "automation/evidence-packages")]);

  // Assessment with the real runner: the assessors disagree, so the arbiter decides.
  const assessmentEnvironment = (log) => ({
    NODE_OPTIONS: `--import ${stub}`,
    SLIBY_ASSESSMENT_RUNNER: script("run-assessment.mjs"),
    SLIBY_MAX_ASSESSMENTS: "5",
    SLIBY_ASSESSOR_MODEL_B: dissentingModel,
    STUB_OPENAI_DISSENTING_MODEL: dissentingModel,
    STUB_OPENAI_LOG: log
  });
  await run([script("run-assessment-batch.mjs"), "--packages", "automation/evidence-packages"], { cwd: root, environment: assessmentEnvironment(join(work, "assessment-calls.jsonl")) });
  const calls = await modelCalls(join(work, "assessment-calls.jsonl"));
  assert.deepEqual(calls.map(({ name }) => name).sort(), ["slava_arbitration", "slava_arbitration", "slava_assessment", "slava_assessment", "slava_assessment", "slava_assessment"]);
  // Each model reads only its own package.
  for (const call of calls) assert.ok(packages.some(({ packageId }) => packageId === call.input.evidencePackage.packageId));

  const summary = await readJson(join(root, "automation/runs/pipeline/github-actions/assessment-batch.json"));
  assert.equal(summary.newProposalCount, 2);
  assert.equal(summary.scoreChangeCount, 2);
  const manifest = await readJson(join(root, "automation/review-proposals/manifest.json"));
  const vatProposal = manifest.proposals.find(({ promiseId }) => promiseId === vatPromiseId);
  assert.deepEqual([vatProposal.resolutionState, vatProposal.resolutionReason, vatProposal.candidateStatus, vatProposal.publicationApproved], ["candidate", "arbiter-selection", "moving-towards", false]);
  const review = await readFile(join(root, vatProposal.humanReviewPath), "utf8");
  assert.match(review, /### Odlišné posudky/);
  assert.match(review, /### Rozhodnutí třetího hodnotitele/);

  // The review report lists the change against the public score.
  const body = await readFile(join(root, "automation/runs/pipeline/github-actions/assessment-review-pr.md"), "utf8");
  assert.match(body, /### Návrhy, které mění hodnocení na webu \(2, z toho nové: 2\)/);
  assert.match(body, new RegExp(`\\(\`${vatPromiseId}\`\\)\\n\\nNa webu: \\*\\*Zatím bez ověřeného podstatného posunu \\(0\\)\\*\\* → navrženo: \\*\\*Směřuje ke splnění \\(\\+1\\)\\*\\*`));

  // A rerun of the assessment makes no call and keeps the proposals listed.
  await run([script("run-assessment-batch.mjs"), "--packages", "automation/evidence-packages"], { cwd: root, environment: assessmentEnvironment(join(work, "assessment-again-calls.jsonl")) });
  assert.equal((await modelCalls(join(work, "assessment-again-calls.jsonl"))).length, 0);
  const rerun = await readJson(join(root, "automation/runs/pipeline/github-actions/assessment-batch.json"));
  assert.deepEqual([rerun.newProposalCount, rerun.unchangedCount, rerun.scoreChangeCount], [0, 2, 2]);

  // The coverage audit accounts for every promise and never infers a score.
  await run([script("run-coverage-audit.mjs"),
    "--collector-run", join(fixtures, "collector-run.json"),
    "--topic-routing-run", join(routingOutput, "topic-routing-report.json"),
    "--print-parts", join(fixtures, "print-parts.json"),
    "--proposals", join(root, "automation/review-proposals/manifest.json"),
    "--output", join(work, "coverage-audit.json"),
    "--markdown", join(work, "coverage-audit.md")]);
  const audit = await readJson(join(work, "coverage-audit.json"));
  assert.equal(audit.promises.length, audit.promiseCount);
  assert.equal(audit.stateCounts["review-candidate"], 2);
  assert.equal(audit.stateCounts["no-routed-law-change"], audit.promiseCount - 2);
  assert.ok(audit.promises.every(({ scoreInferred, publicationApproved }) => scoreInferred === false && publicationApproved === false));
});
