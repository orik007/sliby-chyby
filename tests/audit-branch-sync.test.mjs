import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/collect-evidence.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const localizeRemote = (script) => script
  .replaceAll('"https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"', "origin")
  .replace('authenticated_remote="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"', 'authenticated_remote="origin"')
  .replaceAll("$GITHUB_ENV", "github-env")
  .replaceAll("$GITHUB_OUTPUT", "github-output");
const restoreAuditState = localizeRemote(workflow.split("      - name: Restore current audit state\n")[1]
  .split("        run: |\n")[1].split("\n      - name:")[0]
  .split("\n").map((line) => line.replace(/^          /, "")).join("\n"));
const collectionPersistence = localizeRemote(workflow.split("      - name: Persist source collection and queued evidence packages\n")[1]
  .split("        run: |\n")[1].split("\n      - name:")[0]
  .split("\n").map((line) => line.replace(/^          /, "")).join("\n"));
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const auditBranch = "automation/assessment-review";
const checkpoint = "automation/collectors/checkpoints.json";
const packageManifest = "automation/evidence-packages/manifest.json";
const packageReadme = "automation/evidence-packages/README.md";
const tagCache = "automation/topic-routing/tag-cache/promise-tags.json";

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "audit-snapshot-"));
  const cwd = join(root, "work");
  mkdirSync(cwd);
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };
  const put = (path, content) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  };
  const commit = (message) => { git("add", "."); git("commit", "-m", message); };
  git("init", "--bare", join(root, "remote.git"));
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  git("config", "core.autocrlf", "false");
  git("remote", "add", "origin", join(root, "remote.git"));
  put(checkpoint, "main checkpoint\n");
  put(packageReadme, "current main documentation\n");
  put(tagCache, "main tag cache\n");
  put("src/example.txt", "base\n");
  commit("base");
  git("push", "origin", "main");
  return { root, cwd, git, put, commit };
}

function run(script, cwd, environment) {
  return spawnSync(bash, ["-e", "-c", script], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, REVIEW_BRANCH: auditBranch, GITHUB_REPOSITORY: "example/repository", GH_TOKEN: "test-token", ...environment }
  });
}

test("a missing audit branch leaves the current main checkout intact until collection and packages persist together", () => {
  const fixture = createFixture();
  try {
    const output = "github-env";
    const result = run(restoreAuditState, fixture.cwd, { GITHUB_ENV: output });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fixture.git("branch", "--show-current"), "main");
    assert.equal(fixture.git("show", `HEAD:${checkpoint}`), "main checkpoint");
    assert.match(readFileSync(join(fixture.cwd, output), "utf8"), /AUDIT_BRANCH_TIP=\n/);
    fixture.put(checkpoint, "first checkpoint\n");
    fixture.put(tagCache, "first tag cache\n");
    const persisted = run(collectionPersistence, fixture.cwd, { GITHUB_ENV: output, AUDIT_BRANCH_TIP: "" });
    assert.equal(persisted.status, 0, persisted.stderr || persisted.stdout);
    fixture.git("fetch", "origin", `refs/heads/${auditBranch}:refs/remotes/origin/${auditBranch}`);
    assert.equal(fixture.git("show", `origin/${auditBranch}:${checkpoint}`), "first checkpoint");
    assert.equal(fixture.git("show", `origin/${auditBranch}:${tagCache}`), "first tag cache");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("a run restores current audit data into main and replaces the audit snapshot safely", () => {
  const fixture = createFixture();
  try {
    fixture.git("switch", "-c", auditBranch);
    fixture.put(checkpoint, "audit checkpoint\n");
    fixture.put(packageManifest, "retained package\n");
    fixture.put(packageReadme, "outdated audit documentation\n");
    fixture.put(tagCache, "audit tag cache\n");
    fixture.commit("audit state");
    const auditTip = fixture.git("rev-parse", "HEAD");
    fixture.git("push", "origin", auditBranch);
    fixture.git("switch", "main");
    fixture.put("src/example.txt", "current main\n");
    fixture.put(packageReadme, "updated main documentation\n");
    fixture.commit("current main");
    const mainTip = fixture.git("rev-parse", "HEAD");

    const restoreOutput = "github-env";
    const restored = run(restoreAuditState, fixture.cwd, { GITHUB_ENV: restoreOutput });
    assert.equal(restored.status, 0, restored.stderr || restored.stdout);
    assert.equal(fixture.git("branch", "--show-current"), "main");
    assert.equal(fixture.git("show", `:${checkpoint}`), "audit checkpoint");
    assert.equal(fixture.git("show", `:${packageManifest}`), "retained package");
    assert.equal(fixture.git("show", `:${packageReadme}`), "updated main documentation");
    assert.equal(fixture.git("show", `:${tagCache}`), "audit tag cache");
    assert.match(readFileSync(join(fixture.cwd, restoreOutput), "utf8"), new RegExp(`AUDIT_BRANCH_TIP=${auditTip}`));

    fixture.put(checkpoint, "new checkpoint\n");
    fixture.put(tagCache, "updated tag cache\n");
    const persistOutput = "github-env";
    const persisted = run(collectionPersistence, fixture.cwd, { GITHUB_ENV: persistOutput, AUDIT_BRANCH_TIP: auditTip });
    assert.equal(persisted.status, 0, persisted.stderr || persisted.stdout);
    fixture.git("fetch", "origin", `refs/heads/${auditBranch}:refs/remotes/origin/${auditBranch}`);
    assert.equal(fixture.git("show", `origin/${auditBranch}:${checkpoint}`), "new checkpoint");
    assert.equal(fixture.git("show", `origin/${auditBranch}:${packageManifest}`), "retained package");
    assert.equal(fixture.git("show", `origin/${auditBranch}:${tagCache}`), "updated tag cache");
    fixture.git("merge-base", "--is-ancestor", mainTip, `origin/${auditBranch}`);
    assert.match(readFileSync(join(fixture.cwd, persistOutput), "utf8"), new RegExp(`AUDIT_BRANCH_TIP=${fixture.git("rev-parse", "HEAD")}`));
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("audit snapshot pushes use a lease instead of merging histories", () => {
  assert.match(workflow, /git push --force-with-lease="refs\/heads\/\$REVIEW_BRANCH:\$AUDIT_BRANCH_TIP"/);
  assert.doesNotMatch(workflow, /git merge --no-ff --no-commit/);
  assert.doesNotMatch(workflow, /git switch --force-create "\$REVIEW_BRANCH"/);
  assert.match(workflow, /case "\$path" in[\s\S]*?\*\/README\.md\) ;;/);
});
