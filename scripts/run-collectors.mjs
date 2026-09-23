import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { planSourceCollections, updateCollectorCheckpoints, withoutRemovedSourceCheckpoints } from "./lib/collector-checkpoints.mjs";
import { deduplicateRecords, invariant, validateRegistry } from "./lib/collector-core.mjs";
import { collectPspSource, validateGovernmentPeriods } from "./lib/psp-collector.mjs";

function parseArgs(args) {
  const options = { sourceIds: [], since: null, sinceDays: 7, checkpoints: null, writeCheckpoints: null, output: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source") options.sourceIds.push(args[++index]);
    else if (arg === "--since") options.since = args[++index];
    else if (arg === "--since-days") options.sinceDays = Number(args[++index]);
    else if (arg === "--checkpoints") options.checkpoints = args[++index];
    else if (arg === "--write-checkpoints") options.writeCheckpoints = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.sourceIds.every(Boolean), "--source requires an id");
  invariant(Number.isInteger(options.sinceDays) && options.sinceDays >= 0 && options.sinceDays <= 3650, "--since-days must be an integer from 0 to 3650");
  if (options.since) invariant(/^\d{4}-\d{2}-\d{2}$/.test(options.since), "--since must use YYYY-MM-DD");
  invariant(!options.writeCheckpoints || options.checkpoints, "--write-checkpoints requires --checkpoints");
  return options;
}

function defaultSince(collectedAt, sinceDays) {
  const date = new Date(collectedAt);
  date.setUTCDate(date.getUTCDate() - sinceDays);
  return date.toISOString().slice(0, 10);
}

const args = parseArgs(process.argv.slice(2));
const registry = validateRegistry(JSON.parse(await readFile(resolve("automation/collectors/sources.json"), "utf8")));
const governmentPeriods = validateGovernmentPeriods(JSON.parse(await readFile(resolve("automation/attribution/government-periods.json"), "utf8")));
const collectedAt = new Date().toISOString();
const selected = registry.sources.filter((source) => source.enabled && (args.sourceIds.length === 0 || args.sourceIds.includes(source.id)));
invariant(selected.length > 0, "No enabled collector sources selected");
for (const requested of args.sourceIds) invariant(selected.some((source) => source.id === requested), `Requested source is missing or disabled: ${requested}`);

const checkpoints = args.checkpoints
  ? withoutRemovedSourceCheckpoints(JSON.parse(await readFile(resolve(args.checkpoints), "utf8")), registry)
  : null;
const collectionPlan = checkpoints
  ? planSourceCollections({ registry, checkpoints, sourceIds: selected.map(({ id }) => id), requestedSince: args.since })
  : selected.map((source) => ({
      sourceId: source.id,
      mode: args.since ? "manual-override" : "legacy-window",
      since: args.since ?? defaultSince(collectedAt, args.sinceDays),
      checkpointBefore: null
    }));
const plansBySourceId = new Map(collectionPlan.map((plan) => [plan.sourceId, plan]));

// The date a failed source will actually resume from on a later default
// run: the unchanged checkpoint's own date (or bootstrapFrom if it never
// had one) when checkpoints are tracked at all, never `plan.since` --
// `plan.since` is what THIS run requested, which for a manual `--since`
// override is not persisted anywhere and so is not what "next run" means.
function nextRetryFrom(plan, source, checkpointsInUse) {
  if (!checkpointsInUse) return null;
  return plan.checkpointBefore ? plan.checkpointBefore.lastSuccessfulCollectionAt.slice(0, 10) : source.bootstrapFrom;
}

const collectorResults = [];
// Per-source failure isolation: see docs/evidence-pipeline.md step 2.
// A failed source is simply omitted from `collectorResults`, so
// `updateCollectorCheckpoints` below never sees it and leaves its
// checkpoint untouched.
const failures = [];
for (const source of selected) {
  const plan = plansBySourceId.get(source.id);
  invariant(plan, `Collector source ${source.id} is missing a collection plan`);
  const since = plan.since;
  try {
    const result = await collectPspSource(source, { since, collectedAt, governmentPeriods });
    collectorResults.push(result);
    console.log(`${source.id}: ${plan.mode} from ${since}, ${result.records.length} records, ${result.warnings.length} warnings`);
  } catch (error) {
    // A collector can throw something other than an Error (a rejected
    // fetch body, a plain string, undefined) -- normalize so `failures`
    // always carries a real, present message instead of silently dropping
    // the property (JSON.stringify omits an undefined value) or printing
    // the literal string "undefined".
    const message = error instanceof Error ? error.message : String(error);
    const retryFrom = nextRetryFrom(plan, source, Boolean(checkpoints));
    const retryNote = retryFrom
      ? `checkpoint unchanged; next default run retries from ${retryFrom} (a manual --since override, if this run used one, is never persisted)`
      : "no checkpoint is tracked this run, so nothing resumes automatically from a fixed date";
    failures.push({ sourceId: source.id, message, retryFrom });
    console.error(`${source.id}: collection failed -- ${message}. ${retryNote}`);
  }
}

async function writeCheckpointsAtomically(filePath, checkpoints) {
  const destination = resolve(filePath);
  const temporary = resolve(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(checkpoints, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

const records = deduplicateRecords(collectorResults.flatMap((result) => result.records));
const runId = `${collectedAt.replaceAll(":", "-").replace(".", "-")}--per-source`;
const outputDirectory = resolve(args.output ?? `automation/runs/collectors/${runId}`);
await mkdir(outputDirectory, { recursive: true });
const output = {
  schemaVersion: "1.0.0",
  runId,
  collectedAt,
  since: args.since ?? null,
  collectionPlan,
  publicationApproved: false,
  sourceIds: selected.map((source) => source.id),
  failures,
  collectors: collectorResults.map((result) => ({
    sourceId: result.sourceId,
    collector: result.collector,
    retrievedAt: result.retrievedAt,
    snapshot: result.snapshot ?? null,
    snapshots: result.snapshots ?? null,
    recordCount: result.records.length,
    collection: plansBySourceId.get(result.sourceId),
    coverage: selected.find((source) => source.id === result.sourceId).coverage,
    observedRange: {
      earliest: result.records.map(({ occurredAt }) => occurredAt).filter(Boolean).sort()[0] ?? null,
      latest: result.records.map(({ occurredAt }) => occurredAt).filter(Boolean).sort().at(-1) ?? null
    },
    warnings: result.warnings,
    referenceData: result.referenceData
  })),
  records
};
await writeFile(resolve(outputDirectory, "collector-run.json"), `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
if (args.writeCheckpoints) {
  const updatedCheckpoints = updateCollectorCheckpoints({
    checkpoints,
    registry,
    runId,
    collectedAt,
    collectorResults,
    collectionPlan
  });
  await writeCheckpointsAtomically(args.writeCheckpoints, updatedCheckpoints);
}
console.log(JSON.stringify({ runId, outputDirectory, sourceCount: selected.length, recordCount: records.length, collectionPlan, failures, checkpointUpdated: Boolean(args.writeCheckpoints), publicationApproved: false }, null, 2));
