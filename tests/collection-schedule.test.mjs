import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { continuationMarker } from "../scripts/lib/assessment-review.mjs";

const workflowUrl = new URL("../.github/workflows/collect-evidence.yml", import.meta.url);
const statusUrl = new URL("../data/system-status.json", import.meta.url);
const assessmentBatchUrl = new URL("../scripts/run-assessment-batch.mjs", import.meta.url);

test("the daily schedule stays paused until the first manual run of the pipeline is verified", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  assert.match(workflow, /# {3}- cron: "37 9 \* \* \*"/);
  assert.match(workflow, /# {5}timezone: "Europe\/Prague"/);
  assert.match(workflow, /--checkpoints automation\/collectors\/checkpoints\.json/);
  assert.match(workflow, /--write-checkpoints automation\/collectors\/checkpoints\.json/);
  assert.match(workflow, /node scripts\/run-topic-routing\.mjs/);
  assert.match(workflow, /--tag-cache automation\/topic-routing\/tag-cache/);
  assert.match(workflow, /SLIBY_TAGGING_CONCURRENCY: \$\{\{ inputs\.tagging_concurrency \|\| '24' \}\}/);
  assert.match(workflow, /SLIBY_SERVICE_TIER: flex/);
  assert.match(workflow, /SLIBY_ASSESSMENT_CONCURRENCY: \$\{\{ inputs\.assessment_concurrency \|\| '16' \}\}/);
  assert.match(workflow, /timeout-minutes: 300/);
  assert.match(workflow, /Persist source collection and queued evidence packages/);
  assert.match(workflow, /Queue evidence packages/);
  assert.doesNotMatch(workflow, /enrich/i);
  assert.match(workflow, /node scripts\/run-print-parts\.mjs/);
  assert.doesNotMatch(workflow, /automation\/print-parts/);
  assert.match(workflow, /--print-parts automation\/runs\/pipeline\/github-actions\/print-parts\/print-parts\.json/);
  assert.doesNotMatch(workflow, /--retry-blocked-queue/);
  assert.match(workflow, /--packages automation\/evidence-packages/);
  assert.match(workflow, /--topic-routing-run automation\/runs\/pipeline\/github-actions\/topic-routing\/topic-routing-report\.json/);
  assert.match(workflow, /const collectorRun = JSON\.parse\(await readFile\("automation\/runs\/pipeline\/github-actions\/collector\/collector-run\.json", "utf8"\)\);/);
  assert.match(workflow, /collectorRun\.collectors\.map/);
  assert.doesNotMatch(workflow, /^      GH_TOKEN:/m);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /uses: actions\/checkout@v5\n        with:\n          ref: main/);
  assert.equal([...workflow.matchAll(/GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/g)].length, 6);
  assert.match(workflow, /- name: Restore current audit state[\s\S]*?env:\n          GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/);
  assert.match(workflow, /- name: Persist source collection and queued evidence packages[\s\S]*?env:\n          GH_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN \|\| github\.token \}\}/);
  // Every run collects every source completely; no manual start date or
  // source subset can produce a package from part of the record history.
  assert.doesNotMatch(workflow, /inputs\.since|inputs\.sources|--since|--source /);
  // The paid steps stop before the job limit, so the saving steps always run.
  assert.match(workflow, /timeout-minutes: 300/);
  assert.match(workflow, /- name: Screen law changes, route them to promises, check relevance, and build packages\n        timeout-minutes: 120/);
  assert.match(workflow, /- name: Split official print texts into law changes\n        timeout-minutes: 120/);
  assert.match(workflow, /- name: Assess only new or changed packages\n        id: assess\n        timeout-minutes: 120/);
  // Finished assessments are saved even when the assessment step fails.
  assert.match(workflow, /- name: Commit new review proposals\n        id: proposals\n        if: always\(\) && steps\.assess\.outcome != 'skipped'/);
  // The review pull request text is refreshed on every run that saved its state.
  assert.match(workflow, /- name: Create or update human-review pull request\n        if: always\(\) && steps\.proposals\.outcome == 'success' && hashFiles\('automation\/runs\/pipeline\/github-actions\/assessment-review-pr\.md'\) != ''/);
  // A list too long for the body continues in the run's own comments, edited
  // in place, added, or deleted, so they never pile up.
  assert.ok(workflow.includes(`select(.user.login == \\"$COMMENT_AUTHOR\\" and (.body | startswith(\\"${continuationMarker}\\")))`));
  assert.match(workflow, /USES_DEFAULT_TOKEN: \$\{\{ secrets\.AUTOMATION_PR_TOKEN == '' \}\}/);
  assert.match(workflow, /COMMENT_AUTHOR="\$\(gh api user --jq \.login\)"/);
  assert.match(workflow, /gh api -X PATCH "repos\/\$GITHUB_REPOSITORY\/issues\/comments\/\$\{OLD_COMMENTS\[\$index\]\}" -F "body=@\$\{NEW_COMMENTS\[\$index\]\}"/);
  assert.match(workflow, /gh api -X POST "repos\/\$GITHUB_REPOSITORY\/issues\/\$PR_NUMBER\/comments" -F "body=@\$\{NEW_COMMENTS\[\$index\]\}"/);
  assert.match(workflow, /gh api -X DELETE "repos\/\$GITHUB_REPOSITORY\/issues\/comments\/\$\{OLD_COMMENTS\[\$index\]\}"/);
  // Every paid call is logged, and the spend is reported even after a failure.
  assert.match(workflow, /SLIBY_MODEL_CALL_LOG: automation\/runs\/pipeline\/github-actions\/model-calls\.jsonl/);
  // The tests run without the API key and without the run's spend log.
  assert.match(workflow, /- name: Run deterministic tests\n(?:\s+#[^\n]*\n)*\s+env:\n\s+OPENAI_API_KEY: ""\n\s+SLIBY_MODEL_CALL_LOG: ""\n\s+run: npm test/);
  assert.match(workflow, /- name: Report model calls and estimated spend\n        if: always\(\)/);
  // Paid assessments have a hard per-run cap that defaults to none.
  assert.match(workflow, /max_assessments:\n        description: [^\n]+\n        required: true\n        default: "0"/);
  assert.match(workflow, /SLIBY_MAX_ASSESSMENTS: \$\{\{ inputs\.max_assessments \|\| '0' \}\}/);
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts["collect:evidence"], "node scripts/run-collectors.mjs");
  assert.match(workflow, /git push --force-with-lease="refs\/heads\/\$REVIEW_BRANCH:\$AUDIT_BRANCH_TIP" "https:\/\/x-access-token:\$\{GH_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}\.git" "HEAD:refs\/heads\/\$REVIEW_BRANCH"/);
});

