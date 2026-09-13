import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const partyPeriodDirectory = new URL("../data/party-periods/", import.meta.url);

test("uses a local official leader portrait for every public party period", async () => {
  const filenames = (await readdir(partyPeriodDirectory)).filter((filename) => filename.endsWith(".json"));
  assert.ok(filenames.length > 0, "Expected at least one party-period record");

  for (const filename of filenames) {
    const partyPeriod = JSON.parse(await readFile(new URL(filename, partyPeriodDirectory), "utf8"));
    assert.match(partyPeriod.leaderName, /\S+\s+\S+/);
    assert.match(partyPeriod.portraitImage, /^\/portraits\/[a-z0-9-]+\.png$/);
    assert.match(partyPeriod.portraitSourceUrl, /^https:\/\//);
    assert.match(partyPeriod.portraitBackground, /^#[0-9a-fA-F]{6}$/);
    await access(fileURLToPath(new URL(`../public${partyPeriod.portraitImage}`, import.meta.url)));
  }
});
