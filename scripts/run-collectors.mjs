import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectFeedSource } from "./lib/feed-collectors.mjs";
import { deduplicateRecords, invariant, validateRegistry } from "./lib/collector-core.mjs";
import { collectPspSource } from "./lib/psp-collector.mjs";
import { collectOfficialHtmlArchive, collectWordPressRest } from "./lib/official-archive-collectors.mjs";

function parseArgs(args) {
  const options = { sourceIds: [], since: null, sinceDays: 7, output: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source") options.sourceIds.push(args[++index]);
    else if (arg === "--since") options.since = args[++index];
    else if (arg === "--since-days") options.sinceDays = Number(args[++index]);
    else if (arg === "--output") options.output = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.sourceIds.every(Boolean), "--source requires an id");
  invariant(Number.isInteger(options.sinceDays) && options.sinceDays >= 0 && options.sinceDays <= 3650, "--since-days must be an integer from 0 to 3650");
  if (options.since) invariant(/^\d{4}-\d{2}-\d{2}$/.test(options.since), "--since must use YYYY-MM-DD");
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
const since = args.since ?? defaultSince(collectedAt, args.sinceDays);
const selected = registry.sources.filter((source) => source.enabled && (args.sourceIds.length === 0 || args.sourceIds.includes(source.id)));
invariant(selected.length > 0, "No enabled collector sources selected");
for (const requested of args.sourceIds) invariant(selected.some((source) => source.id === requested), `Requested source is missing or disabled: ${requested}`);

const collectorResults = [];
for (const source of selected) {
  const result = source.collector === "psp-open-data"
    ? await collectPspSource(source, { since, collectedAt })
    : source.collector === "official-html-archive"
      ? await collectOfficialHtmlArchive(source, { since, collectedAt })
      : source.collector === "wordpress-rest"
        ? await collectWordPressRest(source, { since, collectedAt })
        : await collectFeedSource(source, { since, collectedAt });
  collectorResults.push(result);
  console.log(`${source.id}: ${result.records.length} records, ${result.warnings.length} warnings`);
}

const records = deduplicateRecords(collectorResults.flatMap((result) => result.records));
const runId = `${collectedAt.replaceAll(":", "-").replace(".", "-")}--${since}`;
const outputDirectory = resolve(args.output ?? `automation/runs/collectors/${runId}`);
await mkdir(outputDirectory, { recursive: true });
const output = {
  schemaVersion: "1.0.0",
  runId,
  collectedAt,
  since,
  publicationApproved: false,
  sourceIds: selected.map((source) => source.id),
  collectors: collectorResults.map((result) => ({
    sourceId: result.sourceId,
    collector: result.collector,
    retrievedAt: result.retrievedAt,
    snapshot: result.snapshot ?? null,
    snapshots: result.snapshots ?? null,
    recordCount: result.records.length,
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
console.log(JSON.stringify({ runId, since, outputDirectory, sourceCount: selected.length, recordCount: records.length, publicationApproved: false }, null, 2));
