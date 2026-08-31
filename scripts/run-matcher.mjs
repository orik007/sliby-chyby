import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { sha256 } from "./lib/collector-core.mjs";
import {
  buildEvidencePackage,
  matchCollectorRecords,
  summarizeMatch,
  validatePromiseRegistry
} from "./lib/evidence-matcher.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(args) {
  const options = {
    collectorRun: null,
    promiseRegistry: "automation/matching/promises.json",
    promiseIds: [],
    asOf: null,
    output: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collector-run") options.collectorRun = args[++index];
    else if (arg === "--promises") options.promiseRegistry = args[++index];
    else if (arg === "--promise") options.promiseIds.push(args[++index]);
    else if (arg === "--as-of") options.asOf = args[++index];
    else if (arg === "--output") options.output = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  invariant(options.collectorRun, "--collector-run is required");
  invariant(options.output, "--output is required");
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(options.asOf ?? ""), "--as-of must use YYYY-MM-DD");
  invariant(options.promiseIds.every((id) => /^[a-z0-9-]+$/.test(id)), "--promise accepts lowercase stable IDs only");
  return options;
}

const args = parseArgs(process.argv.slice(2));
const collectorRun = JSON.parse(await readFile(resolve(args.collectorRun), "utf8"));
invariant(collectorRun?.schemaVersion === "1.0.0" && Array.isArray(collectorRun.records), "Invalid collector run");
const registry = validatePromiseRegistry(JSON.parse(await readFile(resolve(args.promiseRegistry), "utf8")));
const promises = registry.promises.filter((promise) => args.promiseIds.length === 0 || args.promiseIds.includes(promise.id));
invariant(promises.length > 0, "No matching promises selected");
for (const requested of args.promiseIds) invariant(promises.some(({ id }) => id === requested), `Unknown promise id: ${requested}`);

const outputDirectory = resolve(args.output);
const packageDirectory = resolve(outputDirectory, "evidence-packages");
await mkdir(packageDirectory, { recursive: true });

const promiseResults = [];
for (const promise of promises) {
  const matches = matchCollectorRecords(collectorRun.records, promise, { asOf: args.asOf });
  const evidencePackage = buildEvidencePackage({ promise, matches, collectorRun, asOf: args.asOf });
  const packagePath = evidencePackage ? resolve(packageDirectory, `${promise.id}.json`) : null;
  if (packagePath) await writeFile(packagePath, `${JSON.stringify(evidencePackage, null, 2)}\n`, { flag: "wx" });
  promiseResults.push({
    promiseId: promise.id,
    candidateMatchCount: matches.length,
    attributablePrimaryMatchCount: matches.filter(({ record, attributionStatus }) => record.primary && ["verified-party-vote", "verified-party-sponsor", "candidate-government-action"].includes(attributionStatus)).length,
    evidencePackage: packagePath ? `evidence-packages/${basename(packagePath)}` : null,
    noPackageReason: packagePath ? null : "no-primary-candidate-match",
    matches: matches.map(summarizeMatch)
  });
  console.log(`${promise.id}: ${matches.length} candidates, ${packagePath ? "package generated" : "no package"}`);
}

const run = {
  schemaVersion: "1.0.0",
  matcherVersion: "deterministic-matcher-v1",
  matchedAt: new Date().toISOString(),
  asOf: args.asOf,
  publicationApproved: false,
  directionAssigned: false,
  collectorRunId: collectorRun.runId,
  collectorRunHash: sha256(collectorRun),
  promiseRegistryHash: sha256(registry),
  promiseResults
};
await writeFile(resolve(outputDirectory, "match-run.json"), `${JSON.stringify(run, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ outputDirectory, promiseCount: promises.length, packageCount: promiseResults.filter((result) => result.evidencePackage).length, publicationApproved: false }, null, 2));
