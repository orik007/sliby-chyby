import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildCoverageAudit, renderCoverageAuditMarkdown } from "./lib/coverage-audit.mjs";
import { loadTrackedPromises } from "./lib/published-promises.mjs";

function parseArgs(args) {
  const options = {
    collectorRun: null,
    topicRoutingRun: null,
    printParts: null,
    sources: "automation/collectors/sources.json",
    proposals: "automation/review-proposals/manifest.json",
    output: null,
    markdown: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--topic-routing-run") options.topicRoutingRun = args[++index];
    else if (arg === "--print-parts") options.printParts = args[++index];
    else if (arg === "--sources") options.sources = args[++index];
    else if (arg === "--proposals") options.proposals = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--markdown") options.markdown = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.collectorRun || !options.topicRoutingRun || !options.output || !options.markdown) throw new Error("--collector-run, --topic-routing-run, --output, and --markdown are required");
  return options;
}

const args = parseArgs(process.argv.slice(2));
const readJson = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));
const audit = buildCoverageAudit({
  collectorRun: await readJson(args.collectorRun),
  // A partial routing run would report unchecked promises as "no routed
  // law change"; buildCoverageAudit refuses it.
  routingRun: await readJson(args.topicRoutingRun),
  printParts: args.printParts ? await readJson(args.printParts) : null,
  trackedPromises: await loadTrackedPromises(),
  sourceRegistry: await readJson(args.sources),
  proposalManifest: await readJson(args.proposals)
});
await mkdir(dirname(resolve(args.output)), { recursive: true });
await writeFile(resolve(args.output), `${JSON.stringify(audit, null, 2)}\n`, { flag: "wx" });
await writeFile(resolve(args.markdown), renderCoverageAuditMarkdown(audit), { flag: "wx" });
console.log(JSON.stringify({ promiseCount: audit.promiseCount, stateCounts: audit.stateCounts, publicationApproved: false }, null, 2));
