import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/collect-evidence.yml", import.meta.url);
const statusUrl = new URL("../data/system-status.json", import.meta.url);
const matcherUrl = new URL("../scripts/run-matcher.mjs", import.meta.url);
const assessmentBatchUrl = new URL("../scripts/run-assessment-batch.mjs", import.meta.url);

test("full evidence collection is scheduled daily at 09:37 Prague time", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  assert.match(workflow, /cron: "37 9 \* \* \*"/);
  assert.match(workflow, /timezone: "Europe\/Prague"/);
  assert.match(workflow, /--checkpoints automation\/collectors\/checkpoints\.json/);
  assert.match(workflow, /--write-checkpoints automation\/collectors\/checkpoints\.json/);
  assert.match(workflow, /--semantic-index automation\/semantic-index\/promise-index\.json/);
  assert.match(workflow, /--write-semantic-index automation\/semantic-index\/promise-index\.json/);
  assert.match(workflow, /SLIBY_SEMANTIC_CANDIDATE_LIMIT: 3/);
  assert.match(workflow, /SLIBY_SEMANTIC_MIN_SIMILARITY: 0\.55/);
  assert.match(workflow, /reconcile-evidence-package-queue\.mjs --queue automation\/evidence-packages/);
  assert.match(workflow, /SLIBY_ASSESSMENT_CONCURRENCY: 4/);
  assert.match(workflow, /timeout-minutes: 90/);
  assert.match(workflow, /Persist successful source checkpoints/);
  assert.match(workflow, /Queue enriched evidence packages/);
  assert.match(workflow, /--retry-blocked-queue automation\/evidence-packages/);
  assert.match(workflow, /--packages automation\/evidence-packages/);
  assert.match(workflow, /const collectorRun = JSON\.parse\(await readFile\("automation\/runs\/pipeline\/github-actions\/collector\/collector-run\.json", "utf8"\)\);/);
  assert.match(workflow, /collectorRun\.collectors\.map/);
  assert.doesNotMatch(workflow, /^      GH_TOKEN:/m);
  assert.match(workflow, /persist-credentials: false/);
  assert.equal([...workflow.matchAll(/GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/g)].length, 6);
  assert.match(workflow, /- name: Persist successful source checkpoints[\s\S]*?env:\n          GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/);
  assert.match(workflow, /- name: Create audit pull request for collection when needed[\s\S]*?env:\n          GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/);
  assert.match(workflow, /git push "https:\/\/x-access-token:\$\{GH_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git" "HEAD:refs\/heads\/\$REVIEW_BRANCH"/);
});

test("semantic retrieval ranks the whole public catalogue and limits paid assessment fan-out", async () => {
  const [matcher, assessmentBatch] = await Promise.all([readFile(matcherUrl, "utf8"), readFile(assessmentBatchUrl, "utf8")]);
  assert.match(matcher, /planPromiseEmbeddings\(\{ index: semanticIndex, promises: publishedRegistry\.promises \}\)/);
  assert.match(matcher, /promises: publishedRegistry\.promises,/);
  assert.match(matcher, /minimumSimilarity: runtime\.minimumSimilarity/);
  assert.match(assessmentBatch, /mapWithConcurrency\(assessmentItems, concurrency/);
  assert.match(assessmentBatch, /SLIBY_ASSESSMENT_CONCURRENCY must be an integer from 1 to 8/);
});

test("the durable audit branch retains every operational audit tree when syncing main", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  assert.match(workflow, /git merge-base --is-ancestor "\$GITHUB_SHA" HEAD/);
  assert.match(workflow, /git fetch origin "\+refs\/heads\/\$REVIEW_BRANCH:refs\/remotes\/origin\/\$REVIEW_BRANCH"/);
  assert.match(workflow, /git switch --force-create "\$REVIEW_BRANCH" "origin\/\$REVIEW_BRANCH"/);
  assert.match(workflow, /The durable review branch was not initialized from its fetched remote tip/);
  assert.match(workflow, /git merge --no-ff --no-commit/);
  assert.match(workflow, /semantic-index/);
  assert.match(workflow, /evidence-packages/);
  assert.match(workflow, /git merge --abort/);
  assert.match(workflow, /git push "https:\/\/x-access-token:\$\{GH_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git" "HEAD:refs\/heads\/\$REVIEW_BRANCH"/);
  assert.match(workflow, /git add automation\/collectors\/checkpoints\.json/);
  assert.match(workflow, /git merge-base --is-ancestor "origin\/\$REVIEW_BRANCH" HEAD/);
  assert.match(workflow, /The checkpoint commit diverged from the audit branch outside the checkpoint file/);
  assert.match(workflow, /git restore --source=HEAD --staged --worktree -- automation\/collectors\/checkpoints\.json/);
  assert.match(workflow, /git add automation\/evidence-packages automation\/semantic-index/);
  assert.match(workflow, /could not create the required review pull request/);
});

test("early audit persistence creates a missing pull request without overwriting its review body", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const collectionStep = workflow.split("      - name: Create audit pull request for collection when needed")[1].split("      - name: Match records")[0];
  const packagesStep = workflow.split("      - name: Create audit pull request for evidence packages when needed")[1].split("      - name: Assess only new or changed packages")[0];
  for (const step of [collectionStep, packagesStep]) {
    assert.match(step, /if \[ -z "\$PR_NUMBER" \]; then/);
    assert.match(step, /gh pr create/);
    assert.doesNotMatch(step, /gh pr edit/);
  }
});

test("the public fallback records a valid successful collection time", async () => {
  const status = JSON.parse(await readFile(statusUrl, "utf8"));
  assert.equal(typeof status.lastSuccessfulCollectionAt, "string");
  assert.equal(Number.isNaN(Date.parse(status.lastSuccessfulCollectionAt)), false);
});
