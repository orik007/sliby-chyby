import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { assessmentRuntimeConfig, loadAssessmentPrompts } from "./lib/assessment-config.mjs";
import { describeAssessmentInput, validateReviewManifest } from "./lib/assessment-review.mjs";
import { noticesAfterPublication, planAssessmentPublication } from "./lib/assessment-publication.mjs";
import { loadCurrentEvidencePackages } from "./lib/evidence-package-queue.mjs";
import { createAssessmentRevision } from "./lib/evidence-trail.mjs";
import { assessmentNoticeDataSchema, assessmentRevisionSchema, systemStatusSchema } from "../src/lib/schema.ts";

// Usage: node scripts/publish-assessment-revisions.mjs --audit <audit branch checkout> --date YYYY-MM-DD
//   --checked-at <ISO date-time of the run's successful check>
//
// Publishes the automatic assessment (docs/evidence-pipeline.md, From
// proposal to public score), as planned by scripts/lib/assessment-publication.mjs:
// the assessment of every promise's current package (the proposal, or the
// failure of both assessors, with that package's fingerprint) is a candidate,
// which becomes an append-only public revision as the model wrote it, finds
// the evidence insufficient, which changes nothing, or decided nothing, which
// leaves the score unchanged with an `inconclusive-assessment` notice. A
// promise without a current package, or whose current package is not
// assessed yet, keeps its score. A proposal already published is skipped.
// Every revision is checked against the public schema before anything is
// written. The time of the run's successful check becomes the site's
// "last check" (data/system-status.json), unless that is already later.
const { values } = parseArgs({ options: { audit: { type: "string" }, date: { type: "string" }, "checked-at": { type: "string" } } });
if (!values.audit || !values.date || !values["checked-at"]) throw new Error("Usage: --audit <audit branch checkout> --date YYYY-MM-DD --checked-at <ISO date-time>");
const checkedStatus = systemStatusSchema.parse({ lastSuccessfulCollectionAt: values["checked-at"] });

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readJsonDirectory = async (directory) => {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => ({ file, data: await readJson(resolve(directory, file)) })));
};

const audit = resolve(values.audit);
const [manifest, currentPackages, promiseFiles, revisionFiles, noticeData, currentStatus] = await Promise.all([
  readJson(resolve(audit, "automation/review-proposals/manifest.json")).then(validateReviewManifest),
  // The queue is validated and each current package checked against its
  // entry (promise and hash), as the assessment batch loads them.
  loadCurrentEvidencePackages(resolve(audit, "automation/evidence-packages")),
  readJsonDirectory(resolve("data/promises")),
  readJsonDirectory(resolve("data/assessment-revisions")),
  readJson(resolve("data/assessment-notices.json")).then((data) => assessmentNoticeDataSchema.parse(data)),
  readJson(resolve("data/system-status.json")).then((data) => systemStatusSchema.parse(data))
]);

// The assessment fingerprint of each promise's current package, as the
// assessment batch computes it.
const prompts = await loadAssessmentPrompts();
const runtime = assessmentRuntimeConfig();
const currentFingerprints = new Map();
const oversizedPackages = new Map();
for (const { evidencePackage, blockedReason } of currentPackages) {
  const promiseId = evidencePackage.promise.id;
  currentFingerprints.set(promiseId, describeAssessmentInput(evidencePackage, prompts, runtime).assessmentFingerprint);
  if (blockedReason === "oversized") oversizedPackages.set(promiseId, evidencePackage);
}
// Failures of both assessors, saved outside the review manifest under the
// fingerprint they assessed.
const failureRoot = resolve(audit, "automation/review-proposals/failures");
const failures = [];
if (existsSync(failureRoot)) {
  for (const promiseId of await readdir(failureRoot)) {
    for (const assessmentFingerprint of await readdir(resolve(failureRoot, promiseId))) {
      const path = `automation/review-proposals/failures/${promiseId}/${assessmentFingerprint}`;
      // A failure a newer proposal replaced is retired and no longer counts.
      if (!existsSync(resolve(audit, path, "retired.json"))) failures.push({ promiseId, assessmentFingerprint, path });
    }
  }
}
const plan = planAssessmentPublication({ reviewManifest: manifest, currentFingerprints, failures });
const promiseFileById = new Map(promiseFiles.map(({ file, data }) => [data.id, { file, data }]));
const revisions = revisionFiles.map(({ data }) => data);

const written = [];
const published = new Set(revisions.map(({ proposalId }) => proposalId).filter(Boolean));
for (const entry of plan.candidates) {
  // A proposal an earlier pull request already published stays as it is.
  if (published.has(entry.proposalId)) continue;
  const promiseFile = promiseFileById.get(entry.promiseId);
  if (!promiseFile) throw new Error(`Unknown promise ${entry.promiseId}`);
  const directory = resolve(audit, entry.path);
  const [proposal, evidencePackage, auditRecord] = await Promise.all(["proposal.json", "evidence-package.json", "assessment-run.json"].map((name) => readJson(resolve(directory, name))));
  const revision = createAssessmentRevision({ proposal, manifestProposal: entry, evidencePackage, auditRecord, promise: promiseFile.data, fileId: basename(promiseFile.file, ".json"), revisions, publishedAt: values.date });
  assessmentRevisionSchema.parse(revision);
  revisions.push(revision);
  written.push(revision);
}
const inconclusive = await Promise.all(plan.inconclusive.map(async (entry) => ({ promiseId: entry.promiseId, kind: "inconclusive-assessment", asOf: (await readJson(resolve(audit, entry.path, "evidence-package.json"))).asOf })));
// A current package too large for the models even without context, which no
// assessment has, gets the too-much-evidence notice from that package.
const tooMuchEvidence = plan.notAssessed.filter(({ promiseId }) => oversizedPackages.has(promiseId)).map(({ promiseId }) => {
  const evidencePackage = oversizedPackages.get(promiseId);
  return { promiseId, kind: "too-much-evidence", asOf: evidencePackage.asOf, lawChangeCount: evidencePackage.generation.lawChangeCount };
});
const notices = noticesAfterPublication({ notices: noticeData.notices, inconclusive, tooMuchEvidence, assessedPromiseIds: [...plan.candidates, ...plan.insufficientEvidence].map(({ promiseId }) => promiseId) });
assessmentNoticeDataSchema.parse({ notices });

for (const revision of written) await writeFile(resolve("data/assessment-revisions", `${revision.id}.json`), `${JSON.stringify(revision, null, 2)}\n`, { flag: "wx" });
await writeFile(resolve("data/assessment-notices.json"), `${JSON.stringify({ notices }, null, 2)}\n`);
if (Date.parse(checkedStatus.lastSuccessfulCollectionAt) > Date.parse(currentStatus.lastSuccessfulCollectionAt)) await writeFile(resolve("data/system-status.json"), `${JSON.stringify(checkedStatus, null, 2)}\n`);
const byStatus = Object.entries(Object.groupBy(written, ({ status }) => status)).map(([status, group]) => `${status} ${group.length}`).join(", ");
console.log(`${currentFingerprints.size} promises with a current package: ${written.length} revisions written (${byStatus}), ${plan.candidates.length - written.length} already published, ${plan.inconclusive.length} inconclusive (notice), ${plan.insufficientEvidence.length} with insufficient evidence (unchanged), ${plan.notAssessed.length} not assessed yet`);
