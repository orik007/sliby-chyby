import { semanticRetrievalRuntimeConfig } from "./lib/assessment-config.mjs";
import { reconcileEvidencePackageQueue } from "./lib/evidence-package-queue.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const options = { queue: "automation/evidence-packages" };
for (let index = 0; index < process.argv.length - 2; index += 1) {
  const arg = process.argv[index + 2];
  if (arg === "--queue") options.queue = process.argv[index + 3];
  else throw new Error(`Unknown argument: ${arg}`);
  index += 1;
}

const runtime = semanticRetrievalRuntimeConfig();
invariant(Number.isInteger(runtime.candidateLimit) && runtime.candidateLimit > 0, "SLIBY_SEMANTIC_CANDIDATE_LIMIT must be a positive integer");
invariant(Number.isFinite(runtime.minimumSimilarity) && runtime.minimumSimilarity >= -1 && runtime.minimumSimilarity <= 1, "SLIBY_SEMANTIC_MIN_SIMILARITY must be between -1 and 1");

const result = await reconcileEvidencePackageQueue({
  queueDirectory: options.queue,
  candidateLimit: runtime.candidateLimit,
  minimumSimilarity: runtime.minimumSimilarity
});
console.log(JSON.stringify({ ...result, publicationApproved: false }, null, 2));
