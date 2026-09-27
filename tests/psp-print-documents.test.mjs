import { createServer } from "node:http";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Agent } from "undici";
import { strToU8, zipSync } from "fflate";
import { allSettledOrThrow, createPspFetcher, createPspRequestLog, extractDocParagraphs, extractDocxParagraphs, officialPrintDocumentPageUrl, pspDownloadSettings, summarizePspRequests } from "../scripts/lib/psp-print-documents.mjs";
import { proposalBody } from "../scripts/lib/print-parts.mjs";

test("builds the official print page URL", () => {
  assert.equal(officialPrintDocumentPageUrl(10, 90, 0), "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=90&CT1=0");
});

test("extracts readable numbered paragraphs from a bounded DOCX archive", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="urn:test"><w:body>
      <w:p><w:r><w:t>Návrh zákona</w:t></w:r></w:p>
      <w:p><w:r><w:t>Rozhlasové &amp; televizní poplatky se zrušují.</w:t></w:r></w:p>
    </w:body></w:document>`;
  const bytes = zipSync({ "word/document.xml": strToU8(documentXml) });
  assert.deepEqual(extractDocxParagraphs(bytes), [
    "Návrh zákona",
    "Rozhlasové & televizní poplatky se zrušují."
  ]);
});

const pspSource = { id: "psp-core-2025", expectedHosts: ["www.psp.cz"] };
const htmlOptions = { maxBytes: 1_000, expectedContentTypes: ["text/html"] };
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// A stand-in for psp.cz: each listed URL refuses the connection that many
// times, and every answer takes a few milliseconds.
function stubPsp(refusals = {}) {
  const log = { starts: [], ends: [], open: 0, maxOpen: 0, dispatchers: [] };
  const remaining = { ...refusals };
  const fetch = async (url, init = {}) => {
    log.starts.push({ url, at: Date.now() });
    log.dispatchers.push(init.dispatcher);
    log.open += 1;
    log.maxOpen = Math.max(log.maxOpen, log.open);
    try {
      await pause(5);
      if (remaining[url] > 0) {
        remaining[url] -= 1;
        throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
      }
      return { ok: true, status: 200, url, headers: new Headers({ "content-type": "text/html" }), body: null, arrayBuffer: async () => new TextEncoder().encode("<html></html>").buffer };
    } finally {
      log.open -= 1;
      log.ends.push({ url, at: Date.now() });
    }
  };
  return { log, fetch };
}

async function withStubPsp(stub, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stub.fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("reads the paragraphs of a Word 97-2003 proposal text with its quotation marks as written", async () => {
  // Print 72's proposal text, which psp.cz lists only as .doc and PDF
  // (downloaded on 26 September 2026).
  const paragraphs = await extractDocParagraphs(await readFile(new URL("./fixtures/print-parts/print-72-proposal.doc", import.meta.url)));
  assert.deepEqual(paragraphs.slice(0, 3), ["Návrh", "ZÁKON", "ze dne … 2026,"]);
  assert.ok(paragraphs.includes("V § 32 se slova „výbor pro mediální záležitosti“ nahrazují slovy „výbor pro kulturu a mediální záležitosti“."));
  assert.ok(paragraphs.every((paragraph) => paragraph === paragraph.trim() && !/\s{2}|[\t\u00a0]/.test(paragraph)));
  const body = proposalBody(paragraphs);
  assert.ok(body.length < paragraphs.length);
  assert.deepEqual(body.slice(-3), ["Čl. II", "Účinnost", "Tento zákon nabývá účinnosti patnáctým dnem následujícím po dni jeho vyhlášení."]);
  await assert.rejects(() => extractDocParagraphs(new TextEncoder().encode("not a Word file")));
});

test("print-text downloads use two requests at a time, six attempts with a 5 s back-off, 1.5 s between attempts, and a 3 s connect limit", () => {
  assert.deepEqual(pspDownloadSettings, { concurrency: 2, retryAttempts: 6, retryDelayMs: 5_000, minIntervalMs: 1_500, connectTimeoutMs: 3_000 });
});

test("the psp.cz fetcher connects through a pool with its connect limit, validates its settings, and closes the pool", async () => {
  const stub = stubPsp();
  const fetchPsp = createPspFetcher({ concurrency: 1, retryAttempts: 1, retryDelayMs: 0, connectTimeoutMs: 3_000 });
  await withStubPsp(stub, () => fetchPsp(pspSource, "https://www.psp.cz/sqw/historie.sqw?o=10&t=1", htmlOptions));
  assert.ok(stub.log.dispatchers[0] instanceof Agent);
  await fetchPsp.close();
  assert.equal(stub.log.dispatchers[0].closed, true);
  const plain = stubPsp();
  await withStubPsp(plain, () => createPspFetcher({ concurrency: 1, retryAttempts: 1, retryDelayMs: 0 })(pspSource, "https://www.psp.cz/sqw/historie.sqw?o=10&t=1", htmlOptions));
  assert.equal(plain.log.dispatchers[0], undefined, "without a connect limit Node's default pool is used");
  assert.throws(() => createPspFetcher({ concurrency: 1, retryAttempts: 1, retryDelayMs: 0, connectTimeoutMs: 0 }), /connectTimeoutMs must be a positive integer or null/);
  assert.throws(() => createPspFetcher({ concurrency: 1, retryAttempts: 1, retryDelayMs: 0, minIntervalMs: -1 }), /minIntervalMs must be a non-negative integer/);
});

test("the psp.cz fetcher starts no two attempts, retries included, closer than its interval", async () => {
  const failing = "https://www.psp.cz/sqw/historie.sqw?o=10&t=1";
  const stub = stubPsp({ [failing]: 1 });
  const fetchPsp = createPspFetcher({ concurrency: 2, retryAttempts: 2, retryDelayMs: 0, minIntervalMs: 40 });
  const urls = [failing, ...Array.from({ length: 3 }, (_, index) => `https://www.psp.cz/sqw/historie.sqw?o=10&t=${index + 2}`)];
  await withStubPsp(stub, () => Promise.all(urls.map((url) => fetchPsp(pspSource, url, htmlOptions))));
  const starts = stub.log.starts.map(({ at }) => at);
  assert.equal(starts.length, 5);
  for (let index = 1; index < starts.length; index += 1) assert.ok(starts[index] - starts[index - 1] >= 38, `attempts ${index} and ${index + 1} started ${starts[index] - starts[index - 1]} ms apart`);
});

