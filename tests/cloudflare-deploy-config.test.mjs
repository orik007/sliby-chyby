import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageUrl = new URL("../package.json", import.meta.url);
const configUrl = new URL("../wrangler.deploy.jsonc", import.meta.url);
const verificationWorkflowUrl = new URL("../.github/workflows/verify-pr.yml", import.meta.url);

test("Cloudflare production deployment stays explicit and isolated", async () => {
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  const config = JSON.parse(await readFile(configUrl, "utf8"));
  const workflow = await readFile(verificationWorkflowUrl, "utf8");

  assert.equal(config.name, packageJson.name);
  assert.equal(config.main, "./dist/server/entry.mjs");
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.assets.directory, "./dist/client");
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert.equal("account_id" in config, false);
  assert.match(workflow, /wrangler deploy --dry-run --config wrangler\.deploy\.jsonc/);
});
