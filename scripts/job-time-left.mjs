import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * The whole minutes a step may run under the rule in docs/evidence-pipeline.md
 * (Resuming): what is left of the job's limit since `startedAt` (seconds),
 * less `reserve` minutes. A started minute counts as spent.
 */
export function stepMinutes({ startedAt, now, jobMinutes = 360, reserve }) {
  const elapsed = Math.ceil((now - startedAt) / 60);
  return jobMinutes - elapsed - reserve;
}

// The least time a paid step is started with.
export const minimumStepMinutes = 5;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reserve = Number(process.argv[process.argv.indexOf("--reserve") + 1]);
  const startedAt = Number(process.env.JOB_STARTED_AT);
  if (!Number.isInteger(reserve) || reserve < 0 || !Number.isInteger(startedAt) || startedAt <= 0) {
    console.error("Usage: JOB_STARTED_AT=<seconds> node scripts/job-time-left.mjs --reserve <minutes>");
    process.exit(2);
  }
  const minutes = stepMinutes({ startedAt, now: Math.floor(Date.now() / 1000), reserve });
  if (minutes < minimumStepMinutes) {
    console.error(`Only ${minutes} minutes are left for this step; the run stops here, and the next run continues from what was saved.`);
    process.exit(1);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `minutes=${minutes}\n`);
  console.log(`This step may run for ${minutes} minutes (${reserve} kept back for saving).`);
}
