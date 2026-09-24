import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isPotentiallyAttributable } from "./lib/attribution.mjs";
import { fetchVerified, invariant, validateRegistry } from "./lib/collector-core.mjs";
import { extractDocxParagraphs, officialPrintDocumentPageUrl, parseOfficialPrintDocumentLinks } from "./lib/psp-print-documents.mjs";
import {
  amendedActsExcerpt,
  billPrintKindIds,
  emptyPrintActsCache,
  namedActsFromBillParagraphs,
  namedActsFromPrintTitle,
  printActsExtractorVersion,
  printIdentifiers,
  validatePrintActsCache
} from "./lib/print-acts.mjs";

/**
 * Derives the acts each Chamber print concerned by a potentially attributable
 * record amends, from its official
 * title and its official bill text, and writes the legal identifiers used
 * as direct routing links (docs/evidence-pipeline.md). Bill texts are
 * fetched once and cached; a failed fetch is reported and leaves the
 * print with its title-derived acts only.
 */
function parseArgs(args) {
  const options = { collectorRun: null, cache: null, output: null, sourceRegistry: "automation/collectors/sources.json", promiseRegistry: "automation/matching/promises.json" };
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

async function fetchBillText(source, print, termNumber) {
  const pageUrl = officialPrintDocumentPageUrl(termNumber, print.number, 0);
  const page = await fetchVerified(source, pageUrl, { maxBytes: 1_000_000, expectedContentTypes: ["text/html"] });
  const links = parseOfficialPrintDocumentLinks(new TextDecoder("windows-1250").decode(page.bytes), pageUrl);
  invariant(links.length > 0, `No official DOCX document found for print ${print.number}`);
  const documents = [];
  const textActs = [];
  for (const link of links) {
    const file = await fetchVerified(source, link.url, {
      maxBytes: 20_000_000,
      expectedContentTypes: ["openxmlformats-officedocument", "application/octet-stream", "application/zip"]
    });
    documents.push({ filename: link.filename, url: file.finalUrl, contentHash: file.contentHash });
    textActs.push(...namedActsFromBillParagraphs(extractDocxParagraphs(file.bytes)));
  }
  const byAct = new Map();
  for (const { act, name } of textActs) if (!byAct.get(act)) byAct.set(act, name);
  return { documents, textActs: [...byAct].map(([act, name]) => ({ act, name })).sort((left, right) => left.act.localeCompare(right.act)) };
}

const args = parseArgs(process.argv.slice(2));
const registry = validateRegistry(JSON.parse(await readFile(resolve(args.sourceRegistry), "utf8")));
const source = registry.sources.find(({ id }) => id === "psp-core-2025");
invariant(source?.enabled, "Enabled psp-core-2025 source is required");
const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");

const cachePath = resolve(args.cache);
let cache = existsSync(cachePath) ? validatePrintActsCache(JSON.parse(await readFile(cachePath, "utf8"))) : emptyPrintActsCache();
if (cache.extractorVersion !== printActsExtractorVersion) cache = emptyPrintActsCache();

// Only prints that a potentially attributable record concerns matter for
// routing; the texts of all other prints are never fetched.
const promiseRegistry = JSON.parse(await readFile(resolve(args.promiseRegistry), "utf8"));
const trackedPartyIds = [...new Set(promiseRegistry.promises.map(({ partyId }) => partyId))].sort();
const prints = collectPrints(collectorRun.records.filter((record) => record.primary === true && isPotentiallyAttributable(record, trackedPartyIds)));
const failures = [];
const result = {};
for (const print of prints) {
  const titleActs = namedActsFromPrintTitle(print.title);
  let textActs = [];
  if (billPrintKindIds.has(print.kindId)) {
    const cached = cache.prints[print.printId];
    if (cached) {
      textActs = cached.textActs;
    } else {
      try {
        const fetched = await fetchBillText(source, print, source.term.number);
        cache.prints[print.printId] = { printNumber: print.number, documents: fetched.documents, textActs: fetched.textActs, extractedAt: new Date().toISOString() };
        textActs = fetched.textActs;
      } catch (error) {
        failures.push({ printId: print.printId, printNumber: print.number, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  const namedActs = new Map();
  for (const { act, name } of [...textActs, ...titleActs]) if (!namedActs.get(act)) namedActs.set(act, name);
  const acts = [...namedActs].map(([act, name]) => ({ act, name }));
  result[print.printId] = {
    printNumber: print.number,
    kindId: print.kindId,
    acts,
    excerpt: amendedActsExcerpt(acts),
    identifiers: printIdentifiers({ kindId: print.kindId, titleActs: titleActs.map(({ act }) => act), textActs: textActs.map(({ act }) => act) })
  };
}

const bills = prints.filter((print) => billPrintKindIds.has(print.kindId));
const quality = {
  prints: prints.length,
  bills: bills.length,
  billsWithText: bills.filter((print) => cache.prints[print.printId]).length,
  billsWithAmendedActs: bills.filter((print) => result[print.printId].acts.length > 0).length,
  billsWithUnnamedActs: bills.filter((print) => result[print.printId].acts.some(({ name }) => !name)).length,
  printsWithIdentifiers: Object.values(result).filter(({ identifiers }) => identifiers.length > 0).length,
  textFetchFailures: failures.length
};

await mkdir(dirname(cachePath), { recursive: true });
await writeFile(cachePath, `${JSON.stringify(validatePrintActsCache(cache), null, 2)}\n`);
await mkdir(resolve(args.output), { recursive: true });
await writeFile(resolve(args.output, "print-acts.json"), `${JSON.stringify({ schemaVersion: "1.0.0", extractorVersion: printActsExtractorVersion, quality, failures, prints: result }, null, 2)}\n`);
console.log(JSON.stringify({ quality, failures }, null, 2));
