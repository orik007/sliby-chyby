import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { billPrintKindIds, isPotentiallyAttributable, versionConcerned } from "./lib/attribution.mjs";
import { invariant, validateRegistry } from "./lib/collector-core.mjs";
import { createESbirkaClient, createLawContextCache, createLawContextReader, ESbirkaUnavailableError, workflowRunId } from "./lib/e-sbirka.mjs";
import { allSettledOrThrow, createPspFetcher, createPspRequestLog, extractDocParagraphs, extractDocxParagraphs, officialPrintDocumentPageUrl, officialPrintHistoryUrl, pspDownloadSettings, pspProxyUrl } from "./lib/psp-print-documents.mjs";
import { createPspDocumentCache } from "./lib/psp-document-cache.mjs";
import { log, progress } from "./lib/run-log.mjs";
import { collectPrints, governmentOpinionSectionLabels, laterTextDocxLink, laterTextLinks, lawChangesOfPrint, promulgatedActOfHistory, promulgatedTextUrl, promulgatedTextVersions, proposalBody, proposalDocumentLink, readPromulgatedParagraphs } from "./lib/print-parts.mjs";
import { loadTrackedPromises } from "./lib/published-promises.mjs";

/**
 * Downloads, in every run, the official texts of every Chamber print that a
 * potentially attributable record concerns (the proposal and, for a bill,
 * the text the Chamber approved, the text passed by Parliament, any Senate
 * resolution returning it, and the government's opinion on a bill it did
 * not submit) and splits them into law changes with
 * their versions (docs/evidence-pipeline.md, Chamber data rules). Nothing
 * is cached, so a later text is used as soon as psp.cz publishes it. When
 * psp.cz does not publish the text a decisive vote concerned and the bill was
 * promulgated, that version's text is the act as promulgated, read from the
 * e-Sbírka REST API through the permanent law-context cache (--cache). A
 * failed download fails the run; a text that psp.cz lists without a DOCX or
 * DOC file is treated as not published and reported. A Word file under a
 * psp.cz document ID does not change, so its text is read from the document
 * cache (--document-cache, scripts/lib/psp-document-cache.mjs) once it was
 * downloaded; only the pages that list the files are read in every run.
 */
function parseArgs(args) {
  const options = { collectorRun: null, output: null, documentCache: "automation/psp-documents", cache: "automation/law-context", sourceRegistry: "automation/collectors/sources.json" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--sources") options.sourceRegistry = args[++index];
    else if (arg === "--document-cache") options.documentCache = args[++index];
    else if (arg === "--cache") options.cache = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun && options.output, "--collector-run and --output are required");
  return options;
}

const htmlOptions = { maxBytes: 2_000_000, expectedContentTypes: ["text/html"] };
const wordOptions = {
  docx: { maxBytes: 20_000_000, expectedContentTypes: ["openxmlformats-officedocument", "application/octet-stream", "application/zip"] },
  doc: { maxBytes: 20_000_000, expectedContentTypes: ["application/msword", "application/octet-stream"] }
};
const extractParagraphs = { docx: extractDocxParagraphs, doc: extractDocParagraphs };
// The extractions the document cache keeps, named with their version: a
// changed extractor must change its name, so every file is read again.
const extractionNames = { docx: "docx-paragraphs-v1", doc: "doc-paragraphs-v1" };
const decodePage = (page) => new TextDecoder("windows-1250").decode(page.bytes);

// A downloaded DOCX or DOC file that cannot be read as text (for example a
// scanned image) is treated like a text that is not published: reported,
// never fatal. A failed download still fails the run.
async function fetchWordText(source, url, filename, format, warnings, printNumber, version) {
  const { value: paragraphs, error } = await documentCache.read(url, extractionNames[format], extractParagraphs[format], async () => (await fetchPsp(source, url, wordOptions[format])).bytes);
  if (error) {
    warnings.push({ printNumber, kind: `unreadable-${format}`, version, detail: `${filename}: ${error}` });
    return null;
  }
  return { document: { filename, url }, paragraphs: proposalBody(paragraphs) };
}

// The Word file listed in a print page's proposal-text section: the
// proposal itself (part 0), a Senate resolution sub-print ("Text"), or the
// sub-print with the text referred to the Senate ("Text").
async function fetchPageText(source, pageUrl, printNumber, warnings, version, sectionLabels = undefined) {
  const link = proposalDocumentLink(decodePage(await fetchPsp(source, pageUrl, htmlOptions)), pageUrl, sectionLabels);
  return link ? fetchWordText(source, link.url, link.filename, link.format, warnings, printNumber, version) : null;
}

