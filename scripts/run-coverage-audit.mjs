import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildCoverageAudit, renderCoverageAuditMarkdown } from "./lib/coverage-audit.mjs";
import { loadPublishedPromiseIds, publishedMatchingRegistry } from "./lib/published-promises.mjs";

function parseArgs(args) {
  const options = {
    collectorRun: null,
    topicRoutingRun: null,
    promises: "automation/matching/promises.json",
    publishedPromises: "data/promises",
    sources: "automation/collectors/sources.json",
    proposals: "automation/review-proposals/manifest.json",
    output: null,
    markdown: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--topic-routing-run") options.topicRoutingRun = args[++index];
    else if (arg === "--promises") options.promises = args[++index];
    else if (arg === "--published-promises") options.publishedPromises = args[++index];
    else if (arg === "--sources") options.sources = args[++index];
    else if (arg === "--proposals") options.proposals = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--markdown") options.markdown = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.collectorRun || !options.topicRoutingRun || !options.output || !options.markdown) throw new Error("--collector-run, --topic-routing-run, --output, and --markdown are required");
  return options;
}

// buildCoverageAudit (scripts/lib/coverage-audit.mjs) speaks the old
// matcher's per-promise report shape (candidateMatchCount,
// attributablePrimaryMatchCount, evidencePackage) unchanged, since that
// logic is otherwise untouched by the topic-routing migration. This adapts
// a topic-routing report into that same shape rather than duplicating or
// rewriting the (already tested) coverage-audit logic itself.
function matcherRunFromTopicRoutingRun(topicRoutingRun, promises) {
  const candidateCountsByPromise = new Map();
  for (const { route } of topicRoutingRun.sourceTagAssignments) {
    if (route.disposition !== "candidate-created") continue;
    for (const promiseId of route.candidatePromiseIds) {
      candidateCountsByPromise.set(promiseId, (candidateCountsByPromise.get(promiseId) ?? 0) + 1);
    }
  }
  const packagesByPromise = new Map(topicRoutingRun.builtPackages.filter((entry) => entry.built).map((entry) => [entry.promiseId, entry]));
  return {
    schemaVersion: "1.0.0",
    promiseResults: promises.map((promise) => {
      const built = packagesByPromise.get(promise.id);
      return {
        promiseId: promise.id,
        candidateMatchCount: candidateCountsByPromise.get(promise.id) ?? 0,
        attributablePrimaryMatchCount: built?.selectedEvidenceCount ?? 0,
        evidencePackage: built ? `evidence-packages/${promise.id}.json` : null
      };
    })
  };
}

const args = parseArgs(process.argv.slice(2));
const readJson = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));
const promiseRegistry = publishedMatchingRegistry(await readJson(args.promises), await loadPublishedPromiseIds(args.publishedPromises));
const audit = buildCoverageAudit({
  collectorRun: await readJson(args.collectorRun),
  matcherRun: matcherRunFromTopicRoutingRun(await readJson(args.topicRoutingRun), promiseRegistry.promises),
  promiseRegistry,
  sourceRegistry: await readJson(args.sources),
  proposalManifest: await readJson(args.proposals)
});
await mkdir(dirname(resolve(args.output)), { recursive: true });
await writeFile(resolve(args.output), `${JSON.stringify(audit, null, 2)}\n`, { flag: "wx" });
await writeFile(resolve(args.markdown), renderCoverageAuditMarkdown(audit), { flag: "wx" });
console.log(JSON.stringify({ promiseCount: audit.promiseCount, stateCounts: audit.stateCounts, publicationApproved: false }, null, 2));
