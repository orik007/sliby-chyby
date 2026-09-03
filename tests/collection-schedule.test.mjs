import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/collect-evidence.yml", import.meta.url);
const statusUrl = new URL("../data/system-status.json", import.meta.url);

test("full evidence collection is scheduled daily at 09:37 Prague time", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  assert.match(workflow, /cron: "37 9 \* \* \*"/);
  assert.match(workflow, /timezone: "Europe\/Prague"/);
  assert.match(workflow, /inputs\.since \|\| '2025-10-01'/);
});

test("the public fallback records a valid successful collection time", async () => {
  const status = JSON.parse(await readFile(statusUrl, "utf8"));
  assert.equal(typeof status.lastSuccessfulCollectionAt, "string");
  assert.equal(Number.isNaN(Date.parse(status.lastSuccessfulCollectionAt)), false);
});
