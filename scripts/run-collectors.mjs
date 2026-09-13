import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { planSourceCollections, updateCollectorCheckpoints, validateCollectorCheckpoints } from "./lib/collector-checkpoints.mjs";
import { collectFeedSource } from "./lib/feed-collectors.mjs";
import { deduplicateRecords, invariant, validateRegistry } from "./lib/collector-core.mjs";
import { collectPspSource } from "./lib/psp-collector.mjs";
import {
  collectMkNewsArchive,
  collectMpsvPressArchive,
  collectMsmtNewsApi,
  collectOfficialHtmlArchive,
  collectWordPressRest
} from "./lib/official-archive-collectors.mjs";

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
const collectedAt = new Date().toISOString();
const selected = registry.sources.filter((source) => source.enabled && (args.sourceIds.length === 0 || args.sourceIds.includes(source.id)));
invariant(selected.length > 0, "No enabled collector sources selected");
for (const requested of args.sourceIds) invariant(selected.some((source) => source.id === requested), `Requested source is missing or disabled: ${requested}`);

const checkpoints = args.checkpoints
  ? validateCollectorCheckpoints(JSON.parse(await readFile(resolve(args.checkpoints), "utf8")), registry)
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

const collectorResults = [];
for (const source of selected) {
  const plan = plansBySourceId.get(source.id);
  invariant(plan, `Collector source ${source.id} is missing a collection plan`);
  const since = plan.since;
  const result = source.collector === "psp-open-data"
    ? await collectPspSource(source, { since, collectedAt })
    : source.collector === "official-html-archive"
      ? await collectOfficialHtmlArchive(source, { since, collectedAt })
      : source.collector === "wordpress-rest"
        ? await collectWordPressRest(source, { since, collectedAt })
        : source.collector === "mk-news-archive"
          ? await collectMkNewsArchive(source, { since, collectedAt })
          : source.collector === "mpsv-press-archive"
            ? await collectMpsvPressArchive(source, { since, collectedAt })
            : source.collector === "msmt-news-api"
              ? await collectMsmtNewsApi(source, { since, collectedAt })
              : await collectFeedSource(source, { since, collectedAt });
  collectorResults.push(result);
  console.log(`${source.id}: ${plan.mode} from ${since}, ${result.records.length} records, ${result.warnings.length} warnings`);
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
  await writeFile(resolve(args.writeCheckpoints), `${JSON.stringify(updatedCheckpoints, null, 2)}\n`);
}
console.log(JSON.stringify({ runId, outputDirectory, sourceCount: selected.length, recordCount: records.length, collectionPlan, checkpointUpdated: Boolean(args.writeCheckpoints), publicationApproved: false }, null, 2));
