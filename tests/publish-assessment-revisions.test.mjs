import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { assessmentRuntimeConfig, loadAssessmentPrompts } from "../scripts/lib/assessment-config.mjs";
import { hashEvidencePackage } from "../scripts/lib/assessment-pipeline.mjs";
import { describeAssessmentInput } from "../scripts/lib/assessment-review.mjs";
import { assessmentRevisionSchema } from "../src/lib/schema.ts";

const execute = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "..");
const script = resolve(repositoryRoot, "scripts/publish-assessment-revisions.mjs");
const promiseId = "spd-2025-079ef4aef5";
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJson = (path, data) => writeFile(path, `${JSON.stringify(data, null, 2)}\n`);

// A checkout of main and of the audit branch, made from a real candidate
// proposal (tests/fixtures/evidence-trail), its fingerprint renewed under the
// current prompts as an assessment run today would record it.
async function setUp() {
  const work = await mkdtemp(join(tmpdir(), "slava-publish-"));
  const main = join(work, "main");
  for (const path of ["data", "automation/prompts", "docs/scoring.md"]) await cp(resolve(repositoryRoot, path), join(main, path), { recursive: true });
  // The fixture proposal is revision 2 on main; it is published here again.
  await rm(join(main, `data/assessment-revisions/${promiseId}--002.json`));
  const fixture = resolve(repositoryRoot, "tests/fixtures/evidence-trail", promiseId);
  const [proposal, evidencePackage, auditRecord] = await Promise.all(["proposal", "evidence-package", "assessment-run"].map((name) => readJson(join(fixture, `${name}.json`))));
  const fingerprint = describeAssessmentInput(evidencePackage, await loadAssessmentPrompts(), assessmentRuntimeConfig()).assessmentFingerprint;
  const audit = join(work, "audit");
  const proposalPath = `automation/review-proposals/${promiseId}/${fingerprint}`;
  await mkdir(join(audit, proposalPath), { recursive: true });
  const renewed = { ...proposal, assessmentFingerprint: fingerprint, path: proposalPath, humanReviewPath: `${proposalPath}/review.md` };
  await writeJson(join(audit, proposalPath, "proposal.json"), renewed);
  await writeJson(join(audit, proposalPath, "evidence-package.json"), evidencePackage);
  await writeJson(join(audit, proposalPath, "assessment-run.json"), { ...auditRecord, assessmentFingerprint: fingerprint });
  await writeJson(join(audit, "automation/review-proposals/manifest.json"), { schemaVersion: "1.0.0", fingerprintVersion: "assessment-fingerprint-v1", publicationApproved: false, proposals: [renewed] });
  // A queue of current packages, each its own promise's: the candidate's, a
  // package both assessors failed on, one whose failure was retired, an
  // oversized one, and a withdrawn one.
  const prompts = await loadAssessmentPrompts();
  const packageOf = (id, generation = {}) => ({ ...evidencePackage, promise: { ...evidencePackage.promise, id }, generation: { ...evidencePackage.generation, ...generation } });
  const packages = [
    { evidencePackage },
    { evidencePackage: packageOf("failed-promise"), failure: true },
    { evidencePackage: packageOf("retired-promise"), failure: true, retired: true },
    { evidencePackage: packageOf("oversized-promise", { oversized: true }), blockedReason: "oversized" },
    { evidencePackage: packageOf("withdrawn-promise"), withdrawnAt: "2026-10-31T00:00:00Z" }
  ];
  const entries = [];
  for (const { evidencePackage: queued, failure, retired, blockedReason = null, withdrawnAt = null } of packages) {
    const id = queued.promise.id;
    const packageHash = hashEvidencePackage(queued);
    await mkdir(join(audit, "automation/evidence-packages/packages", id), { recursive: true });
    await writeJson(join(audit, "automation/evidence-packages/packages", id, `${packageHash}.json`), queued);
    entries.push({ promiseId: id, packageHash, asOf: queued.asOf, queuedAt: "2026-11-05T00:00:00.000Z", path: `packages/${id}/${packageHash}.json`, blockedReason, withdrawnAt, supersedesPackageHash: null, supersededByPackageHash: null });
    if (!failure) continue;
    const failurePath = `automation/review-proposals/failures/${id}/${describeAssessmentInput(queued, prompts, assessmentRuntimeConfig()).assessmentFingerprint}`;
    await mkdir(join(audit, failurePath), { recursive: true });
    await writeJson(join(audit, failurePath, "evidence-package.json"), queued);
    await writeJson(join(audit, failurePath, "assessment-run.json"), { ...auditRecord, promiseId: id, resolution: { state: "assessment-failed", reason: "both-assessors-invalid", status: null, selectedReview: null } });
    // A failure a newer proposal replaced counts for nothing.
    if (retired) await writeJson(join(audit, failurePath, "retired.json"), { schemaVersion: "1.0.0", reason: "superseded-by-newer-review-proposal" });
  }
  await writeJson(join(audit, "automation/evidence-packages/manifest.json"), { schemaVersion: "1.0.0", publicationApproved: false, packages: entries });
  return { work, main, audit, proposal: renewed, evidencePackage };
}

