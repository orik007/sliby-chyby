import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { billPrintKindIds, isPotentiallyAttributable, versionConcerned } from "./lib/attribution.mjs";
import { invariant, validateRegistry } from "./lib/collector-core.mjs";
import { allSettledOrThrow, createPspFetcher, createPspRequestLog, extractDocParagraphs, extractDocxParagraphs, officialPrintDocumentPageUrl, officialPrintHistoryUrl, pspDownloadSettings } from "./lib/psp-print-documents.mjs";
import { log, progress } from "./lib/run-log.mjs";
import { laterTextDocxLink, laterTextLinks, lawChangesOfPrint, proposalBody, proposalDocumentLink } from "./lib/print-parts.mjs";
import { loadTrackedPromises } from "./lib/published-promises.mjs";

/**
 * Downloads, in every run, the official texts of every Chamber print that a
 * potentially attributable record concerns (the proposal and, for a bill,
 * the text the Chamber approved, the text passed by Parliament, and any
 * Senate resolution returning it) and splits them into law changes with
 * their versions (docs/evidence-pipeline.md, Chamber data rules). Nothing
 * is cached, so a later text is used as soon as psp.cz publishes it. A
 * failed download fails the run; a text that psp.cz lists without a DOCX or
 * DOC file is treated as not published and reported.
 */
