import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function outputText(response) {
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("") ?? "";
}

function parseProposal(text) {
  const value = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "").trim());
  if (!["patch", "explain"].includes(value.action) || typeof value.comment !== "string" || typeof value.patch !== "string") {
    throw new Error("Resolver response does not satisfy the required proposal shape.");
  }
  return value;
}

function changedPaths(patch) {
  return [...patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((match) => match[1]);
}

function isForbiddenPath(path) {
  return path.startsWith(".github/")
    || path.startsWith(".codex")
    || path.startsWith(".env")
    || ["AGENTS.md", "docs/decisions.md", "docs/release-process.md"].includes(path);
}

async function gh(args) {
  return execFileAsync("gh", args, { encoding: "utf8" });
}

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const payload = event.client_payload;
const repository = process.env.GITHUB_REPOSITORY;
const pullNumber = String(payload.pull_number);
const currentHead = (await gh(["api", `repos/${repository}/pulls/${pullNumber}`, "--jq", ".head.sha"])) .stdout.trim();
if (currentHead !== payload.head_sha) throw new Error("Resolver payload does not target the current pull-request head.");

const files = JSON.parse((await gh(["api", `repos/${repository}/pulls/${pullNumber}/files?per_page=100`])).stdout);
const allowedPaths = new Set(files.map((file) => file.filename));
const diff = files.map((file) => `FILE: ${file.filename}\n${file.patch ?? "[diff omitted by GitHub]"}`).join("\n\n");
const releaseRules = await readFile("docs/release-process.md", "utf8");
const prompt = `You are the isolated feedback resolver for pull request #${pullNumber}.\n\nFeedback:\n${payload.feedback}\n\nYou may change only files already in this pull request. Do not change workflows, credentials, or release policy. If the feedback is outside that scope or not valid, return action explain. If a direct correction is warranted, return a minimal unified git patch. Never invent facts.\n\nRelevant release rules:\n${releaseRules}\n\nPull-request diff:\n${diff}\n\nReturn JSON only: {"action":"patch"|"explain","comment":"concise English disposition","patch":"unified diff or empty string"}.`;
const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: process.env.SLIBY_RESOLVER_MODEL ?? "gpt-5.6-terra", input: prompt, max_output_tokens: 4000 })
});
if (!response.ok) throw new Error(`Resolver model request failed: ${response.status} ${await response.text()}`);
const proposal = parseProposal(outputText(await response.json()));

if (proposal.action === "patch") {
  const paths = changedPaths(proposal.patch);
  if (!proposal.patch || paths.length === 0 || paths.some((path) => !allowedPaths.has(path) || isForbiddenPath(path))) {
    throw new Error("Resolver patch is empty or exceeds the existing pull-request file scope.");
  }
  await writeFile("/tmp/sliby-release-resolver.patch", proposal.patch);
  await execFileAsync("git", ["apply", "--check", "/tmp/sliby-release-resolver.patch"]);
  await execFileAsync("git", ["apply", "/tmp/sliby-release-resolver.patch"]);
  await execFileAsync("npm", ["test"], { env: process.env });
  await execFileAsync("npm", ["run", "build"], { env: process.env });
  await execFileAsync("git", ["config", "user.name", "slibychyby-feedback-resolver[bot]"]);
  await execFileAsync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  await execFileAsync("git", ["add", "--update"]);
  await execFileAsync("git", ["commit", "-m", "Address release feedback"]);
  await execFileAsync("git", ["push", "origin", `HEAD:refs/heads/${payload.head_ref}`]);
}

const marker = `<!-- sliby-release-resolver: complete head ${payload.head_sha} -->`;
await gh(["pr", "comment", pullNumber, "--repo", repository, "--body", `${marker}\n\nResolver disposition: ${proposal.comment}`]);
