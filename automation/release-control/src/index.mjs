import {
  OWNER_APPROVAL,
  READY_COMMAND,
  acceptOwnerApproval,
  createPullRequestState,
  finishResolver,
  finishReviewWave,
  markReviewerRequested,
  observeHead,
  recordDelivery,
  recordOwnerFeedback,
  recordReviewerResult,
  presentForOwnerApproval,
  startResolver,
  startReviewWave
} from "./state.mjs";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2026-03-10";

function base64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function pemBytes(pem) {
  const normalized = pem.replaceAll("\\n", "\n").replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createAppJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const input = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({ iat: now - 30, exp: now + 540, iss: env.GITHUB_APP_ID }))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(env.GITHUB_APP_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return `${input}.${base64Url(new Uint8Array(signature))}`;
}

async function installationToken(env, installationId) {
  const appJwt = await createAppJwt(env);
  const response = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: githubHeaders(appJwt)
  });
  if (!response.ok) throw new Error(`GitHub installation token failed: ${response.status}`);
  return (await response.json()).token;
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "sliby-chyby-release-control"
  };
}

async function githubJson(token, path, init = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...githubHeaders(token), ...(init.headers ?? {}) }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path} failed: ${response.status} ${body?.message ?? ""}`.trim());
  return body;
}

async function validWebhook(request, env, body) {
  const signature = request.headers.get("X-Hub-Signature-256");
  if (!signature?.startsWith("sha256=") || !env.GITHUB_WEBHOOK_SECRET) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.GITHUB_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const hex = signature.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  const actual = Uint8Array.from({ length: hex.length / 2 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
  return crypto.subtle.verify("HMAC", key, actual, new TextEncoder().encode(body));
}

function isPullRequestComment(payload) {
  return Boolean(payload.issue?.pull_request?.url);
}

function commandForComment(payload, pullRequest, ownerLogin) {
  const body = payload.comment.body.trim();
  const sender = payload.sender.login;
  if (sender === "github-actions[bot]" && /^<!-- sliby-release-resolver: complete head [0-9a-f]{40} -->/i.test(body)) {
    return { type: "resolver-complete" };
  }
  if (body.toLowerCase() === READY_COMMAND && sender === pullRequest.user.login) {
    return { type: "ready" };
  }
  if (sender !== ownerLogin) return { type: "ignore" };
  if (body.toLowerCase() === OWNER_APPROVAL) return { type: "approve" };
  return { type: "feedback", comment: body, commentId: payload.comment.id };
}

export class PullRequestState {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async current({ number, headSha }) {
    return (await this.ctx.storage.get("state")) ?? createPullRequestState({ number, headSha });
  }

  async fetch(request) {
    const event = await request.json();
    let state = await this.current(event);
    const delivered = recordDelivery(state, event.deliveryId);
    if (delivered.duplicate) return Response.json({ duplicate: true, commands: [] });
    state = delivered.state;
    state = observeHead(state, event.headSha);
    const commands = [];

    if (event.kind === "comment") {
      if (event.command.type === "ready") {
        const started = startReviewWave(state, { headSha: event.headSha, now: event.now });
        state = markReviewerRequested(started.state, { waveNumber: started.wave.number, reviewer: "copilot" });
        state = markReviewerRequested(state, { waveNumber: started.wave.number, reviewer: "codex" });
        commands.push({ type: "request-reviewers", wave: started.wave.number, headSha: event.headSha });
      } else if (event.command.type === "approve") {
        state = acceptOwnerApproval(state, { headSha: event.headSha });
        commands.push({ type: "merge", headSha: event.headSha });
      } else if (event.command.type === "feedback" && state.phase === "awaiting-owner") {
        state = recordOwnerFeedback(state, { headSha: event.headSha });
        state = startResolver(state);
        commands.push({ type: "dispatch-resolver", headSha: event.headSha, feedback: event.command.comment, commentId: event.command.commentId });
      } else if (event.command.type === "resolver-complete" && state.phase === "resolving" && state.resolver?.started) {
        const source = state.resolver.source;
        state = finishResolver(state, { headSha: event.headSha });
        if (source === "wave-1") {
          const started = startReviewWave(state, { headSha: event.headSha, now: event.now });
          state = markReviewerRequested(started.state, { waveNumber: started.wave.number, reviewer: "copilot" });
          state = markReviewerRequested(state, { waveNumber: started.wave.number, reviewer: "codex" });
          commands.push({ type: "request-reviewers", wave: started.wave.number, headSha: event.headSha });
        } else {
          commands.push({ type: "present-owner", headSha: event.headSha });
        }
      }
    } else if (event.kind === "review-result" && state.phase === "reviewing" && state.waves.length > 0) {
      state = recordReviewerResult(state, {
        waveNumber: state.waves.at(-1)?.number,
        reviewer: event.reviewer,
        hasFindings: event.hasFindings
      });
      const wave = state.waves.at(-1);
      if (wave.copilotResponded && wave.codexResponded) {
        state = finishReviewWave(state, { waveNumber: wave.number });
        if (state.phase === "resolving") {
          state = startResolver(state);
          commands.push({ type: "dispatch-resolver", headSha: event.headSha, feedback: "Address the completed AI review findings.", reviewWave: wave.number });
        } else {
          commands.push({ type: "present-owner", headSha: event.headSha });
        }
      }
    } else if (event.kind === "register-owner-notice") {
      state = presentForOwnerApproval(state, {
        headSha: event.headSha,
        commentId: event.commentId,
        now: event.now
      });
    }

    await this.ctx.storage.put("state", state);
    return Response.json({ duplicate: false, commands, state });
  }
}

async function unresolvedReviewThreads(token, owner, repo, number) {
  const response = await fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) { nodes { isResolved } }
          }
        }
      }`,
      variables: { owner, repo, number }
    })
  });
  const body = await response.json();
  if (!response.ok || body.errors) throw new Error(`GitHub GraphQL review-thread query failed: ${body.errors?.[0]?.message ?? response.status}`);
  return body.data.repository.pullRequest.reviewThreads.nodes.filter((thread) => !thread.isResolved).length;
}

