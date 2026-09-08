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

function isForbiddenPath(path) {
  return path.startsWith(".github/")
    || path.startsWith(".codex")
    || path.startsWith(".env")
    || ["AGENTS.md", "docs/decisions.md", "docs/release-process.md"].includes(path);
}

async function gh(args) {
  return execFileAsync("gh", args, { encoding: "utf8" });
}

async function ghPages(path) {
  const output = (await gh(["api", "--paginate", "--slurp", path])).stdout.trim();
  return output ? JSON.parse(output).flat() : [];
}

function safeTestEnvironment() {
  const allowed = ["PATH", "HOME", "TMPDIR", "RUNNER_TEMP", "CI", "NODE_OPTIONS", "npm_config_cache"];
  return Object.fromEntries(allowed.flatMap((key) => {
    return process.env[key] === undefined ? [] : [[key, process.env[key]]];
  }));
}

function actualChangedPaths(output) {
  return output.trim().split("\n").filter(Boolean).flatMap((line) => {
    const [status, ...paths] = line.split("\t");
    if (/^[RC]/.test(status)) return paths.slice(-2);
    return paths.slice(0, 1);
  });
}

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const payload = event.client_payload;
const repository = process.env.GITHUB_REPOSITORY;
const pullNumber = String(payload.pull_number);
const pullRequest = JSON.parse((await gh(["api", `repos/${repository}/pulls/${pullNumber}`])).stdout);
if (pullRequest.head.sha !== payload.head_sha || pullRequest.head.repo?.full_name !== repository || !pullRequest.head.ref) {
  throw new Error("Resolver payload does not target the current same-repository pull-request head.");
}
const headRef = pullRequest.head.ref;

const files = await ghPages(`repos/${repository}/pulls/${pullNumber}/files?per_page=100`);
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
  if (!proposal.patch) {
    throw new Error("Resolver patch is empty or exceeds the existing pull-request file scope.");
  }
  await writeFile("/tmp/sliby-release-resolver.patch", proposal.patch);
  await execFileAsync("git", ["apply", "--check", "/tmp/sliby-release-resolver.patch"]);
  await execFileAsync("git", ["apply", "/tmp/sliby-release-resolver.patch"]);
  await execFileAsync("git", ["diff", "--check"]);
  const paths = actualChangedPaths((await execFileAsync("git", ["diff", "--name-status", "HEAD"])).stdout);
  if (paths.length === 0 || paths.some((path) => !allowedPaths.has(path) || isForbiddenPath(path))) {
    throw new Error("Resolver patch changes a forbidden path, creates a file, or deletes or renames a file outside the pull-request scope.");
  }
  const safeEnv = safeTestEnvironment();
  await execFileAsync("npm", ["test"], { env: safeEnv });
  await execFileAsync("npm", ["run", "build"], { env: safeEnv });
  await execFileAsync("git", ["config", "user.name", "slibychyby-feedback-resolver[bot]"]);
  await execFileAsync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  await execFileAsync("git", ["add", "--update"]);
  await execFileAsync("git", ["commit", "-m", "Address release feedback"]);
  await execFileAsync("git", ["push", "origin", `HEAD:refs/heads/${headRef}`]);
  const verifiedHead = (await gh(["api", `repos/${repository}/pulls/${pullNumber}`, "--jq", ".head.sha"])).stdout.trim();
  await gh(["api", "--method", "POST", `repos/${repository}/dispatches`, "-f", "event_type=sliby-verify-pr-head", "-f", `client_payload[pull_number]=${pullNumber}`, "-f", `client_payload[head_sha]=${verifiedHead}`]);
}

const completedHead = (await gh(["api", `repos/${repository}/pulls/${pullNumber}`, "--jq", ".head.sha"])).stdout.trim();
const marker = `<!-- sliby-release-resolver: complete head ${completedHead} -->`;
await gh(["pr", "comment", pullNumber, "--repo", repository, "--body", `${marker}\n\nResolver disposition: ${proposal.comment}`]);
