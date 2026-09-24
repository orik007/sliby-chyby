import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isPotentiallyAttributable } from "./lib/attribution.mjs";
import { fetchVerified, invariant, validateRegistry } from "./lib/collector-core.mjs";
import { extractDocxParagraphs, officialPrintDocumentPageUrl } from "./lib/psp-print-documents.mjs";
import { log, progress } from "./lib/run-log.mjs";
import { lawChangesOfPrint, printPartsSplitterVersion, proposalBody, proposalDocumentLink } from "./lib/print-parts.mjs";

/**
 * Splits every Chamber print concerned by a potentially attributable record
 * into law changes (docs/evidence-pipeline.md, Chamber data rules). Each
 * print's proposal text is fetched once and cached, one file per print,
 * without its explanatory memorandum. A print without a readable DOCX
 * proposal text is one law change with only its title; a failed download
 * is reported and retried in the next run.
 */
function parseArgs(args) {
  const options = { collectorRun: null, cache: null, output: null, sourceRegistry: "automation/collectors/sources.json", promiseRegistry: "automation/promise-registry/promises.json" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--cache") options.cache = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--sources") options.sourceRegistry = args[++index];
    else if (arg === "--promises") options.promiseRegistry = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun && options.cache && options.output, "--collector-run, --cache, and --output are required");
  return options;
}

function collectPrints(records) {
  const prints = new Map();
  const add = ({ externalPrintId, printKindId, number, partNumber, titleCz }) => {
    if (!externalPrintId || !Number.isInteger(number)) return;
    prints.set(String(externalPrintId), { printId: String(externalPrintId), kindId: printKindId ?? null, number, partNumber: partNumber ?? 0, title: titleCz ?? "" });
  };
  for (const record of records) {
    const payload = record.payload ?? {};
    if (record.kind === "legislative-step") add({ externalPrintId: payload.externalPrintId, printKindId: payload.printKindId, number: payload.printNumber, partNumber: payload.partNumber, titleCz: payload.printTitleCz });
    for (const linkedPrint of payload.linkedPrints ?? []) add(linkedPrint);
  }
  return [...prints.values()].sort((left, right) => left.number - right.number);
}

async function fetchProposalText(source, print, termNumber) {
  const pageUrl = officialPrintDocumentPageUrl(termNumber, print.number, print.partNumber);
  const page = await fetchVerified(source, pageUrl, { maxBytes: 1_000_000, expectedContentTypes: ["text/html"] });
  const link = proposalDocumentLink(new TextDecoder("windows-1250").decode(page.bytes), pageUrl);
  if (!link) return { document: null, paragraphs: null };
  const file = await fetchVerified(source, link.url, {
    maxBytes: 20_000_000,
    expectedContentTypes: ["openxmlformats-officedocument", "application/octet-stream", "application/zip"]
  });
  return {
    document: { filename: link.filename, url: file.finalUrl, sectionLabel: link.sectionLabel, contentHash: file.contentHash },
    paragraphs: proposalBody(extractDocxParagraphs(file.bytes))
  };
}

async function loadCache(directory) {
  const cache = new Map();
  if (!existsSync(directory)) return cache;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const value = JSON.parse(await readFile(resolve(directory, entry.name), "utf8"));
    // Texts split by an older splitter are fetched again.
    if (value.splitterVersion !== printPartsSplitterVersion) continue;
    invariant(typeof value.printId === "string" && Number.isInteger(value.printNumber), `Invalid print-parts cache file ${entry.name}`);
    invariant((value.document === null) === (value.paragraphs === null), `Print-parts cache file ${entry.name} must have both a document and its text, or neither`);
    cache.set(value.printId, value);
  }
  return cache;
}

const args = parseArgs(process.argv.slice(2));
const registry = validateRegistry(JSON.parse(await readFile(resolve(args.sourceRegistry), "utf8")));
const source = registry.sources.find(({ id }) => id === "psp-core-2025");
invariant(source?.enabled, "Enabled psp-core-2025 source is required");
const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");

