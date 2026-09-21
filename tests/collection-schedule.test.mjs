import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/collect-evidence.yml", import.meta.url);
const statusUrl = new URL("../data/system-status.json", import.meta.url);
const assessmentBatchUrl = new URL("../scripts/run-assessment-batch.mjs", import.meta.url);

test("full evidence collection routes via topic tags and keeps the daily schedule paused pending its first verified run", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  // The daily cron stays commented out until a manual run of this exact
  // (now topic-routing-based) workflow has been verified; it is not deleted,
  // so re-enabling it later is a one-line change.
  assert.match(workflow, /# {3}- cron: "37 9 \* \* \*"/);
  assert.match(workflow, /# {5}timezone: "Europe\/Prague"/);
  assert.match(workflow, /--checkpoints automation\/collectors\/checkpoints\.json/);
  assert.match(workflow, /--write-checkpoints automation\/collectors\/checkpoints\.json/);
  assert.match(workflow, /node scripts\/run-topic-routing\.mjs/);
  assert.match(workflow, /--tag-cache automation\/topic-routing\/tag-cache/);
  assert.match(workflow, /SLIBY_TAGGING_CONCURRENCY: \$\{\{ inputs\.tagging_concurrency \|\| '1' \}\}/);
  assert.match(workflow, /SLIBY_ASSESSMENT_CONCURRENCY: 4/);
  assert.match(workflow, /timeout-minutes: 90/);
  assert.match(workflow, /Persist source collection and queued evidence packages/);
  assert.match(workflow, /Queue enriched evidence packages/);
  assert.match(workflow, /--retry-blocked-queue automation\/evidence-packages/);
  assert.match(workflow, /--packages automation\/evidence-packages/);
  assert.match(workflow, /--topic-routing-run automation\/runs\/pipeline\/github-actions\/topic-routing\/topic-routing-report\.json/);
  assert.match(workflow, /const collectorRun = JSON\.parse\(await readFile\("automation\/runs\/pipeline\/github-actions\/collector\/collector-run\.json", "utf8"\)\);/);
  assert.match(workflow, /collectorRun\.collectors\.map/);
  // The old exact-signal/semantic matcher and its similarity-threshold
  // reconciliation step are retired, not merely unused: topic-routing is the
  // sole live routing mechanism per docs/evidence-pipeline.md.
  assert.doesNotMatch(workflow, /run-matcher\.mjs/);
  assert.doesNotMatch(workflow, /reconcile-evidence-package-queue\.mjs/);
  assert.doesNotMatch(workflow, /SLIBY_SEMANTIC_/);
  assert.doesNotMatch(workflow, /automation\/semantic-index/);
  assert.doesNotMatch(workflow, /^      GH_TOKEN:/m);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /uses: actions\/checkout@v5\n        with:\n          ref: main/);
  assert.equal([...workflow.matchAll(/GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/g)].length, 5);
  assert.match(workflow, /- name: Restore current audit state[\s\S]*?env:\n          GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/);
  assert.match(workflow, /- name: Persist source collection and queued evidence packages[\s\S]*?env:\n          GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/);
  assert.match(workflow, /COLLECTOR_SOURCES: \$\{\{ inputs\.sources \|\| '' \}\}/);
  assert.match(workflow, /source_id="\$\{source_id#"\$\{source_id%%\[!\[:space:\]\]\*\}"\}"/);
  assert.match(workflow, /source_id="\$\{source_id%"\$\{source_id##\*\[!\[:space:\]\]\}"\}"/);
  assert.match(workflow, /COLLECTOR_SOURCES must contain comma-separated source IDs/);
  assert.match(workflow, /collector_args\+=\(--source "\$source_id"\)/);
  assert.match(workflow, /git push --force-with-lease="refs\/heads\/\$REVIEW_BRANCH:\$AUDIT_BRANCH_TIP" "https:\/\/x-access-token:\$\{GH_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git" "HEAD:refs\/heads\/\$REVIEW_BRANCH"/);
});

test("assessment fan-out stays bounded and concurrency-limited", async () => {
  const assessmentBatch = await readFile(assessmentBatchUrl, "utf8");
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
  assert.match(workflow, /automation\/topic-routing\/tag-cache/);
  assert.match(workflow, /evidence-packages/);
  assert.match(workflow, /git push --force-with-lease="refs\/heads\/\$REVIEW_BRANCH:\$AUDIT_BRANCH_TIP"/);
  assert.match(workflow, /for path in automation\/collectors\/checkpoints\.json automation\/evidence-packages automation\/topic-routing\/tag-cache; do/);
  assert.doesNotMatch(workflow, /git merge --no-ff --no-commit/);
  assert.doesNotMatch(workflow, /git switch --force-create "\$REVIEW_BRANCH"/);
  assert.match(workflow, /could not create the required review pull request/);
});

test("the persistence step survives a topic-routing failure instead of skipping and losing already-tagged work", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const persistStep = workflow.split("      - name: Persist source collection and queued evidence packages")[1].split("\n      - name:")[0];
  assert.match(persistStep, /\n {8}if: always\(\)/);
  assert.match(persistStep, /if \[ -e "\$path" \]; then/);
});

test("collection and packages create a missing audit pull request without overwriting its review body", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const packagesStep = workflow.split("      - name: Create audit pull request for saved collection and packages when needed")[1].split("      - name: Assess only new or changed packages")[0];
  assert.match(packagesStep, /if \[ -z "\$PR_NUMBER" \]; then/);
  assert.match(packagesStep, /gh pr create/);
  assert.doesNotMatch(packagesStep, /gh pr edit/);
});

test("checkpoints persist only after routing and queuing packages", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const routing = workflow.indexOf("      - name: Route source records to promises via topic tags");
  const queueing = workflow.indexOf("      - name: Queue enriched evidence packages");
  const persistence = workflow.indexOf("      - name: Persist source collection and queued evidence packages");
  assert.ok(routing >= 0 && routing < queueing && queueing < persistence);
  assert.equal(workflow.includes("Persist successful source checkpoints"), false);
});

test("the public fallback records a valid successful collection time", async () => {
  const status = JSON.parse(await readFile(statusUrl, "utf8"));
  assert.equal(typeof status.lastSuccessfulCollectionAt, "string");
  assert.equal(Number.isNaN(Date.parse(status.lastSuccessfulCollectionAt)), false);
});