test("the psp.cz fetcher never keeps more requests open than its limit", async () => {
  const stub = stubPsp();
  const fetchPsp = createPspFetcher({ concurrency: 2, retryAttempts: 1, retryDelayMs: 0 });
  const urls = Array.from({ length: 8 }, (_, index) => `https://www.psp.cz/sqw/historie.sqw?o=10&t=${index + 1}`);
  await withStubPsp(stub, () => Promise.all(urls.map((url) => fetchPsp(pspSource, url, htmlOptions))));
  assert.equal(stub.log.starts.length, 8);
  assert.equal(stub.log.maxOpen, 2);
});

test("the psp.cz fetcher retries a refused connection with its own settings and keeps its slot while it waits", async () => {
  const failing = "https://www.psp.cz/sqw/historie.sqw?o=10&t=1";
  const other = "https://www.psp.cz/sqw/historie.sqw?o=10&t=2";
  const stub = stubPsp({ [failing]: 2 });
  const fetchPsp = createPspFetcher({ concurrency: 1, retryAttempts: 3, retryDelayMs: 20 });
  await withStubPsp(stub, () => Promise.all([fetchPsp(pspSource, failing, htmlOptions), fetchPsp(pspSource, other, htmlOptions)]));
  assert.deepEqual(stub.log.starts.map(({ url }) => url), [failing, failing, failing, other]);
  // The other request starts only after the failing one finally succeeded:
  // the back-off held the only slot.
  const lastFailingEnd = stub.log.ends.filter(({ url }) => url === failing).at(-1).at;
  assert.ok(stub.log.starts.at(-1).at >= lastFailingEnd);
});

test("the psp.cz fetcher gives up after its attempts and frees its slot", async () => {
  const failing = "https://www.psp.cz/sqw/historie.sqw?o=10&t=1";
  const other = "https://www.psp.cz/sqw/historie.sqw?o=10&t=2";
  const stub = stubPsp({ [failing]: 5 });
  const fetchPsp = createPspFetcher({ concurrency: 1, retryAttempts: 2, retryDelayMs: 0 });
  await withStubPsp(stub, async () => {
    await assert.rejects(fetchPsp(pspSource, failing, htmlOptions), /fetch failed/);
    await fetchPsp(pspSource, other, htmlOptions);
  });
  assert.deepEqual(stub.log.starts.map(({ url }) => url), [failing, failing, other]);
});

test("the psp.cz fetcher reports every attempt with its failure code or its answer", async () => {
  const failing = "https://www.psp.cz/sqw/historie.sqw?o=10&t=1";
  const attempts = [];
  const fetchPsp = createPspFetcher({ concurrency: 1, retryAttempts: 2, retryDelayMs: 0, onAttempt: (attempt) => attempts.push(attempt) });
  await withStubPsp(stubPsp({ [failing]: 1 }), () => fetchPsp(pspSource, failing, htmlOptions));
  assert.deepEqual(attempts.map(({ url, attempt, status, bytes, error }) => ({ url, attempt, status, bytes, error })), [
    { url: failing, attempt: 1, status: null, bytes: null, error: "UND_ERR_CONNECT_TIMEOUT" },
    { url: failing, attempt: 2, status: 200, bytes: 13, error: null }
  ]);
  assert.ok(attempts.every(({ startedAt, durationMs }) => !Number.isNaN(Date.parse(startedAt)) && durationMs >= 0));
});