test("publishes a current candidate as the next revision, notices a failed assessment, and skips what is already published", async (t) => {
  const { work, main, audit, proposal, evidencePackage } = await setUp();
  t.after(() => rm(work, { recursive: true, force: true }));
  const publish = () => execute(process.execPath, [script, "--audit", audit, "--date", "2026-11-06", "--checked-at", "2026-11-06T12:00:00Z"], { cwd: main });
  const { stdout } = await publish();
  assert.match(stdout, /4 promises with a current package: 1 revisions written \(moving-towards 1\), 0 already published, 1 inconclusive \(notice\), 0 with insufficient evidence \(unchanged\), 2 not assessed yet/);
  const revision = await readJson(join(main, `data/assessment-revisions/${promiseId}--002.json`));
  assert.deepEqual(assessmentRevisionSchema.parse(revision), revision);
  assert.deepEqual([revision.revision, revision.status, revision.proposalId, revision.publishedAt], [2, proposal.candidateStatus, proposal.proposalId, "2026-11-06"]);
  const { notices } = await readJson(join(main, "data/assessment-notices.json"));
  assert.ok(notices.some((notice) => notice.promiseId === "failed-promise" && notice.kind === "inconclusive-assessment" && notice.asOf === evidencePackage.asOf));
  assert.ok(!notices.some((notice) => notice.promiseId === "retired-promise"));
  assert.ok(notices.some((notice) => notice.promiseId === "oversized-promise" && notice.kind === "too-much-evidence" && notice.lawChangeCount === evidencePackage.generation.lawChangeCount));
  // The run's check becomes the site's last check.
  assert.deepEqual(await readJson(join(main, "data/system-status.json")), { lastSuccessfulCollectionAt: "2026-11-06T12:00:00Z" });
  // A second pull request made from the same audit state writes nothing new.
  const again = await publish();
  assert.match(again.stdout, /0 revisions written \(\), 1 already published, 1 inconclusive/);
  // An earlier check never moves the last check back.
  await execute(process.execPath, [script, "--audit", audit, "--date", "2026-11-06", "--checked-at", "2026-11-05T12:00:00Z"], { cwd: main });
  assert.deepEqual(await readJson(join(main, "data/system-status.json")), { lastSuccessfulCollectionAt: "2026-11-06T12:00:00Z" });
});

test("a queue entry whose package belongs to another promise stops the publication before anything is written", async (t) => {
  const { work, main, audit } = await setUp();
  t.after(() => rm(work, { recursive: true, force: true }));
  const queuePath = join(audit, "automation/evidence-packages/manifest.json");
  const queue = await readJson(queuePath);
  const failed = queue.packages.find(({ promiseId: id }) => id === "failed-promise");
  failed.path = queue.packages.find(({ promiseId: id }) => id === promiseId).path;
  await writeJson(queuePath, queue);
  const notices = await readFile(join(main, "data/assessment-notices.json"), "utf8");
  await assert.rejects(execute(process.execPath, [script, "--audit", audit, "--date", "2026-11-06", "--checked-at", "2026-11-06T12:00:00Z"], { cwd: main }), /unexpected promise ID|has changed/);
  assert.equal(await readFile(join(main, "data/assessment-notices.json"), "utf8"), notices);
  await assert.rejects(readFile(join(main, `data/assessment-revisions/${promiseId}--002.json`)), { code: "ENOENT" });
});
