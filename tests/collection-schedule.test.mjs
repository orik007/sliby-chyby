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
  assert.match(workflow, /Persist source collection and queued evidence packages/);
  assert.match(workflow, /Queue enriched evidence packages/);
  assert.match(workflow, /--retry-blocked-queue automation\/evidence-packages/);
  assert.match(workflow, /--packages automation\/evidence-packages/);
  assert.match(workflow, /const collectorRun = JSON\.parse\(await readFile\("automation\/runs\/pipeline\/github-actions\/collector\/collector-run\.json", "utf8"\)\);/);
  assert.match(workflow, /collectorRun\.collectors\.map/);
  assert.doesNotMatch(workflow, /^      GH_TOKEN:/m);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /uses: actions\/checkout@v5\n        with:\n          ref: main/);
  assert.equal([...workflow.matchAll(/GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/g)].length, 5);
  assert.match(workflow, /- name: Restore current audit state[\s\S]*?env:\n          GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/);
  assert.match(workflow, /- name: Persist source collection and queued evidence packages[\s\S]*?env:\n          GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/);
  assert.match(workflow, /COLLECTOR_SOURCES: \$\{\{ inputs\.sources \|\| '' \}\}/);
  assert.match(workflow, /collector_args\+=\(--source "\$source_id"\)/);
  assert.match(workflow, /git push --force-with-lease="refs\/heads\/\$REVIEW_BRANCH:\$AUDIT_BRANCH_TIP" "https:\/\/x-access-token:\$\{GH_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git" "HEAD:refs\/heads\/\$REVIEW_BRANCH"/);
});

test("semantic retrieval ranks the whole public catalogue and limits paid assessment fan-out", async () => {
  const [matcher, assessmentBatch] = await Promise.all([readFile(matcherUrl, "utf8"), readFile(assessmentBatchUrl, "utf8")]);
  assert.match(matcher, /planPromiseEmbeddings\(\{ index: semanticIndex, promises: publishedRegistry\.promises \}\)/);
  assert.match(matcher, /promises: publishedRegistry\.promises,/);
  assert.match(matcher, /minimumSimilarity: runtime\.minimumSimilarity/);
  assert.match(assessmentBatch, /mapWithConcurrency\(assessmentItems, concurrency/);
  assert.match(assessmentBatch, /SLIBY_ASSESSMENT_CONCURRENCY must be an integer from 1 to 8/);
});

test("the audit branch is a current operational snapshot restored into main", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  assert.match(workflow, /authenticated_remote="https:\/\/x-access-token:\$\{GH_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git"/);
  assert.match(workflow, /git fetch "\$authenticated_remote" "\+refs\/heads\/\$REVIEW_BRANCH:refs\/remotes\/origin\/\$REVIEW_BRANCH"/);
  assert.match(workflow, /git restore --source="origin\/\$REVIEW_BRANCH" --staged --worktree/);
  assert.match(workflow, /\*\/README\.md\) ;;/);
  assert.match(workflow, /AUDIT_BRANCH_TIP=\$audit_branch_tip/);
  assert.match(workflow, /semantic-index/);
  assert.match(workflow, /evidence-packages/);
  assert.match(workflow, /git push --force-with-lease="refs\/heads\/\$REVIEW_BRANCH:\$AUDIT_BRANCH_TIP"/);
  assert.match(workflow, /git add automation\/collectors\/checkpoints\.json automation\/evidence-packages automation\/semantic-index/);
  assert.doesNotMatch(workflow, /git merge --no-ff --no-commit/);
  assert.doesNotMatch(workflow, /git switch --force-create "\$REVIEW_BRANCH"/);
  assert.match(workflow, /could not create the required review pull request/);
});

test("collection and packages create a missing audit pull request without overwriting its review body", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const packagesStep = workflow.split("      - name: Create audit pull request for saved collection and packages when needed")[1].split("      - name: Assess only new or changed packages")[0];
  assert.match(packagesStep, /if \[ -z "\$PR_NUMBER" \]; then/);
  assert.match(packagesStep, /gh pr create/);
  assert.doesNotMatch(packagesStep, /gh pr edit/);
});

test("checkpoints persist only after matching and queuing packages", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const matching = workflow.indexOf("      - name: Match records to every confirmed promise");
  const queueing = workflow.indexOf("      - name: Queue enriched evidence packages");
  const persistence = workflow.indexOf("      - name: Persist source collection and queued evidence packages");
  assert.ok(matching >= 0 && matching < queueing && queueing < persistence);
  assert.equal(workflow.includes("Persist successful source checkpoints"), false);
});

test("the public fallback records a valid successful collection time", async () => {
  const status = JSON.parse(await readFile(statusUrl, "utf8"));
  assert.equal(typeof status.lastSuccessfulCollectionAt, "string");
  assert.equal(Number.isNaN(Date.parse(status.lastSuccessfulCollectionAt)), false);
});
