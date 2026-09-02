import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildCoverageAudit, renderCoverageAuditMarkdown } from "./lib/coverage-audit.mjs";

function parseArgs(args) {
  const options = {
    collectorRun: null,
    matcherRun: null,
    promises: "automation/matching/promises.json",
    sources: "automation/collectors/sources.json",
    proposals: "automation/review-proposals/manifest.json",
    output: null,
    markdown: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--matcher-run") options.matcherRun = args[++index];
    else if (arg === "--promises") options.promises = args[++index];
    else if (arg === "--sources") options.sources = args[++index];
    else if (arg === "--proposals") options.proposals = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else if (arg === "--markdown") options.markdown = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.collectorRun || !options.matcherRun || !options.output || !options.markdown) throw new Error("--collector-run, --matcher-run, --output, and --markdown are required");
  return options;
}

const args = parseArgs(process.argv.slice(2));
const readJson = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));
const audit = buildCoverageAudit({
  collectorRun: await readJson(args.collectorRun),
  matcherRun: await readJson(args.matcherRun),
  promiseRegistry: await readJson(args.promises),
  sourceRegistry: await readJson(args.sources),
  proposalManifest: await readJson(args.proposals)
});
await mkdir(dirname(resolve(args.output)), { recursive: true });
await writeFile(resolve(args.output), `${JSON.stringify(audit, null, 2)}\n`, { flag: "wx" });
await writeFile(resolve(args.markdown), renderCoverageAuditMarkdown(audit), { flag: "wx" });
console.log(JSON.stringify({ promiseCount: audit.promiseCount, stateCounts: audit.stateCounts, publicationApproved: false }, null, 2));
