import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { validateReviewManifest } from "./lib/assessment-review.mjs";
import { createAssessmentRevision } from "./lib/evidence-trail.mjs";
import { assessmentRevisionSchema } from "../src/lib/schema.ts";

// Usage: node scripts/create-assessment-revision.mjs --proposal <proposal directory> --date YYYY-MM-DD
// The proposal directory is one reviewed proposal from the audit branch
// (automation/review-proposals/<promise>/<fingerprint>), next to the review
// manifest that records whether it is superseded.
const { values } = parseArgs({ options: { proposal: { type: "string" }, date: { type: "string" } } });
if (!values.proposal || !values.date) throw new Error("Usage: --proposal <proposal directory> --date YYYY-MM-DD");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readJsonDirectory = async (directory) => {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => ({ file, data: await readJson(resolve(directory, file)) })));
};
const proposalDirectory = resolve(values.proposal);
const [manifest, proposal, evidencePackage, auditRecord, promiseFiles, revisionFiles] = await Promise.all([
  readJson(resolve(dirname(dirname(proposalDirectory)), "manifest.json")).then(validateReviewManifest),
  readJson(resolve(proposalDirectory, "proposal.json")),
  readJson(resolve(proposalDirectory, "evidence-package.json")),
  readJson(resolve(proposalDirectory, "assessment-run.json")),
  readJsonDirectory(resolve("data/promises")),
  readJsonDirectory(resolve("data/assessment-revisions"))
]);
const promiseFile = promiseFiles.find(({ data }) => data.id === proposal.promiseId);
if (!promiseFile) throw new Error(`Unknown promise ${proposal.promiseId}`);
const revision = createAssessmentRevision({
  proposal,
  manifestProposal: manifest.proposals.find(({ proposalId }) => proposalId === proposal.proposalId),
  evidencePackage,
  auditRecord,
  promise: promiseFile.data,
  fileId: basename(promiseFile.file, ".json"),
  revisions: revisionFiles.map(({ data }) => data),
  publishedAt: values.date
});
// Check the public schema before anything is written.
assessmentRevisionSchema.parse(revision);
const path = resolve("data/assessment-revisions", `${revision.id}.json`);
await writeFile(path, `${JSON.stringify(revision, null, 2)}\n`, { flag: "wx" });
console.log(`Wrote ${path}`);
