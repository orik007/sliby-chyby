import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { invariant } from "./lib/collector-core.mjs";
import { createESbirkaClient, createLawContextCache, createLawContextReader, ESbirkaUnavailableError } from "./lib/e-sbirka.mjs";
import { contextStatusCounts, lawContextVersion, resolveLawChangeContext } from "./lib/law-context.mjs";
import { writeJsonAtomically } from "./lib/paired-model-calls.mjs";
import { loadTrackedPromises } from "./lib/published-promises.mjs";
import { log, progress } from "./lib/run-log.mjs";
import { conductOfRun, lawChangesOfRun } from "./lib/topic-evidence-package.mjs";

/**
 * Reads the context of every law change of the run: the wording of each
 * provision its amending instructions name, in force on the date of the
 * earliest conduct on each version, from the e-Sbírka REST API
 * (docs/evidence-pipeline.md, Law-change context). Everything read is kept
 * in the permanent per-act cache; a run requests only what the cache lacks.
 * A technical failure of e-Sbírka after every retry fails the run; a
 * provision that e-Sbírka does not hold only sets its status.
 */
function parseArgs(args) {
  const options = { collectorRun: null, printParts: null, asOf: null, cache: "automation/law-context", output: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--print-parts") options.printParts = args[++index];
    else if (arg === "--as-of") options.asOf = args[++index];
    else if (arg === "--cache") options.cache = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun && options.printParts && options.output, "--collector-run, --print-parts, and --output are required");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(options.asOf ?? ""), "--as-of must use YYYY-MM-DD");
  return options;
}

const args = parseArgs(process.argv.slice(2));
mkdirSync(resolve(args.output), { recursive: true });
// Every request to e-Sbírka is appended as it happens, so the file survives a
// failed run.
const requestFile = resolve(args.output, "e-sbirka-requests.jsonl");
writeFileSync(requestFile, "");
const requests = { attempts: 0, failed: 0 };
const client = createESbirkaClient({
  onRequest: (entry) => {
    requests.attempts += 1;
    if (!entry.ok) {
      requests.failed += 1;
      log(`e-Sbírka request failed (${entry.purpose}): ${entry.error}`);
    }
    appendFileSync(requestFile, `${JSON.stringify(entry)}\n`);
  }
});
const cache = createLawContextCache(resolve(args.cache));
const reader = createLawContextReader({ client, cache });

const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
const printParts = JSON.parse(await readFile(resolve(args.printParts), "utf8"));
invariant(printParts?.schemaVersion === "1.0.0" && printParts.prints && typeof printParts.prints === "object", "Invalid --print-parts file");
const { promises } = await loadTrackedPromises();
const trackedPartyIds = [...new Set(promises.map(({ partyId }) => partyId))].sort();
const { recordsByPrintId } = conductOfRun(collectorRun, args.asOf, trackedPartyIds);
const changes = lawChangesOfRun(printParts, recordsByPrintId);
log(`law-change context: ${changes.length} law changes; reading the wording of the provisions they amend from the e-Sbírka REST API, cached ones from ${args.cache}`);

const contexts = {};
const tick = progress("law-change context", changes.length, { every: 20 });
try {
  for (const change of changes) {
    contexts[change.changeId] = await resolveLawChangeContext(change, recordsByPrintId.get(change.printId) ?? [], reader);
    const versions = Object.keys(contexts[change.changeId].versions);
    tick(`${change.changeId}: ${versions.length > 0 ? versions.join(", ") : "no context (amends no act or has no conduct)"}`);
  }
} catch (error) {
  await cache.flush();
  if (error instanceof ESbirkaUnavailableError) log(`e-Sbírka is unavailable; the run fails: ${error.message}`);
  throw error;
}
await cache.flush();

const statuses = contextStatusCounts(Object.values(contexts));
const quality = {
  lawChanges: changes.length,
  lawChangesWithContext: Object.values(contexts).filter(({ versions }) => Object.keys(versions).length > 0).length,
  versionsWithContext: Object.values(contexts).reduce((sum, { versions }) => sum + Object.keys(versions).length, 0),
  targetsByStatus: statuses,
  eSbirkaRequests: requests.attempts,
  eSbirkaFailedRequests: requests.failed,
  cachedWordingLists: reader.stats.cachedWordingLists,
  cachedWordings: reader.stats.cachedWordings,
  cachedPromulgations: reader.stats.cachedPromulgations,
  wordingsChangedSinceLastCheck: reader.stats.changedWordings
};
await writeJsonAtomically(resolve(args.output, "law-context.json"), { schemaVersion: "1.0.0", contextVersion: lawContextVersion, asOf: args.asOf, quality, changes: contexts });
log(`law-change context: ${quality.lawChangesWithContext} of ${quality.lawChanges} law changes with context; targets ${JSON.stringify(statuses)}; ${requests.attempts} e-Sbírka requests (${requests.failed} failed and retried)`);
console.log(JSON.stringify({ quality }, null, 2));