function fetchPrintPageText(source, termNumber, printNumber, partNumber, warnings, version, sectionLabels = undefined) {
  return fetchPageText(source, officialPrintDocumentPageUrl(termNumber, printNumber, partNumber), printNumber, warnings, version, sectionLabels);
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

// The government's opinion on a bill it did not submit: the Word file of the
// sub-print's "Stanovisko" section. Without one, the opinion is still
// conduct, assessed by its result, and reported.
async function governmentOpinion(source, termNumber, print, partNumber, warnings) {
  const opinion = await fetchPrintPageText(source, termNumber, print.number, partNumber, warnings, "government-opinion", governmentOpinionSectionLabels);
  if (!opinion) warnings.push({ printNumber: print.number, kind: "government-opinion-without-text", detail: `the government opinion ${print.number}/${partNumber} has no readable DOCX or DOC text` });
  return opinion ? { partNumber, ...opinion } : null;
}

async function fetchPrintTexts(source, print, termNumber) {
  const warnings = [];
  const bill = billPrintKindIds.has(String(print.kindId));
  const historyUrl = officialPrintHistoryUrl(termNumber, print.number);
  const [proposal, historyPage] = await allSettledOrThrow([
    fetchPrintPageText(source, termNumber, print.number, print.partNumber, warnings, "proposed"),
    bill ? fetchPsp(source, historyUrl, htmlOptions) : null
  ]);
  const history = historyPage ? decodePage(historyPage) : null;
  const links = history ? laterTextLinks(history, historyUrl) : { approved: null, passed: null, referredToSenate: null };
  // Without an approved-text page, the approved text is the sub-print with
  // the text referred to the Senate, when the history links one.
  const approvedText = links.approved
    ? laterText(source, print, "approved", links.approved, warnings)
    : links.referredToSenate ? referredText(source, print, links.referredToSenate, warnings) : null;
  const [[approved, passed], resolutions, opinions] = await allSettledOrThrow([
    allSettledOrThrow([approvedText, links.passed ? laterText(source, print, "passed", links.passed, warnings) : null]),
    allSettledOrThrow(print.senateResolutionPartNumbers.map((partNumber) => senateResolution(source, termNumber, print, partNumber, warnings))),
    allSettledOrThrow(print.governmentOpinionPartNumbers.map((partNumber) => governmentOpinion(source, termNumber, print, partNumber, warnings)))
  ]);
  const texts = Object.fromEntries(Object.entries({ proposed: proposal, approved, passed }).filter(([, text]) => text));
  return {
    texts,
    senateResolutions: resolutions.filter(Boolean),
    governmentOpinions: opinions.filter(Boolean),
    warnings,
    promulgation: history ? promulgatedActOfHistory(history) : null,
    passedListed: Boolean(links.passed)
  };
}

const args = parseArgs(process.argv.slice(2));

// Every attempt and new connection to psp.cz is appended to
// psp-requests.jsonl next to the output as it happens, so the file survives
// a failed download and a step that times out, and the site's limits can be
// measured from the run artifact. Through a proxy (PSP_PROXY_URL), the new
// connections recorded are those to the proxy.
mkdirSync(resolve(args.output), { recursive: true });
const pspRequestFile = resolve(args.output, "psp-requests.jsonl");
writeFileSync(pspRequestFile, "");
const proxyUrl = pspProxyUrl();
if (proxyUrl) log("psp.cz requests go through the proxy in PSP_PROXY_URL");
// undici reports an IPv6 host without its brackets.
const pspRequests = createPspRequestLog({ ...(proxyUrl ? { hostname: new URL(proxyUrl).hostname.replace(/^\[(.*)\]$/, "$1") } : {}), onEntry: (entry) => appendFileSync(pspRequestFile, `${JSON.stringify(entry)}\n`) });
const fetchPsp = createPspFetcher({ ...pspDownloadSettings, proxyUrl, onAttempt: pspRequests.onAttempt });
// The text of every psp.cz Word file read so far, under its document ID,
// dated by the run's Prague calendar date (scripts/lib/psp-document-cache.mjs).
const runDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const documentCache = createPspDocumentCache(resolve(args.documentCache), runDate);
// The files checked again in every run, oldest check first
// (docs/evidence-pipeline.md, Chamber data rules).
const documentSampleSize = 20;

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
// The versions the decisive votes on each print concern (the rule of
// versionConcerned). A bill with a vote on its approved text should have an
// approved text on psp.cz, so one without it shows a text psp.cz does not
// publish or a history page that was not read.
const concernedByPrint = new Map();
for (const record of conductRecords) {
  for (const print of record.payload?.linkedPrints ?? []) {
    const concerned = versionConcerned(record, print.externalPrintId);
    const printId = String(print.externalPrintId);
    if (concerned) concernedByPrint.set(printId, [...(concernedByPrint.get(printId) ?? []), concerned]);
  }
}
log(`${prints.length} prints concern potentially attributable records; downloading their proposal texts, later texts, Senate resolutions, and government opinions`);

// Prints are processed as many at a time as fetchPsp keeps requests open
// (pspDownloadSettings.concurrency), each request through it. A failed download stops
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
    tick(`print ${print.number}: ${versions.length > 0 ? versions.join(", ") : "no DOCX or DOC proposal text, title only"}${result.senateResolutions.length > 0 ? `, ${result.senateResolutions.length} Senate resolution(s)` : ""}${result.governmentOpinions.length > 0 ? `, ${result.governmentOpinions.length} government opinion(s)` : ""}, ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  }
}
try {
  await allSettledOrThrow(Array.from({ length: Math.min(pspDownloadSettings.concurrency, prints.length) }, downloadWorker));
  // The files checked longest ago are downloaded again; one that changed
  // under its ID fails the run.
  const checked = await documentCache.checkSample(async (url) => (await fetchPsp(source, url, { maxBytes: 20_000_000, expectedContentTypes: [...new Set([...wordOptions.docx.expectedContentTypes, ...wordOptions.doc.expectedContentTypes, "spreadsheetml"])] })).bytes, documentSampleSize);
  log(`psp.cz document cache: ${documentCache.size()} files, ${documentCache.stats.fromCache} texts read from it, ${documentCache.stats.downloaded} downloaded in this run, ${checked.length} checked again and unchanged`);
} finally {
  await fetchPsp.close();
  pspRequests.stop();
  const usage = pspRequests.summary();
  log(`psp.cz requests: ${usage.attempts} attempts for ${usage.urls} URLs in ${usage.minutes} min (${usage.attemptsPerMinute ?? "-"}/min, at most ${usage.busiestMinuteAttempts} in any 60 s), ${usage.failedAttempts} failed ${JSON.stringify(usage.failedAttemptsBy)}; ${usage.connections} new connections (${usage.connectionsPerMinute ?? "-"}/min, at most ${usage.busiestMinuteConnections} in any 60 s), ${usage.failedConnections} failed ${JSON.stringify(usage.failedConnectionsBy)}`);
}

// The act as promulgated, for each version a decisive vote concerned that
// psp.cz does not publish (docs/evidence-pipeline.md, Text from the Collection of Laws). Every
// request to e-Sbírka is appended to e-sbirka-requests.jsonl as it happens; a
// technical failure of e-Sbírka after every retry fails the run.
const eSbirkaRequestFile = resolve(args.output, "e-sbirka-requests.jsonl");
writeFileSync(eSbirkaRequestFile, "");
const lawContextCache = createLawContextCache(resolve(args.cache));
let reader = null;
const promulgatedTexts = [];
const eSbirkaRequests = { attempts: 0, failed: 0 };
try {
  for (const print of prints) {
    const fetchedPrint = fetched.get(print.printId);
    const { texts, warnings, promulgation, passedListed } = fetchedPrint;
    // What psp.cz itself publishes, for the warnings below.
    fetchedPrint.pspVersions = Object.keys(texts);
    const versions = promulgatedTextVersions({ texts, concerned: concernedByPrint.get(print.printId) ?? [], promulgation, senateReturned: print.senateResolutionPartNumbers.length > 0, passedListed });
    if (versions.length === 0) continue;
    reader ??= createLawContextReader({
      client: createESbirkaClient({
        onRequest: (entry) => {
          eSbirkaRequests.attempts += 1;
          if (!entry.ok) {
            eSbirkaRequests.failed += 1;
            log(`e-Sbírka request failed (${entry.purpose}): ${entry.error}`);
          }
          appendFileSync(eSbirkaRequestFile, `${JSON.stringify(entry)}\n`);
        }
      }),
      cache: lawContextCache,
      runId: workflowRunId()
    });
    const paragraphs = await readPromulgatedParagraphs(reader, promulgation.act);
    const label = versions.join(" and ");
    if (!paragraphs) {
      for (const version of versions) warnings.push({ printNumber: print.number, kind: "promulgated-text-not-digitised", version, detail: `psp.cz does not publish the ${version} text, and e-Sbírka does not yet hold the text of ${promulgation.act} Sb., the act it became` });
      continue;
    }
    for (const version of versions) texts[version] = { document: { filename: `Zákon č. ${promulgation.act} Sb. ve vyhlášeném znění (e-Sbírka)`, url: promulgatedTextUrl(promulgation.act) }, paragraphs: proposalBody(paragraphs), promulgatedAct: promulgation.act };
    promulgatedTexts.push(print.number);
    log(`print ${print.number}: the ${label} text is ${promulgation.act} Sb. as promulgated on ${promulgation.promulgatedOn}, from e-Sbírka; psp.cz does not publish it`);
  }
} catch (error) {
  await lawContextCache.flush();
  if (error instanceof ESbirkaUnavailableError) log(`e-Sbírka is unavailable; the run fails: ${error.message}`);
  throw error;
}
await lawContextCache.flush();

const result = {};
for (const print of prints) {
  print.pageUrl = officialPrintDocumentPageUrl(source.term.number, print.number, print.partNumber);
  const { texts, senateResolutions, governmentOpinions, warnings, pspVersions } = fetched.get(print.printId);
  // Counted by what psp.cz publishes, also when e-Sbírka supplied the text.
  if ((concernedByPrint.get(print.printId) ?? []).some(({ version }) => version === "approved") && !pspVersions.includes("approved") && !warnings.some(({ kind, version }) => version === "approved" && kind !== "promulgated-text-not-digitised")) {
    warnings.push({ printNumber: print.number, kind: "approved-without-approved-text", detail: "a vote on the approved text is recorded, but psp.cz lists no approved text" });
  }
  for (const warning of warnings) log(`print ${warning.printNumber}: ${warning.detail}`);
  result[print.printId] = {
    printNumber: print.number,
    kindId: print.kindId,
    titleCz: print.title,
    versions: Object.keys(texts),
    warnings,
    changes: lawChangesOfPrint({ print, texts, senateResolutions, governmentOpinions })
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
  // The government's opinions on bills it did not submit that are conduct,
  // and those of them psp.cz lists without a readable Word file.
  governmentOpinions: prints.reduce((sum, { governmentOpinionPartNumbers }) => sum + governmentOpinionPartNumbers.length, 0),
  governmentOpinionsWithoutText: Object.values(result).reduce((sum, { warnings }) => sum + warnings.filter(({ kind }) => kind === "government-opinion-without-text").length, 0),
  printsWithPromulgatedText: promulgatedTexts.length,
  eSbirkaRequests: eSbirkaRequests.attempts,
  eSbirkaFailedRequests: eSbirkaRequests.failed,
  approvedBillsWithoutApprovedText: Object.values(result).filter(({ warnings }) => warnings.some(({ kind }) => kind === "approved-without-approved-text")).length,
  textWarnings: Object.values(result).reduce((sum, { warnings }) => sum + warnings.length, 0),
  lawChanges: allChanges.length,
  lawChangesAddedInDebate: allChanges.filter(({ addedIn }) => addedIn !== "proposed").length,
  lawChangesRemovedInDebate: allChanges.filter(({ versions }) => Object.values(versions).some((version) => version.removed)).length,
  lawChangesWithAmendedAct: allChanges.filter(({ acts }) => acts.length > 0).length,
  titleOnlyLawChanges: allChanges.filter(({ versions }) => versions.proposed && !versions.proposed.removed && versions.proposed.textCz === null).length
};

await writeFile(resolve(args.output, "print-parts.json"), `${JSON.stringify({ schemaVersion: "1.0.0", quality, prints: result }, null, 2)}\n`);
log(`law changes: ${quality.lawChanges} from ${quality.prints} prints (${quality.printsWithProposalText} with a proposal text, ${quality.printsWithApprovedText} with an approved text, ${quality.printsWithPassedText} with a passed text, ${quality.printsWithPromulgatedText} with a text from e-Sbírka, ${quality.printsWithSenateResolution} with a Senate resolution, ${quality.governmentOpinions} government opinion(s) of which ${quality.governmentOpinionsWithoutText} without a text, ${quality.textWarnings} text warning(s))`);
console.log(JSON.stringify({ quality }, null, 2));
