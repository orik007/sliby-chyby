import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/collect-evidence.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const preparation = workflow.split("      - name: Prepare durable review branch\n")[1]
  .split("        run: |\n")[1].split("\n      - name:")[0]
  .split("\n").map((line) => line.replace(/^          /, "")).join("\n");
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const readme = "automation/review-proposals/README.md";
const checkpoint = "automation/collectors/checkpoints.json";
const index = "automation/semantic-index/promise-index.json";

for (const scenario of ["bootstrap", "existing audit", "audit deletion", "non-audit conflict", "audit file to directory", "audit directory to file"]) {
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
      }
      commit();
      git("switch", "-c", "automation/assessment-review");
      put(readme, "durable\n");
      put("automation/review-proposals/history/proposal.json", "retained\n");
      if (scenario === "audit file to directory") put(collision, "durable\n");
      if (scenario === "audit directory to file") put(`${collision}/child.json`, "durable\n");
      if (scenario === "audit deletion") git("rm", checkpoint, index);
      if (scenario === "existing audit") {
        put(checkpoint, "durable checkpoint\n");
        put(index, "durable index\n");
      }
      if (scenario === "non-audit conflict") put("src/example.txt", "durable\n");
      commit();
      const auditHead = git("rev-parse", "HEAD");
      git("push", "origin", "automation/assessment-review");
      git("switch", "main");
      git("branch", "-D", "automation/assessment-review");
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
      }
      commit();
      const mainHead = git("rev-parse", "HEAD");
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
        assert.equal(git("show", `HEAD:${readme}`), "durable");
        assert.equal(git("show", "HEAD:automation/review-proposals/history/proposal.json"), "retained");
        assert.equal(git("show", "HEAD:automation/semantic-index/README.md"), "new index documentation");
        assert.equal(git("show", "HEAD:src/example.txt"), "main");
        git("merge-base", "--is-ancestor", mainHead, "HEAD");
        git("merge-base", "--is-ancestor", auditHead, "HEAD");
        if (scenario === "existing audit") {
          assert.equal(git("show", `HEAD:${checkpoint}`), "durable checkpoint");
          assert.equal(git("show", `HEAD:${index}`), "durable index");
        } else {
          assert.equal(existsSync(join(cwd, checkpoint)), false);
          assert.equal(existsSync(join(cwd, index)), false);
        }
      }
      assert.equal(git("status", "--porcelain"), "");
      assert.equal(existsSync(join(cwd, ".git/MERGE_HEAD")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
