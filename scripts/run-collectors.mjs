import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { emptyCollectorCheckpoints, planSourceCollections, updateCollectorCheckpoints, validateCollectorCheckpoints } from "./lib/collector-checkpoints.mjs";
import { deduplicateRecords, invariant, validateRegistry } from "./lib/collector-core.mjs";
import { collectPspSource, validateGovernmentPeriods } from "./lib/psp-collector.mjs";
import { log } from "./lib/run-log.mjs";

function parseArgs(args) {
  const options = { checkpoints: null, writeCheckpoints: null, output: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--checkpoints") options.checkpoints = args[++index];
    else if (arg === "--write-checkpoints") options.writeCheckpoints = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(!options.writeCheckpoints || options.checkpoints, "--write-checkpoints requires --checkpoints");
  return options;
}

const args = parseArgs(process.argv.slice(2));
const registry = validateRegistry(JSON.parse(await readFile(resolve("automation/collectors/sources.json"), "utf8")));
const governmentPeriods = validateGovernmentPeriods(JSON.parse(await readFile(resolve("automation/attribution/government-periods.json"), "utf8")));
const collectedAt = new Date().toISOString();
const selected = registry.sources.filter((source) => source.enabled);
invariant(selected.length > 0, "No enabled collector sources");

const checkpoints = args.checkpoints
  ? validateCollectorCheckpoints(JSON.parse(await readFile(resolve(args.checkpoints), "utf8")), registry)
  : emptyCollectorCheckpoints();
const collectionPlan = planSourceCollections({ registry, checkpoints, sourceIds: selected.map(({ id }) => id) });
const plansBySourceId = new Map(collectionPlan.map((plan) => [plan.sourceId, plan]));

// Every source is collected completely. A failed source fails the run, so no
// evidence package is ever built from part of the record history.
const collectorResults = [];
log(`collecting ${selected.length} active source(s): ${selected.map(({ id }) => id).join(", ")}`);
for (const source of selected) {
  const { since } = plansBySourceId.get(source.id);
  log(`${source.id}: collecting everything since ${since}`);
  const result = await collectPspSource(source, { since, collectedAt, governmentPeriods });
  collectorResults.push(result);
  log(`${source.id}: ${result.records.length} records, ${result.warnings.length} warnings${result.warnings.length ? `: ${result.warnings.join("; ")}` : ""}`);
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
  collectionPlan,
  publicationApproved: false,
  sourceIds: selected.map((source) => source.id),
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
console.log(JSON.stringify({ runId, outputDirectory, sourceCount: selected.length, recordCount: records.length, collectionPlan, checkpointUpdated: Boolean(args.writeCheckpoints), publicationApproved: false }, null, 2));