test("assessment fan-out stays bounded and concurrency-limited", async () => {
  const assessmentBatch = await readFile(assessmentBatchUrl, "utf8");
  assert.match(assessmentBatch, /mapWithConcurrency\(assessmentItems, concurrency/);
  assert.match(assessmentBatch, /SLIBY_ASSESSMENT_CONCURRENCY must be an integer from 1 to 32/);
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
  assert.match(workflow, /git add automation\/topic-routing\/tag-cache/);
  assert.match(workflow, /git add automation\/collectors\/checkpoints\.json automation\/evidence-packages/);
  assert.doesNotMatch(workflow, /git merge --no-ff --no-commit/);
  assert.doesNotMatch(workflow, /git switch --force-create "\$REVIEW_BRANCH"/);
  assert.match(workflow, /could not create the required review pull request/);
});

test("the model-cache persistence step survives a routing failure, but checkpoints only persist on full success", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const tagCacheStep = workflow.split("      - name: Persist model caches even on a failed run")[1].split("\n      - name:")[0];
  assert.match(tagCacheStep, /\n {8}if: always\(\)/);
  assert.match(tagCacheStep, /if \[ -d automation\/topic-routing\/tag-cache \]; then/);
  const checkpointsStep = workflow.split("      - name: Persist source collection and queued evidence packages")[1].split("\n      - name:")[0];
  assert.doesNotMatch(checkpointsStep, /if: always\(\)/);
  assert.doesNotMatch(checkpointsStep, /automation\/topic-routing\/tag-cache/);
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
  const printParts = workflow.indexOf("      - name: Split official print texts into law changes");
  const routing = workflow.indexOf("      - name: Screen law changes, route them to promises, check relevance, and build packages");
  const queueing = workflow.indexOf("      - name: Queue evidence packages");
  const persistence = workflow.indexOf("      - name: Persist source collection and queued evidence packages");
  assert.ok(printParts >= 0 && printParts < routing && routing < queueing && queueing < persistence);
  assert.equal(workflow.includes("Persist successful source checkpoints"), false);
});

test("the public fallback records a valid successful collection time", async () => {
  const status = JSON.parse(await readFile(statusUrl, "utf8"));
  assert.equal(typeof status.lastSuccessfulCollectionAt, "string");
  assert.equal(Number.isNaN(Date.parse(status.lastSuccessfulCollectionAt)), false);
});

test("audit state of another pipeline generation is never restored", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const generation = (await readFile(new URL("../automation/pipeline-generation", import.meta.url), "utf8")).trim();
  assert.equal(generation, "law-changes-v2");
  assert.match(workflow, /-- automation\/topic-routing\/tag-cache\)/);
  assert.match(workflow, /audit_generation="\$\(git show "origin\/\$REVIEW_BRANCH:automation\/pipeline-generation" 2>\/dev\/null \|\| true\)"/);
  assert.match(workflow, /if \[ "\$audit_generation" != "\$\(cat automation\/pipeline-generation\)" \]; then/);
  // The tests read main's files, so they run before the audit state is restored.
  assert.ok(workflow.indexOf("- name: Run deterministic tests") < workflow.indexOf("- name: Restore current audit state"));
  for (const path of ["collectors/checkpoints.json", "evidence-packages/manifest.json", "review-proposals/manifest.json"]) {
    const file = JSON.parse(await readFile(new URL(`../automation/${path}`, import.meta.url), "utf8"));
    const entries = file.sourceCheckpoints ?? file.packages ?? file.proposals;
    assert.equal(Object.keys(entries).length, 0, `${path} on main must be empty so a fresh generation starts from nothing`);
  }
});
