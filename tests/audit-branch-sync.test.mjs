import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/collect-evidence.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const localizeAuthenticatedRemote = (script) => script
  .replace('authenticated_remote="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"', 'authenticated_remote="origin"');
const preparation = localizeAuthenticatedRemote(workflow.split("      - name: Prepare durable review branch\n")[1]
  .split("        run: |\n")[1].split("\n      - name:")[0]
  .split("\n").map((line) => line.replace(/^          /, "")).join("\n"));
const checkpointPersistence = localizeAuthenticatedRemote(workflow.split("      - name: Persist successful source checkpoints\n")[1]
  .split("        run: |\n")[1].split("\n      - name:")[0]
  .split("\n").map((line) => line.replace(/^          /, "")).join("\n")
  .replace('git push "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "HEAD:refs/heads/$REVIEW_BRANCH"', 'git push origin "HEAD:refs/heads/$REVIEW_BRANCH"'));
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const readme = "automation/review-proposals/README.md";
const checkpoint = "automation/collectors/checkpoints.json";
const index = "automation/semantic-index/promise-index.json";
const evidenceQueue = "automation/evidence-packages/manifest.json";

for (const scenario of ["bootstrap", "existing audit", "rewritten remote audit", "stale local audit", "audit deletion", "non-audit conflict", "audit file to directory", "audit directory to file"]) {
  test(`durable branch synchronization: ${scenario}`, () => {
    const root = mkdtempSync(join(tmpdir(), "audit-sync-"));
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
    const commit = () => { git("add", "."); git("commit", "-m", "fixture"); };
    try {
      git("init", "--bare", join(root, "remote.git"));
      git("init", "-b", "main");
      git("config", "user.name", "Test");
      git("config", "user.email", "test@example.invalid");
      git("config", "core.autocrlf", "false");
      git("remote", "add", "origin", join(root, "remote.git"));
      put(readme, "base\n");
      put("src/example.txt", "base\n");
      const collision = "automation/review-proposals/collision";
      if (scenario === "audit file to directory") put(collision, "base\n");
      if (scenario === "audit directory to file") put(`${collision}/child.json`, "base\n");
      if (scenario !== "bootstrap") {
        put(checkpoint, "base\n");
        put(index, "base\n");
        put(evidenceQueue, "base\n");
      }
      commit();
      git("switch", "-c", "automation/assessment-review");
      put(readme, "durable\n");
      put("automation/review-proposals/history/proposal.json", "retained\n");
      if (scenario === "audit file to directory") put(collision, "durable\n");
      if (scenario === "audit directory to file") put(`${collision}/child.json`, "durable\n");
      if (scenario === "audit deletion") git("rm", checkpoint, index, evidenceQueue);
      if (scenario === "existing audit") {
        put(checkpoint, "durable checkpoint\n");
        put(index, "durable index\n");
        put(evidenceQueue, "durable queue\n");
      }
      if (scenario === "non-audit conflict") put("src/example.txt", "durable\n");
      commit();
      const auditHead = git("rev-parse", "HEAD");
      git("push", "origin", "automation/assessment-review");
      git("fetch", "origin", "refs/heads/automation/assessment-review:refs/remotes/origin/automation/assessment-review");
      git("switch", "main");
      if (scenario !== "stale local audit") git("branch", "-D", "automation/assessment-review");
      put(readme, "main\n");
      put("automation/semantic-index/README.md", "new index documentation\n");
      put("src/example.txt", "main\n");
      if (scenario === "audit file to directory") {
        git("rm", collision);
        put(`${collision}/child.json`, "main\n");
      }
      if (scenario === "audit directory to file") {
        git("rm", "-r", collision);
        put(collision, "main\n");
      }
      if (scenario !== "bootstrap") {
        put(checkpoint, "main checkpoint\n");
        put(index, "main index\n");
        put(evidenceQueue, "main queue\n");
      }
      commit();
      const mainHead = git("rev-parse", "HEAD");
      const remoteAuditWasRewritten = ["rewritten remote audit", "stale local audit"].includes(scenario);
      if (remoteAuditWasRewritten) {
        git("switch", "-c", "rewritten-audit", mainHead);
        put(readme, "rewritten durable\n");
        put("automation/review-proposals/history/proposal.json", "rewritten retained\n");
        commit();
        git("push", "--force", "origin", "HEAD:refs/heads/automation/assessment-review");
        git("switch", "main");
        git("branch", "-D", "rewritten-audit");
      }
      const result = spawnSync(bash, ["-e", "-c", preparation], {
        cwd, encoding: "utf8", env: { ...process.env, REVIEW_BRANCH: "automation/assessment-review", GITHUB_SHA: mainHead },
      });
      if (["non-audit conflict", "audit file to directory", "audit directory to file"].includes(scenario)) {
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stdout, /non-audit conflict|audit path relocation/);
        assert.equal(git("rev-parse", "HEAD"), auditHead);
        assert.equal(git("show", "HEAD:automation/review-proposals/history/proposal.json"), "retained");
        if (scenario === "audit file to directory") assert.equal(git("show", `HEAD:${collision}`), "durable");
        if (scenario === "audit directory to file") assert.equal(git("show", `HEAD:${collision}/child.json`), "durable");
      } else {
        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.equal(git("show", `HEAD:${readme}`), remoteAuditWasRewritten ? "rewritten durable" : "durable");
        assert.equal(git("show", "HEAD:automation/review-proposals/history/proposal.json"), remoteAuditWasRewritten ? "rewritten retained" : "retained");
        assert.equal(git("show", "HEAD:automation/semantic-index/README.md"), "new index documentation");
        assert.equal(git("show", "HEAD:src/example.txt"), "main");
        git("merge-base", "--is-ancestor", mainHead, "HEAD");
        if (!remoteAuditWasRewritten) git("merge-base", "--is-ancestor", auditHead, "HEAD");
        if (scenario === "existing audit") {
          assert.equal(git("show", `HEAD:${checkpoint}`), "durable checkpoint");
          assert.equal(git("show", `HEAD:${index}`), "durable index");
          assert.equal(git("show", `HEAD:${evidenceQueue}`), "durable queue");
        } else if (remoteAuditWasRewritten) {
          assert.equal(git("show", `HEAD:${checkpoint}`), "main checkpoint");
          assert.equal(git("show", `HEAD:${index}`), "main index");
          assert.equal(git("show", `HEAD:${evidenceQueue}`), "main queue");
        } else {
          assert.equal(existsSync(join(cwd, checkpoint)), false);
          assert.equal(existsSync(join(cwd, index)), false);
          assert.equal(existsSync(join(cwd, evidenceQueue)), false);
        }
      }
      assert.equal(git("status", "--porcelain"), "");
      assert.equal(existsSync(join(cwd, ".git/MERGE_HEAD")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("checkpoint persistence merges a divergent durable branch without losing stored audit data", () => {
  const root = mkdtempSync(join(tmpdir(), "checkpoint-push-"));
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
  try {
    git("init", "--bare", join(root, "remote.git"));
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    git("config", "core.autocrlf", "false");
    git("remote", "add", "origin", join(root, "remote.git"));
    put(checkpoint, "base\n");
    commit("base");
    git("push", "origin", "main");
    git("switch", "-c", "automation/assessment-review");
    put(checkpoint, "remote checkpoint\n");
    put("automation/review-proposals/history/proposal.json", "retained\n");
    commit("remote audit");
    const remoteAuditHead = git("rev-parse", "HEAD");
    git("push", "origin", "automation/assessment-review");
    git("switch", "main");
    put("src/main.txt", "main\n");
    commit("main change");
    git("switch", "-C", "automation/assessment-review");
    put(checkpoint, "collected checkpoint\n");
    const output = join(root, "github-output");
    const result = spawnSync(bash, ["-e", "-c", checkpointPersistence], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, REVIEW_BRANCH: "automation/assessment-review", GITHUB_OUTPUT: output }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    git("fetch", "origin", "refs/heads/automation/assessment-review:refs/remotes/origin/automation/assessment-review");
    assert.equal(git("show", `origin/automation/assessment-review:${checkpoint}`), "collected checkpoint");
    assert.equal(git("show", "origin/automation/assessment-review:automation/review-proposals/history/proposal.json"), "retained");
    git("merge-base", "--is-ancestor", remoteAuditHead, "origin/automation/assessment-review");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkpoint persistence aborts on a mixed audit conflict without pushing", () => {
  const root = mkdtempSync(join(tmpdir(), "checkpoint-push-conflict-"));
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
  try {
    git("init", "--bare", join(root, "remote.git"));
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    git("config", "core.autocrlf", "false");
    git("remote", "add", "origin", join(root, "remote.git"));
    put(checkpoint, "base\n");
    put("automation/review-proposals/history/proposal.json", "base\n");
    commit("base");
    git("push", "origin", "main");
    git("switch", "-c", "automation/assessment-review");
    put(checkpoint, "remote checkpoint\n");
    put("automation/review-proposals/history/proposal.json", "remote proposal\n");
    commit("remote audit");
    const remoteAuditHead = git("rev-parse", "HEAD");
    git("push", "origin", "automation/assessment-review");
    git("switch", "main");
    put("src/main.txt", "main\n");
    commit("main change");
    git("switch", "-C", "automation/assessment-review");
    put("automation/review-proposals/history/proposal.json", "local proposal\n");
    commit("local audit conflict");
    put(checkpoint, "collected checkpoint\n");
    const output = join(root, "github-output");
    const result = spawnSync(bash, ["-e", "-c", checkpointPersistence], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, REVIEW_BRANCH: "automation/assessment-review", GITHUB_OUTPUT: output }
    });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stdout, /checkpoint commit diverged from the audit branch outside the checkpoint file/);
    git("fetch", "origin", "refs/heads/automation/assessment-review:refs/remotes/origin/automation/assessment-review");
    assert.equal(git("rev-parse", "origin/automation/assessment-review"), remoteAuditHead);
    assert.equal(git("show", `origin/automation/assessment-review:${checkpoint}`), "remote checkpoint");
    assert.equal(git("show", "origin/automation/assessment-review:automation/review-proposals/history/proposal.json"), "remote proposal");
    assert.equal(git("show", `HEAD:${checkpoint}`), "collected checkpoint");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
