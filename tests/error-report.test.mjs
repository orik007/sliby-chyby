import assert from "node:assert/strict";
import test from "node:test";
import { handleErrorReport, parseErrorReport, reportIssue, reportMarker } from "../src/lib/error-report.ts";

const valid = { category: "status", text: "Stav neodpovídá hlasování ze 25. března 2026.", sourceUrl: "https://www.psp.cz/sqw/hlasy.sqw?g=87072", promisePath: "/sliby/ano/zastaveni-zvyseni-odvodu-zivnostniku", promiseTitle: "Zastavení zvyšování odvodů", turnstileToken: "token" };

test("a report needs a known category, a description of a sensible length, an http(s) link, and a Turnstile token", () => {
  assert.ok("report" in parseErrorReport(valid));
  assert.match(parseErrorReport({ ...valid, category: "spam" }).error, /Vyberte/);
  assert.match(parseErrorReport({ ...valid, text: "krátké" }).error, /aspoň 20/);
  assert.match(parseErrorReport({ ...valid, text: "x".repeat(2001) }).error, /nejvýš 2000/);
  assert.match(parseErrorReport({ ...valid, sourceUrl: "javascript:alert(1)" }).error, /https/);
  assert.match(parseErrorReport({ ...valid, sourceUrl: "nic" }).error, /https/);
  assert.match(parseErrorReport({ ...valid, turnstileToken: "" }).error, /robot/);
  assert.match(parseErrorReport({ ...valid, promisePath: "https://evil.example/" }).error, /přečíst/);
  assert.match(parseErrorReport({ ...valid, partySlug: "../x" }).error, /přečíst/);
  assert.match(parseErrorReport(null).error, /přečíst/);
  const { report } = parseErrorReport({ ...valid, sourceUrl: "", promisePath: "", promiseTitle: "ignored", category: "missing-promise", partySlug: "spd" });
  assert.deepEqual([report.sourceUrl, report.promisePath, report.promiseTitle, report.partySlug], [null, null, null, "spd"]);
});

test("the issue keeps the visitor's text inert and names the promise by its page on the site", () => {
  const text = "Viz ```kód``` a @someone #12 [odkaz](https://x.example)";
  const { report } = parseErrorReport({ ...valid, text, promiseTitle: "Slib @someone `x` #3" });
  const issue = reportIssue(report, "https://slibomer.cz");
  assert.equal(issue.title, "Hlášení: Slib someone x 3");
  assert.ok(issue.body.startsWith(reportMarker));
  assert.match(issue.body, /\*\*Slib:\*\* https:\/\/slibomer\.cz\/sliby\/ano\/zastaveni-zvyseni-odvodu-zivnostniku/);
  assert.match(issue.body, /Stav neodpovídá podkladům/);
  // The text sits in a code fence longer than any backtick run in it.
  assert.ok(issue.body.includes(`\`\`\`\`text\n${text}\n\`\`\`\``));
  assert.match(issue.body, /\*\*Odkaz od nahlašujícího:\*\* `https:\/\/www\.psp\.cz/);
});

const request = (body, headers = {}) => new Request("https://slibomer.cz/api/hlaseni", { method: "POST", headers: { Origin: "https://slibomer.cz", "CF-Connecting-IP": "203.0.113.7", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const env = (limited = false) => ({ TURNSTILE_SECRET_KEY: "secret", GITHUB_ISSUES_TOKEN: "token", REPORT_RATE_LIMITER: { limit: async () => ({ success: !limited }) } });
function fakeFetch(siteverify = { success: true, hostname: "slibomer.cz", action: "error-report" }, issueStatus = 201) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    if (url.includes("siteverify")) return Response.json(siteverify);
    return new Response("{}", { status: issueStatus });
  };
  return { calls, fetchImpl };
}

test("a verified report from the site becomes one issue in the repository", async () => {
  const { calls, fetchImpl } = fakeFetch();
  const response = await handleErrorReport(request(valid), env(), fetchImpl);
  assert.equal(response.status, 201);
  assert.equal(calls[0].body.response, "token");
  assert.equal(calls[0].body.remoteip, "203.0.113.7");
  assert.equal(calls[1].url, "https://api.github.com/repos/orik007/sliby-chyby/issues");
  assert.equal(calls[1].headers.Authorization, "Bearer token");
  assert.match(calls[1].body.title, /^Hlášení: Zastavení/);
  // No IP address or other personal data reaches the issue.
  assert.ok(!JSON.stringify(calls[1].body).includes("203.0.113.7"));
});

test("a report is refused without secrets, from another site, over the limit, with bad input, or failing Turnstile", async () => {
  const { calls, fetchImpl } = fakeFetch();
  assert.equal((await handleErrorReport(request(valid), {}, fetchImpl)).status, 503);
  assert.equal((await handleErrorReport(request(valid, { Origin: "https://evil.example" }), env(), fetchImpl)).status, 403);
  assert.equal((await handleErrorReport(request(valid), env(true), fetchImpl)).status, 429);
  assert.equal((await handleErrorReport(request({ ...valid, text: "" }), env(), fetchImpl)).status, 400);
  assert.equal(calls.length, 0, "nothing is sent before the input passes");
  for (const siteverify of [{ success: false }, { success: true, hostname: "evil.example", action: "error-report" }, { success: true, hostname: "slibomer.cz", action: "login" }]) {
    const fake = fakeFetch(siteverify);
    assert.equal((await handleErrorReport(request(valid), env(), fake.fetchImpl)).status, 403);
    assert.equal(fake.calls.length, 1, "no issue without a valid Turnstile answer");
  }
  const failing = fakeFetch(undefined, 500);
  const response = await handleErrorReport(request(valid), env(), failing.fetchImpl);
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /nepodařilo uložit/);
});
