import { spawn } from "node:child_process";
import { relative, resolve } from "node:path";

const inputPath = process.env.EVIDENCE_PACKAGE_INPUT ?? "automation/golden-cases/ano-eet-2/evidence-package.json";
const normalizedInput = inputPath.replaceAll("\\", "/");

if (
  normalizedInput.includes("..") ||
  !/^automation\/(golden-cases|evidence-packages)\/[A-Za-z0-9._/-]+\.json$/.test(normalizedInput)
) {
  throw new Error("The workflow evidence package must be a JSON file under automation/golden-cases or automation/evidence-packages");
}

const workspace = resolve(".");
const packagePath = resolve(normalizedInput);
if (relative(workspace, packagePath).startsWith("..")) throw new Error("The evidence package must stay inside the repository");

const child = spawn(
  process.execPath,
  ["scripts/run-assessment.mjs", packagePath, resolve("automation/runs/github-actions")],
  { stdio: "inherit", env: process.env }
);

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code, signal) => {
  if (signal) throw new Error(`Assessment runner terminated by signal ${signal}`);
  process.exitCode = code ?? 1;
});