async function pullRequestForEvent(env, payload) {
  const installationId = payload.installation?.id;
  if (!installationId) throw new Error("The webhook does not identify a GitHub App installation.");
  const token = await installationToken(env, installationId);
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const number = payload.pull_request?.number ?? payload.issue?.number;
  const pullRequest = await githubJson(token, `/repos/${owner}/${repo}/pulls/${number}`);
  if (pullRequest.head.repo?.full_name !== payload.repository.full_name) {
    throw new Error("The release controller does not write to pull requests from forks.");
  }
  return { token, owner, repo, number, pullRequest };
}

async function checksPass(token, owner, repo, headSha) {
  const checks = await githubJson(token, `/repos/${owner}/${repo}/commits/${headSha}/check-runs?filter=latest&per_page=100`);
  const verify = checks.check_runs.find((check) => check.name === "Test and build");
  return verify?.status === "completed" && verify.conclusion === "success";
}

async function executeCommand(env, context, command) {
  const { token, owner, repo, number } = context;
  if (command.type === "request-reviewers") {
    await githubJson(token, `/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`, {
      method: "POST",
      body: JSON.stringify({ reviewers: [env.COPILOT_REVIEWER_LOGIN ?? "copilot-pull-request-reviewer[bot]"] }),
      headers: { "Content-Type": "application/json" }
    });
    await githubJson(token, `/repos/${owner}/${repo}/issues/${number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: `@codex review\n\n<!-- sliby-release-control: wave ${command.wave}, head ${command.headSha} -->` }),
      headers: { "Content-Type": "application/json" }
    });
    return;
  }

  if (command.type === "dispatch-resolver") {
    await githubJson(token, `/repos/${owner}/${repo}/dispatches`, {
      method: "POST",
      body: JSON.stringify({
        event_type: "sliby-release-resolver",
        client_payload: {
          pull_number: number,
          head_sha: command.headSha,
          head_ref: context.pullRequest.head.ref,
          feedback: command.feedback,
          feedback_comment_id: command.commentId
        }
      }),
      headers: { "Content-Type": "application/json" }
    });
    return;
  }

  if (command.type === "merge") {
    const current = await githubJson(token, `/repos/${owner}/${repo}/pulls/${number}`);
    if (current.head.sha !== command.headSha || !(await checksPass(token, owner, repo, command.headSha)) || (await unresolvedReviewThreads(token, owner, repo, number)) > 0) {
      throw new Error("The approved head is stale or has not passed Verify pull request.");
    }
    await githubJson(token, `/repos/${owner}/${repo}/pulls/${number}/merge`, {
      method: "PUT",
      body: JSON.stringify({ sha: command.headSha, merge_method: "squash" }),
      headers: { "Content-Type": "application/json" }
    });
    return;
  }

  if (command.type === "present-owner") {
    if (!(await checksPass(token, owner, repo, command.headSha)) || (await unresolvedReviewThreads(token, owner, repo, number)) > 0) return;
    const notice = await githubJson(token, `/repos/${owner}/${repo}/issues/${number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: `@${env.OWNER_LOGIN ?? "orik007"} PR is ready for owner approval. Post exactly \`schvaluji\` as a new comment to approve the current verified revision.\n\n<!-- sliby-release-control: ready head ${command.headSha} -->` }),
      headers: { "Content-Type": "application/json" }
    });
    const stub = env.PULL_REQUEST_STATE.getByName(`${owner}/${repo}#${number}`);
    await stub.fetch("https://state/event", {
      method: "POST",
      body: JSON.stringify({
        deliveryId: `owner-notice-${notice.id}`,
        kind: "register-owner-notice",
        number,
        headSha: command.headSha,
        commentId: notice.id,
        now: new Date().toISOString()
      })
    });
  }
}

