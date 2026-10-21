import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stepMinutes } from "../scripts/job-time-left.mjs";

const script = new URL("../scripts/job-time-left.mjs", import.meta.url).pathname;
const run = (startedAt, reserve, output) => execFileSync(process.execPath, [script, "--reserve", String(reserve)], { env: { ...process.env, JOB_STARTED_AT: String(startedAt), GITHUB_OUTPUT: output }, encoding: "utf8" });

test("a step gets what is left of the job's 360 minutes, a started minute counting as spent", () => {
  assert.equal(stepMinutes({ startedAt: 0, now: 95 * 60, reserve: 15 }), 250);
  assert.equal(stepMinutes({ startedAt: 0, now: 95 * 60 + 1, reserve: 15 }), 249);
});

test("writes the minutes for the step's limit, and stops the run when fewer than 5 are left", async () => {
  const output = join(await mkdtemp(join(tmpdir(), "job-time-")), "output");
  const now = Math.floor(Date.now() / 1000);
  run(now - 95 * 60, 15, output);
  assert.match(await readFile(output, "utf8"), /^minutes=(249|250)\n$/);
  assert.throws(() => run(now - 342 * 60, 15, output), (error) => error.status === 1 && /Only \d+ minutes are left/.test(error.stderr));
  assert.throws(() => run("", 15, output), (error) => error.status === 2);
});
