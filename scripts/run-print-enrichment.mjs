import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { validateEvidencePackage } from "./lib/assessment-pipeline.mjs";
import { fetchVerified, sha256, validateRegistry } from "./lib/collector-core.mjs";
import {
  buildPrintDocumentEvidence,
  deriveDocumentSearchTerms,
  extractDocxParagraphs,
  officialPrintDocumentPageUrl,
  parseOfficialPrintDocumentLinks,
  printDocumentEnrichmentVersion,
  selectRelevantDocumentExcerpts
} from "./lib/psp-print-documents.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(args) {
  const options = {
    input: null,
    output: null,
    sourceRegistry: "automation/collectors/sources.json"
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") options.input = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--sources") options.sourceRegistry = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.input, "--input is required");
  invariant(options.output, "--output is required");
  return options;
}

function printReferences(evidencePackage, termNumber) {
  const byId = new Map();
  function addReference(facts, fallbackPublishedAt) {
    if (!facts.externalPrintId || !Number.isInteger(facts.printNumber ?? facts.number)) return;
    const printNumber = facts.printNumber ?? facts.number;
    const partNumber = Number.isInteger(facts.partNumber) ? facts.partNumber : 0;
    const publishedAt = String(facts.documentPublishedAt ?? fallbackPublishedAt).slice(0, 10);
    const reference = {
      externalPrintId: String(facts.externalPrintId),
      printNumber,
      partNumber,
      publishedAt,
      pageUrl: officialPrintDocumentPageUrl(termNumber, printNumber, partNumber)
    };
    byId.set(reference.externalPrintId, reference);
  }
  for (const evidence of evidencePackage.evidence) {
    const facts = evidence.structuredFacts ?? {};
    addReference(facts, evidence.publishedAt);
    for (const linkedPrint of facts.linkedPrints ?? []) addReference(linkedPrint, evidence.publishedAt);
  }
  return [...byId.values()].sort((a, b) => a.printNumber - b.printNumber || a.partNumber - b.partNumber);
}

async function inputFiles(inputPath) {
  const input = resolve(inputPath);
  const metadata = await stat(input);
  if (metadata.isFile()) return [input];
  invariant(metadata.isDirectory(), "--input must be a JSON file or directory");
  return (await readdir(input, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => resolve(input, entry.name))
    .sort();
}

const args = parseArgs(process.argv.slice(2));
const registry = validateRegistry(JSON.parse(await readFile(resolve(args.sourceRegistry), "utf8")));
const pspSource = registry.sources.find(({ id }) => id === "psp-core-2025");
invariant(pspSource?.enabled, "Enabled psp-core-2025 source is required");

const packages = [];
for (const path of await inputFiles(args.input)) {
  packages.push({ path, value: validateEvidencePackage(JSON.parse(await readFile(path, "utf8"))) });
}
const printCache = new Map();
const warnings = [];
async function loadPrintDocument(print) {
  if (printCache.has(print.externalPrintId)) return printCache.get(print.externalPrintId);
  const promise = (async () => {
    const page = await fetchVerified(pspSource, print.pageUrl, { maxBytes: 1_000_000, expectedContentTypes: ["text/html"] });
    const links = parseOfficialPrintDocumentLinks(new TextDecoder("utf-8").decode(page.bytes), print.pageUrl);
    invariant(links.length > 0, `No official DOCX document found for print ${print.printNumber}/${print.partNumber}`);
    const primaryDocument = links[0];
    const file = await fetchVerified(pspSource, primaryDocument.url, {
      maxBytes: 10_000_000,
      expectedContentTypes: ["openxmlformats-officedocument", "application/octet-stream", "application/zip"]
    });
    return {
      filename: primaryDocument.filename,
      url: file.finalUrl,
      bytes: file.bytes,
      pageSnapshotHash: page.contentHash,
      documentContentHash: file.contentHash
    };
  })();
  printCache.set(print.externalPrintId, promise);
  return promise;
}

const outputDirectory = resolve(args.output);
await mkdir(outputDirectory, { recursive: true });
const results = [];
for (const entry of packages) {
  const evidencePackage = structuredClone(entry.value);
  const additions = [];
  for (const print of printReferences(evidencePackage, pspSource.term.number)) {
    try {
      const document = await loadPrintDocument(print);
      const paragraphs = extractDocxParagraphs(document.bytes);
      const searchTerms = deriveDocumentSearchTerms(evidencePackage, print.printNumber);
      const excerpts = selectRelevantDocumentExcerpts(paragraphs, searchTerms);
      if (excerpts.length === 0) {
        warnings.push({ promiseId: evidencePackage.promise.id, printNumber: print.printNumber, reason: "no-relevant-excerpt" });
        continue;
      }
      additions.push(buildPrintDocumentEvidence({ evidencePackage, print, document, paragraphs, excerpts }));
    } catch (error) {
      warnings.push({ promiseId: evidencePackage.promise.id, printNumber: print.printNumber, reason: error.message });
    }
  }
  evidencePackage.evidence.push(...additions);
  evidencePackage.generation.documentEnrichmentVersion = printDocumentEnrichmentVersion;
  evidencePackage.generation.documentEvidenceCount = additions.length;
  evidencePackage.generation.publicationApproved = false;
  validateEvidencePackage(evidencePackage);
  const outputPath = resolve(outputDirectory, basename(entry.path));
  await writeFile(outputPath, `${JSON.stringify(evidencePackage, null, 2)}\n`, { flag: "wx" });
  results.push({
    promiseId: evidencePackage.promise.id,
    inputPackageHash: sha256(entry.value),
    outputPackageHash: sha256(evidencePackage),
    documentEvidenceCount: additions.length,
    outputFile: basename(outputPath)
  });
}

const run = {
  schemaVersion: "1.0.0",
  enrichmentVersion: printDocumentEnrichmentVersion,
  enrichedAt: new Date().toISOString(),
  sourceId: pspSource.id,
  publicationApproved: false,
  results,
  warnings
};
await writeFile(resolve(outputDirectory, "enrichment-run.json"), `${JSON.stringify(run, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ outputDirectory, packageCount: results.length, documentEvidenceCount: results.reduce((sum, result) => sum + result.documentEvidenceCount, 0), warnings: warnings.length, publicationApproved: false }, null, 2));