async function handleWebhook(request, env, ctx) {
  const body = await request.text();
  if (!(await validWebhook(request, env, body))) return new Response("Invalid webhook signature", { status: 401 });
  const payload = JSON.parse(body);
  const eventName = request.headers.get("X-GitHub-Event");
  const deliveryId = request.headers.get("X-GitHub-Delivery");
  if (!deliveryId || !payload.repository?.full_name) return new Response("Unsupported webhook", { status: 202 });

  if (eventName !== "pull_request" && eventName !== "pull_request_review" && !(eventName === "issue_comment" && isPullRequestComment(payload))) {
    return new Response(null, { status: 202 });
  }

  const context = await pullRequestForEvent(env, payload);
  const reviewer = payload.sender?.login === (env.COPILOT_REVIEWER_LOGIN ?? "copilot-pull-request-reviewer[bot]")
    ? "copilot"
    : payload.sender?.login === (env.CODEX_REVIEWER_LOGIN ?? "codex")
      ? "codex"
      : null;
  const kind = eventName === "issue_comment" ? "comment" : eventName === "pull_request_review" && reviewer ? "review-result" : "head";
  const command = kind === "comment" ? commandForComment(payload, context.pullRequest, env.OWNER_LOGIN ?? "orik007") : { type: "ignore" };
  const stub = env.PULL_REQUEST_STATE.getByName(`${payload.repository.full_name}#${context.number}`);
  const result = await stub.fetch("https://state/event", {
    method: "POST",
    body: JSON.stringify({
      deliveryId,
      kind,
      command,
      reviewer,
      hasFindings: payload.review?.state?.toLowerCase() === "changes_requested",
      number: context.number,
      headSha: context.pullRequest.head.sha,
      now: new Date().toISOString()
    })
  });
  const outcome = await result.json();
  if (!outcome.duplicate && outcome.commands.length) {
    ctx.waitUntil(Promise.all(outcome.commands.map((item) => executeCommand(env, context, item))));
  }
  return Response.json({ accepted: true, duplicate: outcome.duplicate });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") return Response.json({ ok: true });
    if (request.method === "POST" && url.pathname === "/github/webhook") return handleWebhook(request, env, ctx);
    return new Response("Not found", { status: 404 });
  }
};