function parseArgs(args) {
  const options = { collectorRun: null, output: null, sourceRegistry: "automation/collectors/sources.json" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--sources") options.sourceRegistry = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun && options.output, "--collector-run and --output are required");
  return options;
}

function collectPrints(records) {
  const prints = new Map();
  const add = ({ externalPrintId, printKindId, number, partNumber, titleCz, senateResolutionPartNumbers }) => {
    if (!externalPrintId || !Number.isInteger(number)) return;
    prints.set(String(externalPrintId), {
      printId: String(externalPrintId),
      kindId: printKindId ?? null,
      number,
      partNumber: partNumber ?? 0,
      title: titleCz ?? "",
      senateResolutionPartNumbers: senateResolutionPartNumbers ?? []
    });
  };
  for (const record of records) {
    const payload = record.payload ?? {};
    if (record.kind === "legislative-step") add({ ...payload, number: payload.printNumber, titleCz: payload.printTitleCz });
    for (const linkedPrint of payload.linkedPrints ?? []) add(linkedPrint);
  }
  return [...prints.values()].sort((left, right) => left.number - right.number);
}

const htmlOptions = { maxBytes: 2_000_000, expectedContentTypes: ["text/html"] };
const wordOptions = {
  docx: { maxBytes: 20_000_000, expectedContentTypes: ["openxmlformats-officedocument", "application/octet-stream", "application/zip"] },
  doc: { maxBytes: 20_000_000, expectedContentTypes: ["application/msword", "application/octet-stream"] }
};
const extractParagraphs = { docx: extractDocxParagraphs, doc: extractDocParagraphs };
const decodePage = (page) => new TextDecoder("windows-1250").decode(page.bytes);

// A downloaded DOCX or DOC file that cannot be read as text (for example a
// scanned image) is treated like a text that is not published: reported,
// never fatal. A failed download still fails the run.
async function fetchWordText(source, url, filename, format, warnings, printNumber, version) {
  const file = await fetchPsp(source, url, wordOptions[format]);
  try {
    return { document: { filename, url: file.finalUrl }, paragraphs: proposalBody(await extractParagraphs[format](file.bytes)) };
  } catch (error) {
    warnings.push({ printNumber, kind: `unreadable-${format}`, version, detail: `${filename}: ${error instanceof Error ? error.message : String(error)}` });
    return null;
  }
}

// The Word file listed in a print page's proposal-text section: the
// proposal itself (part 0), a Senate resolution sub-print ("Text"), or the
// sub-print with the text referred to the Senate ("Text").
async function fetchPageText(source, pageUrl, printNumber, warnings, version) {
  const link = proposalDocumentLink(decodePage(await fetchPsp(source, pageUrl, htmlOptions)), pageUrl);
  return link ? fetchWordText(source, link.url, link.filename, link.format, warnings, printNumber, version) : null;
}

function fetchPrintPageText(source, termNumber, printNumber, partNumber, warnings, version) {
  return fetchPageText(source, officialPrintDocumentPageUrl(termNumber, printNumber, partNumber), printNumber, warnings, version);
}

// The names psp.cz gives the later-text pages, used to trace a version.
const laterTextNames = { approved: (number) => `Schválený text tisku ${number} (DOCX)`, passed: (number) => `Text tisku ${number} přijatý Parlamentem (DOCX)` };

async function laterText(source, print, version, url, warnings) {
  const docxUrl = laterTextDocxLink(decodePage(await fetchPsp(source, url, htmlOptions)), url);
  if (!docxUrl) {
    warnings.push({ printNumber: print.number, kind: "later-text-without-docx", version, detail: `the ${version} text is listed without a DOCX file` });
    return null;
  }
  return fetchWordText(source, docxUrl, laterTextNames[version](print.number), "docx", warnings, print.number, version);
}

// The approved text of a bill the Senate rejected: the sub-print with the
// text referred to the Senate. A sub-print without a readable Word file is
// reported like a later text without one.
async function referredText(source, print, url, warnings) {
  const text = await fetchPageText(source, url, print.number, warnings, "approved");
  if (!text && !warnings.some(({ version }) => version === "approved")) {
    warnings.push({ printNumber: print.number, kind: "later-text-without-docx", version: "approved", detail: "the approved text (the sub-print referred to the Senate) is listed without a DOCX or DOC file" });
  }
  return text;
}

async function senateResolution(source, termNumber, print, partNumber, warnings) {
  const resolution = await fetchPrintPageText(source, termNumber, print.number, partNumber, warnings, "senate-resolution");
  if (!resolution) warnings.push({ printNumber: print.number, kind: "senate-resolution-without-text", detail: `the Senate resolution ${print.number}/${partNumber} has no readable DOCX or DOC text` });
  return resolution ? { partNumber, ...resolution } : null;
}

async function fetchPrintTexts(source, print, termNumber) {
  const warnings = [];
  const bill = billPrintKindIds.has(String(print.kindId));
  const historyUrl = officialPrintHistoryUrl(termNumber, print.number);
  const [proposal, historyPage] = await allSettledOrThrow([
    fetchPrintPageText(source, termNumber, print.number, print.partNumber, warnings, "proposed"),
    bill ? fetchPsp(source, historyUrl, htmlOptions) : null
  ]);
  const links = historyPage ? laterTextLinks(decodePage(historyPage), historyUrl) : { approved: null, passed: null, referredToSenate: null };
  // Without an approved-text page, the approved text is the sub-print with
  // the text referred to the Senate, when the history links one.
  const approvedText = links.approved
    ? laterText(source, print, "approved", links.approved, warnings)
    : links.referredToSenate ? referredText(source, print, links.referredToSenate, warnings) : null;
  const [approved, passed, ...resolutions] = await allSettledOrThrow([
    approvedText,
    links.passed ? laterText(source, print, "passed", links.passed, warnings) : null,
    ...print.senateResolutionPartNumbers.map((partNumber) => senateResolution(source, termNumber, print, partNumber, warnings))
  ]);
  const texts = Object.fromEntries(Object.entries({ proposed: proposal, approved, passed }).filter(([, text]) => text));
  return { texts, senateResolutions: resolutions.filter(Boolean), warnings };
}

const args = parseArgs(process.argv.slice(2));

// Every attempt and new connection to psp.cz is appended to
// psp-requests.jsonl next to the output as it happens, so the file survives
// a failed download and a step that times out, and the site's limits can be
// measured from the run artifact.
mkdirSync(resolve(args.output), { recursive: true });
const pspRequestFile = resolve(args.output, "psp-requests.jsonl");
writeFileSync(pspRequestFile, "");
const pspRequests = createPspRequestLog({ onEntry: (entry) => appendFileSync(pspRequestFile, `${JSON.stringify(entry)}\n`) });
const fetchPsp = createPspFetcher({ ...pspDownloadSettings, onAttempt: pspRequests.onAttempt });

const registry = validateRegistry(JSON.parse(await readFile(resolve(args.sourceRegistry), "utf8")));
const source = registry.sources.find(({ id }) => id === "psp-core-2025");
invariant(source?.enabled, "Enabled psp-core-2025 source is required");
const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");

// Only prints that a potentially attributable record concerns can carry
// attributable conduct; the texts of all other prints are never fetched.
const { promises } = await loadTrackedPromises();
const trackedPartyIds = [...new Set(promises.map(({ partyId }) => partyId))].sort();
const conductRecords = collectorRun.records.filter((record) => record.primary === true && isPotentiallyAttributable(record, trackedPartyIds));
const prints = collectPrints(conductRecords);
// Bills with a decisive vote on their approved text (the rule of
// versionConcerned): each should have an approved text on psp.cz, so one
// without it shows a text psp.cz does not publish or a history page that
// was not read.
const approvedPrintIds = new Set(conductRecords.flatMap((record) => (record.payload?.linkedPrints ?? [])
  .filter((print) => versionConcerned(record, print.externalPrintId)?.version === "approved")
  .map((print) => String(print.externalPrintId))));
log(`${prints.length} prints concern potentially attributable records; downloading their proposal texts, later texts, and Senate resolutions`);

// Prints are processed two at a time and each request to psp.cz goes
// through fetchPsp, which keeps at most two open. A failed download stops
// the run: a law change must never silently miss a text. After a failure no
// worker starts another print, and the run waits for the requests still
// open, so the request log is complete when it is closed.
const fetched = new Map();
const tick = progress("downloading print texts", prints.length);
let nextIndex = 0;
let downloadFailed = false;
async function downloadWorker() {
  while (!downloadFailed && nextIndex < prints.length) {
    const print = prints[nextIndex];
    nextIndex += 1;
    const startedAt = Date.now();
    let result;
    try {
      result = await fetchPrintTexts(source, print, source.term.number);
    } catch (error) {
      downloadFailed = true;
      throw error;
    }
    fetched.set(print.printId, result);
    const versions = Object.keys(result.texts);
    tick(`print ${print.number}: ${versions.length > 0 ? versions.join(", ") : "no DOCX or DOC proposal text, title only"}${result.senateResolutions.length > 0 ? `, ${result.senateResolutions.length} Senate resolution(s)` : ""}, ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  }
}
try {
  await allSettledOrThrow(Array.from({ length: Math.min(pspDownloadSettings.concurrency, prints.length) }, downloadWorker));
} finally {
  pspRequests.stop();
  const usage = pspRequests.summary();
  log(`psp.cz requests: ${usage.attempts} attempts for ${usage.urls} URLs in ${usage.minutes} min (${usage.attemptsPerMinute ?? "-"}/min, at most ${usage.busiestMinuteAttempts} in any 60 s), ${usage.failedAttempts} failed ${JSON.stringify(usage.failedAttemptsBy)}; ${usage.connections} new connections (${usage.connectionsPerMinute ?? "-"}/min, at most ${usage.busiestMinuteConnections} in any 60 s), ${usage.failedConnections} failed ${JSON.stringify(usage.failedConnectionsBy)}`);
}

const result = {};
for (const print of prints) {
  print.pageUrl = officialPrintDocumentPageUrl(source.term.number, print.number, print.partNumber);
  const { texts, senateResolutions, warnings } = fetched.get(print.printId);
  if (approvedPrintIds.has(print.printId) && !texts.approved && !warnings.some(({ version }) => version === "approved")) {
    warnings.push({ printNumber: print.number, kind: "approved-without-approved-text", detail: "a vote on the approved text is recorded, but psp.cz lists no approved text" });
  }
  for (const warning of warnings) log(`print ${warning.printNumber}: ${warning.detail}`);
  result[print.printId] = {
    printNumber: print.number,
    kindId: print.kindId,
    titleCz: print.title,
    versions: Object.keys(texts),
    warnings,
    changes: lawChangesOfPrint({ print, texts, senateResolutions })
  };
}

const allChanges = Object.values(result).flatMap(({ changes }) => changes);
const quality = {
  prints: prints.length,
  printsWithProposalText: Object.values(result).filter(({ versions }) => versions.includes("proposed")).length,
  printsWithoutProposalText: Object.values(result).filter(({ versions }) => !versions.includes("proposed")).length,
  printsWithApprovedText: Object.values(result).filter(({ versions }) => versions.includes("approved")).length,
  printsWithPassedText: Object.values(result).filter(({ versions }) => versions.includes("passed")).length,
  printsWithSenateResolution: Object.values(result).filter(({ changes }) => changes[0]?.senateResolutions.length > 0).length,
  approvedBillsWithoutApprovedText: Object.values(result).filter(({ warnings }) => warnings.some(({ kind }) => kind === "approved-without-approved-text")).length,
  textWarnings: Object.values(result).reduce((sum, { warnings }) => sum + warnings.length, 0),
  lawChanges: allChanges.length,
  lawChangesAddedInDebate: allChanges.filter(({ addedIn }) => addedIn !== "proposed").length,
  lawChangesRemovedInDebate: allChanges.filter(({ versions }) => Object.values(versions).some((version) => version.removed)).length,
  lawChangesWithAmendedAct: allChanges.filter(({ acts }) => acts.length > 0).length,
  titleOnlyLawChanges: allChanges.filter(({ versions }) => versions.proposed && !versions.proposed.removed && versions.proposed.textCz === null).length
};

await writeFile(resolve(args.output, "print-parts.json"), `${JSON.stringify({ schemaVersion: "1.0.0", quality, prints: result }, null, 2)}\n`);
log(`law changes: ${quality.lawChanges} from ${quality.prints} prints (${quality.printsWithProposalText} with a proposal text, ${quality.printsWithApprovedText} with an approved text, ${quality.printsWithPassedText} with a passed text, ${quality.printsWithSenateResolution} with a Senate resolution, ${quality.textWarnings} text warning(s))`);
console.log(JSON.stringify({ quality }, null, 2));
