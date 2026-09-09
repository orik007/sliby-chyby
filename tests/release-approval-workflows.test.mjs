import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("GitHub-only release gates retain exact-head approval safeguards", () => {
  const ready = read("../.github/workflows/present-ready-pr.yml");
  const merge = read("../.github/workflows/merge-approved-pr.yml");
  const feedback = read("../.github/workflows/route-owner-feedback.yml");

  assert.match(ready, /sliby-ready-for-owner-approval/);
  assert.match(ready, /copilot-pull-request-reviewer/);
  assert.match(ready, /chatgpt-codex-connector/);
  assert.match(ready, /sharedReviewHeads\.length === 2/);
  assert.match(ready, /ready-for-owner-approval head \$\{headSha\}/);
  assert.match(ready, /removeLabel/);

  assert.match(merge, /github\.event\.comment\.body == 'schvaluji'/);
  assert.match(merge, /github\.event\.comment\.user\.login == github\.repository_owner/);
  assert.match(merge, /notice\.created_at/);
  assert.match(merge, /workflow_id: "verify-pr\.yml"/);
  assert.match(merge, /reviewThreads/);
  assert.match(merge, /sha: headSha/);

  assert.match(feedback, /@codex address the owner's feedback/);
  assert.doesNotMatch(feedback, /OPENAI_API_KEY|api\.openai\.com/);
});

test("Cloudflare release-controller implementation is absent", () => {
  const packageJson = JSON.parse(read("../package.json"));

  assert.equal(packageJson.scripts["deploy:cloudflare"], "npx wrangler deploy --config wrangler.deploy.jsonc");
  assert.equal(existsSync(new URL("../wrangler.release-control.jsonc", import.meta.url)), false);
  assert.equal(existsSync(new URL("../automation/release-control/src/index.mjs", import.meta.url)), false);
  assert.equal(existsSync(new URL("../scripts/run-release-resolver.mjs", import.meta.url)), false);
});