const cacheDirectory = resolve(args.cache);
const cache = await loadCache(cacheDirectory);
await mkdir(cacheDirectory, { recursive: true });

// Only prints that a potentially attributable record concerns can carry
// attributable conduct; the texts of all other prints are never fetched.
const promiseRegistry = JSON.parse(await readFile(resolve(args.promiseRegistry), "utf8"));
const trackedPartyIds = [...new Set(promiseRegistry.promises.map(({ partyId }) => partyId))].sort();
const prints = collectPrints(collectorRun.records.filter((record) => record.primary === true && isPotentiallyAttributable(record, trackedPartyIds)));
const toFetch = prints.filter((print) => !cache.has(print.printId));
log(`${prints.length} prints concern potentially attributable records; ${toFetch.length} proposal texts to download, ${prints.length - toFetch.length} cached`);

// Texts are downloaded four at a time; each print is saved to the cache at
// once, so an interrupted run keeps every text it already has.
const failures = [];
const tick = progress("downloading proposal texts", toFetch.length);
let nextIndex = 0;
async function downloadWorker() {
  while (nextIndex < toFetch.length) {
    const print = toFetch[nextIndex];
    nextIndex += 1;
    const startedAt = Date.now();
    try {
      const fetched = await fetchProposalText(source, print, source.term.number);
      const entry = { splitterVersion: printPartsSplitterVersion, printId: print.printId, printNumber: print.number, ...fetched, fetchedAt: new Date().toISOString() };
      await writeFile(resolve(cacheDirectory, `${print.printId}.json`), `${JSON.stringify(entry, null, 2)}\n`);
      cache.set(print.printId, entry);
      tick(`print ${print.number}: ${fetched.document ? `${fetched.document.filename}, ${fetched.paragraphs.length} paragraphs` : "no DOCX proposal text, title only"}, ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ printId: print.printId, printNumber: print.number, message });
      log(`print ${print.number}: proposal text not available (${message}); only its title is used in this run`);
      tick(`print ${print.number}: failed`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(4, toFetch.length) }, downloadWorker));

const result = {};
for (const print of prints) {
  print.pageUrl = officialPrintDocumentPageUrl(source.term.number, print.number, print.partNumber);
  const cached = cache.get(print.printId);
  const changes = lawChangesOfPrint({ print, document: cached?.document ?? null, paragraphs: cached?.paragraphs ?? null });
  result[print.printId] = {
    printNumber: print.number,
    kindId: print.kindId,
    titleCz: print.title,
    textStatus: cached?.document ? "proposal-text" : cached ? "no-docx-proposal-text" : "download-failed",
    changes
  };
}

const allChanges = Object.values(result).flatMap(({ changes }) => changes);
const quality = {
  prints: prints.length,
  printsWithProposalText: Object.values(result).filter(({ textStatus }) => textStatus === "proposal-text").length,
  printsWithoutDocxProposalText: Object.values(result).filter(({ textStatus }) => textStatus === "no-docx-proposal-text").length,
  textDownloadFailures: failures.length,
  lawChanges: allChanges.length,
  lawChangesWithAmendedAct: allChanges.filter(({ acts }) => acts.length > 0).length,
  lawChangesWithIdentifiers: allChanges.filter(({ identifiers }) => identifiers.length > 0).length,
  titleOnlyLawChanges: allChanges.filter(({ textCz }) => textCz === null).length
};

await mkdir(resolve(args.output), { recursive: true });
await writeFile(resolve(args.output, "print-parts.json"), `${JSON.stringify({ schemaVersion: "1.0.0", splitterVersion: printPartsSplitterVersion, quality, failures, prints: result }, null, 2)}\n`);
log(`law changes: ${quality.lawChanges} from ${quality.prints} prints (${quality.printsWithProposalText} with a proposal text, ${quality.printsWithoutDocxProposalText} without a DOCX text, ${quality.textDownloadFailures} download failures)`);
console.log(JSON.stringify({ quality, failures }, null, 2));