test("the psp.cz request log records each new connection to its host, and a refused one with its code", async () => {
  const server = createServer((request, response) => response.end("ok"));
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  const closed = createServer();
  await new Promise((resolveListen) => closed.listen(0, "127.0.0.1", resolveListen));
  const closedPort = closed.address().port;
  await new Promise((resolveClose) => closed.close(resolveClose));
  const saved = [];
  const requests = createPspRequestLog({ hostname: "127.0.0.1", onEntry: (entry) => saved.push(entry) });
  try {
    await (await fetch(`http://127.0.0.1:${port}/`)).text();
    await assert.rejects(fetch(`http://127.0.0.1:${closedPort}/`));
  } finally {
    requests.stop();
    server.closeAllConnections();
    server.close();
  }
  assert.deepEqual(requests.entries.map(({ type, error }) => ({ type, error })), [
    { type: "connect", error: null },
    { type: "connect", error: "ECONNREFUSED" }
  ]);
  assert.deepEqual(saved, requests.entries, "each entry is handed on as soon as it is recorded");
  const before = requests.entries.length;
  await assert.rejects(fetch(`http://127.0.0.1:${closedPort}/`));
  assert.equal(requests.entries.length, before, "a stopped log records nothing");
});

test("a psp.cz request summary counts failures by cause and the busiest 60 s", () => {
  const at = (seconds) => new Date(Date.UTC(2026, 8, 27, 10, 0, 0) + seconds * 1000).toISOString();
  const attempt = (seconds, url, error = null, status = 200) => ({ type: "attempt", url, attempt: 1, startedAt: at(seconds), durationMs: 1, status: error ? null : status, bytes: null, error });
  const entries = [
    attempt(0, "a"), attempt(10, "b", "UND_ERR_CONNECT_TIMEOUT"), attempt(30, "b"), attempt(50, "c", null, 503),
    attempt(70, "d"), attempt(200, "e"),
    { type: "connect", startedAt: at(9), durationMs: 10_000, error: "UND_ERR_CONNECT_TIMEOUT" },
    { type: "connect", startedAt: at(29), durationMs: 40, error: null }
  ];
  assert.deepEqual(summarizePspRequests(entries), {
    minutes: 3.3,
    attempts: 6,
    urls: 5,
    failedAttempts: 2,
    failedAttemptsBy: { UND_ERR_CONNECT_TIMEOUT: 1, "HTTP 503": 1 },
    attemptsPerMinute: 1.8,
    busiestMinuteAttempts: 4,
    connections: 2,
    failedConnections: 1,
    failedConnectionsBy: { UND_ERR_CONNECT_TIMEOUT: 1 },
    connectionsPerMinute: 0.6,
    busiestMinuteConnections: 2
  });
});

test("a failed download is reported only after every other request has finished", async () => {
  const finished = [];
  const slow = pause(30).then(() => finished.push("slow"));
  const failing = pause(5).then(() => {
    finished.push("failing");
    throw new Error("download failed");
  });
  await assert.rejects(allSettledOrThrow([failing, slow]), /download failed/);
  assert.deepEqual(finished, ["failing", "slow"]);
  assert.deepEqual(await allSettledOrThrow([Promise.resolve(1), null]), [1, null]);
});

test("run-print-parts.mjs sends every psp.cz request through the shared fetcher and logs it", async () => {
  const script = await readFile(new URL("../scripts/run-print-parts.mjs", import.meta.url), "utf8");
  assert.match(script, /const fetchPsp = createPspFetcher\(\{ \.\.\.pspDownloadSettings, onAttempt: pspRequests\.onAttempt \}\);/);
  // Each entry is appended as it happens, so the file survives a step timeout.
  assert.match(script, /createPspRequestLog\(\{ onEntry: \(entry\) => appendFileSync\(pspRequestFile, /);
  assert.match(script, /finally \{\s*await fetchPsp\.close\(\);\s*pspRequests\.stop\(\);/);
  assert.doesNotMatch(script, /fetchVerified|globalThis\.fetch|\bfetch\(/);
  assert.match(script, /await allSettledOrThrow\(Array\.from\(\{ length: Math\.min\(pspDownloadSettings\.concurrency, prints\.length\) \}, downloadWorker\)\)/);
  assert.match(script, /while \(!downloadFailed && nextIndex < prints\.length\)/);
  assert.doesNotMatch(script, /Promise\.all\(/, "a failed download never leaves another request running unseen");
});
