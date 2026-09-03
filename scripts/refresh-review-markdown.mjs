import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderHumanReviewMarkdown, validateReviewManifest } from "./lib/assessment-review.mjs";

const manifestPath = resolve("automation/review-proposals/manifest.json");
const manifest = validateReviewManifest(JSON.parse(await readFile(manifestPath, "utf8")));
let refreshed = 0;

for (const manifestProposal of manifest.proposals) {
  if (!manifestProposal.humanReviewPath) continue;
  const proposalDirectory = resolve(manifestProposal.path);
  const [evidencePackage, auditRecord, proposal] = await Promise.all([
    readFile(resolve(proposalDirectory, "evidence-package.json"), "utf8").then(JSON.parse),
    readFile(resolve(proposalDirectory, "assessment-run.json"), "utf8").then(JSON.parse),
    readFile(resolve(proposalDirectory, "proposal.json"), "utf8").then(JSON.parse)
  ]);
  if (proposal.proposalId !== manifestProposal.proposalId) {
    throw new Error(`Review proposal mismatch for ${manifestProposal.proposalId}`);
  }
  await writeFile(
    resolve(manifestProposal.humanReviewPath),
    renderHumanReviewMarkdown({ evidencePackage, auditRecord, proposal })
  );
  refreshed += 1;
}

console.log(`Refreshed ${refreshed} human review files.`);
