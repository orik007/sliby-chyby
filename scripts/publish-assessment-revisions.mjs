import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { validateReviewManifest } from "./lib/assessment-review.mjs";
import { noticesAfterPublication, planAssessmentPublication } from "./lib/assessment-publication.mjs";
import { createAssessmentRevision } from "./lib/evidence-trail.mjs";
import { assessmentNoticeDataSchema, assessmentRevisionSchema } from "../src/lib/schema.ts";

// Usage: node scripts/publish-assessment-revisions.mjs --audit <audit branch checkout> --date YYYY-MM-DD
//
// Publishes the automatic assessment (docs/evidence-pipeline.md, From
// proposal to public score): for every promise whose evidence package is
// current on the audit branch, its current candidate proposal becomes an
// append-only public revision, as the model wrote it; a current proposal that
// finds the evidence insufficient changes nothing; any other current
// proposal, which no assessment decided, gets an `inconclusive-assessment`
// notice and leaves the score unchanged. A promise whose packages are all withdrawn
// (no law change of it is relevant any longer) or superseded has no current
// proposal here and keeps its score. Every revision is checked against the
// public schema before anything is written.
const { values } = parseArgs({ options: { audit: { type: "string" }, date: { type: "string" } } });
if (!values.audit || !values.date) throw new Error("Usage: --audit <audit branch checkout> --date YYYY-MM-DD");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readJsonDirectory = async (directory) => {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => ({ file, data: await readJson(resolve(directory, file)) })));
};

const audit = resolve(values.audit);
const [manifest, queue, promiseFiles, revisionFiles, noticeData] = await Promise.all([
  readJson(resolve(audit, "automation/review-proposals/manifest.json")).then(validateReviewManifest),
  readJson(resolve(audit, "automation/evidence-packages/manifest.json")),
  readJsonDirectory(resolve("data/promises")),
  readJsonDirectory(resolve("data/assessment-revisions")),
  readJson(resolve("data/assessment-notices.json")).then((data) => assessmentNoticeDataSchema.parse(data))
]);

const plan = planAssessmentPublication({ reviewManifest: manifest, packageQueue: queue });
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
const notices = noticesAfterPublication({ notices: noticeData.notices, inconclusive, renewedPromiseIds: written.map(({ promiseId }) => promiseId) });
assessmentNoticeDataSchema.parse({ notices });

for (const revision of written) await writeFile(resolve("data/assessment-revisions", `${revision.id}.json`), `${JSON.stringify(revision, null, 2)}\n`, { flag: "wx" });
await writeFile(resolve("data/assessment-notices.json"), `${JSON.stringify({ notices }, null, 2)}\n`);
const byStatus = Object.entries(Object.groupBy(written, ({ status }) => status)).map(([status, group]) => `${status} ${group.length}`).join(", ");
console.log(`${plan.candidates.length + plan.inconclusive.length + plan.insufficientEvidence.length} current proposals: ${written.length} revisions written (${byStatus}), ${plan.inconclusive.length} inconclusive (notice), ${plan.insufficientEvidence.length} with insufficient evidence (unchanged)`);
