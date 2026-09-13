import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const partyPeriods = [
  "cz-ps-2025--ano.json",
  "cz-ps-2025--spd.json",
  "cz-ps-2025--motoriste.json"
];

test("uses a local official leader portrait for every public party period", async () => {
  for (const filename of partyPeriods) {
    const partyPeriod = JSON.parse(await readFile(new URL(`../data/party-periods/${filename}`, import.meta.url), "utf8"));
    assert.match(partyPeriod.leaderName, /\S+\s+\S+/);
    assert.match(partyPeriod.portraitImage, /^\/portraits\/[a-z0-9-]+\.png$/);
    assert.match(partyPeriod.portraitSourceUrl, /^https:\/\//);
    await access(fileURLToPath(new URL(`../public${partyPeriod.portraitImage}`, import.meta.url)));
  }
});
