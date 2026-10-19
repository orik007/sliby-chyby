import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { emptyCollectorCheckpoints, planSourceCollections, updateCollectorCheckpoints, validateCollectorCheckpoints } from "./lib/collector-checkpoints.mjs";
import { deduplicateRecords, invariant, validateRegistry } from "./lib/collector-core.mjs";
import { collectPspSource, validateGovernmentPeriods } from "./lib/psp-collector.mjs";
import { createESbirkaClient, createLawContextCache, createLawContextReader, workflowRunId } from "./lib/e-sbirka.mjs";
import { collectRegulations, notYetDigitisedWarning } from "./lib/regulations.mjs";
import { createGovernmentOfficeFetcher, createResolutionCache, readEklepTypes, readResolutions, resolutionRecords } from "./lib/government-resolutions.mjs";
import { createPspFetcher, pspDownloadSettings, pspProxyUrl } from "./lib/psp-print-documents.mjs";
import { createPspDocumentCache } from "./lib/psp-document-cache.mjs";
import { log } from "./lib/run-log.mjs";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

function parseArgs(args) {
  const options = { checkpoints: null, writeCheckpoints: null, output: null, lawContextCache: "automation/law-context", resolutionCache: "automation/government-resolutions", documentCache: "automation/psp-documents" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--checkpoints") options.checkpoints = args[++index];
    else if (arg === "--write-checkpoints") options.writeCheckpoints = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--law-context-cache") options.lawContextCache = args[++index];
    else if (arg === "--resolution-cache") options.resolutionCache = args[++index];
    else if (arg === "--document-cache") options.documentCache = args[++index];
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
const runId = `${collectedAt.replaceAll(":", "-").replace(".", "-")}--per-source`;
const outputDirectory = resolve(args.output ?? `automation/runs/collectors/${runId}`);
await mkdir(outputDirectory, { recursive: true });
const proxyUrl = pspProxyUrl();
if (proxyUrl && selected.some(({ collector }) => collector === "psp-open-data")) log("psp.cz requests go through the proxy in PSP_PROXY_URL");
const fetchPsp = createPspFetcher({ ...pspDownloadSettings, proxyUrl });
// The text of every psp.cz file read so far, under its document ID
// (scripts/lib/psp-document-cache.mjs), dated by the run's Prague date.
const runDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(collectedAt));
const documentCache = createPspDocumentCache(resolve(args.documentCache), runDate);
try {
  for (const source of selected) {
    const { since } = plansBySourceId.get(source.id);
    log(`${source.id}: collecting everything since ${since}`);
    const result = source.collector === "psp-open-data"
      ? await collectPspSource(source, { since, collectedAt, governmentPeriods, fetchPsp, documentCache })
      : source.collector === "zvlady-resolutions"
        ? await collectResolutionSource(source, since)
        : await collectRegulationSource(source, since);
    collectorResults.push(result);
    log(`${source.id}: ${result.records.length} records, ${result.warnings.length} warnings${result.warnings.length ? `: ${result.warnings.join("; ")}` : ""}`);
  }
} finally {
  await fetchPsp.close();
}

// Government regulations and ministerial decrees from the e-Sbírka REST API,
// through the permanent law-context cache (docs/evidence-pipeline.md,
// Collection of Laws data rules). Every request is appended to
// e-sbirka-requests.jsonl as it happens, so the file survives a failed run.
async function collectRegulationSource(source, since) {
  const requestFile = resolve(outputDirectory, "e-sbirka-requests.jsonl");
  writeFileSync(requestFile, "");
  const client = createESbirkaClient({ onRequest: (entry) => appendFileSync(requestFile, `${JSON.stringify(entry)}\n`) });
  const cache = createLawContextCache(resolve(args.lawContextCache));
  mkdirSync(resolve(args.lawContextCache), { recursive: true });
  const reader = createLawContextReader({ client, cache, runId: workflowRunId() });
  const today = collectedAt.slice(0, 10);
  let read = 0;
  try {
    const { records, quality } = await collectRegulations({
      reader,
      governmentPeriods,
      since,
      today,
      source,
      onAct: ({ act, outcome }) => {
        read += 1;
        if (read % 20 === 0) log(`${source.id}: ${read} regulations and decrees read (last: ${act}, ${outcome})`);
      }
    });
    const warnings = [
      ...quality.notYetDigitised.map((pending) => notYetDigitisedWarning(pending, today)),
      ...quality.unreadableHeadings.map((act) => `${act} Sb.: the heading states no adoption date or issuer; not used`)
    ];
    log(`${source.id}: ${quality.actsRead} acts read, ${quality.regulations} regulations and decrees since ${since} (${quality.governmentRegulations} government regulations, ${quality.ministerialDecrees} ministerial decrees), ${quality.attributed} adopted by the government or a ministry while a tracked government governed; ${quality.adoptedBeforeGovernment} adopted earlier; other issuers ${JSON.stringify(quality.otherIssuers)}; ${reader.stats.requests} e-Sbírka requests`);
    return { sourceId: source.id, collector: source.collector, retrievedAt: new Date().toISOString(), snapshot: null, snapshots: null, records, warnings, referenceData: { quality } };
  } finally {
    await cache.flush();
  }
}

// Government resolutions from the Government Office's portal zVlády,
// through the permanent resolution cache (docs/evidence-pipeline.md,
// Government resolution data rules). A resolution that only approves a
// government proposal or opinion is found by the eKLEP links of the
// Chamber's prints, so the Chamber's source is collected first. Every
// request is appended to government-resolutions-requests.jsonl as it
// happens.
async function collectResolutionSource(source, since) {
  const psp = collectorResults.find(({ collector }) => collector === "psp-open-data");
  invariant(psp?.referenceData?.eklepLinks, `${source.id} needs the Chamber's eKLEP links, collected before it`);
  const requestFile = resolve(outputDirectory, "government-resolutions-requests.jsonl");
  writeFileSync(requestFile, "");
  const fetcher = createGovernmentOfficeFetcher({ onRequest: (entry) => appendFileSync(requestFile, `${JSON.stringify(entry)}\n`) });
  const today = collectedAt.slice(0, 10);
  let read = 0;
  const { resolutions, quality: readQuality } = await readResolutions({
    fetcher,
    cache: createResolutionCache(resolve(args.resolutionCache)),
    firstResolution: source.firstResolution,
    today,
    onResolution: ({ resolution, outcome }) => {
      read += 1;
      if (read % 20 === 0) log(`${source.id}: ${read} resolution pages read from the portal (last: ${resolution}, ${outcome})`);
    }
  });
  const { types: eklepTypes, notYetPublished } = await readEklepTypes({ fetcher, fromYear: Number(since.slice(0, 4)), today });
  const { records, quality } = resolutionRecords({ resolutions, eklepLinks: psp.referenceData.eklepLinks, eklepTypes, eklepYearsMissing: notYetPublished, governmentPeriods, source });
  const warnings = [
    ...readQuality.gaps.map((resolution) => `${resolution}: not held between two held resolutions; read again in the next run`),
    ...readQuality.unexpectedPages.map((resolution) => `${resolution}: published without a Word file of the resolution; not used`),
    ...readQuality.unreadableFiles.map((file) => `${file}: the file cannot be read as text; the resolution is not used and is read again in the next run`),
    ...quality.heldUnreadAnnex.map((resolution) => `${resolution}: an annex is published only as a PDF or XLS file, which is not read; the resolution is held back`),
    ...notYetPublished.map((year) => `the eKLEP open data of ${year} is not yet published; ${quality.heldWithoutEklep} resolutions adopted in ${year} are held back until it is`)
  ];
  log(`${source.id}: ${resolutions.length} published resolutions (${readQuality.fromCache} from the cache, ${readQuality.fromPortal} read from the portal), ${readQuality.classified.length} classified; left out as duplicates ${JSON.stringify(quality.duplicates)}; ${quality.beforeGovernment} adopted before a tracked government; ${quality.used} used; ${fetcher.stats.requests} requests to the Government Office, ${fetcher.stats.retried} retried`);
  return { sourceId: source.id, collector: source.collector, retrievedAt: new Date().toISOString(), snapshot: null, snapshots: null, records, warnings, referenceData: { quality: { ...readQuality, ...quality, requests: fetcher.stats.requests, retried: fetcher.stats.retried } } };
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
