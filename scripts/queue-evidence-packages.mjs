import { queueEvidencePackages } from "./lib/evidence-package-queue.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const options = { input: null, queue: "automation/evidence-packages" };
for (let index = 0; index < process.argv.length - 2; index += 1) {
  const arg = process.argv[index + 2];
  if (arg === "--input") options.input = process.argv[index + 3];
  else if (arg === "--queue") options.queue = process.argv[index + 3];
  else throw new Error(`Unknown argument: ${arg}`);
  index += 1;
}
invariant(options.input, "--input is required");

const result = await queueEvidencePackages({ inputDirectory: options.input, queueDirectory: options.queue });
console.log(JSON.stringify({ ...result, publicationApproved: false }, null, 2));
