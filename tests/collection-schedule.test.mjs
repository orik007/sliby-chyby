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
  assert.match(workflow, /SLIBY_SEMANTIC_MIN_SIMILARITY: 0\.5/);
  assert.match(workflow, /SLIBY_ASSESSMENT_CONCURRENCY: 4/);
  assert.match(workflow, /timeout-minutes: 50/);
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
  assert.match(workflow, /git merge --no-ff --no-commit/);
  assert.match(workflow, /semantic-index/);
  assert.match(workflow, /git merge --abort/);
  assert.match(workflow, /git push --set-upstream origin "\$REVIEW_BRANCH"/);
  assert.match(workflow, /git add automation\/collectors\/checkpoints\.json automation\/review-proposals automation\/semantic-index/);
  assert.match(workflow, /could not create the required review pull request/);
});

test("the public fallback records a valid successful collection time", async () => {
  const status = JSON.parse(await readFile(statusUrl, "utf8"));
  assert.equal(typeof status.lastSuccessfulCollectionAt, "string");
  assert.equal(Number.isNaN(Date.parse(status.lastSuccessfulCollectionAt)), false);
});
