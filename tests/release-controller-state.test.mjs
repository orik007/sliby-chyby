import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptOwnerApproval,
  createPullRequestState,
  finishResolver,
  finishReviewWave,
  markReviewerRequested,
  observeHead,
  pendingCommands,
  presentForOwnerApproval,
  recordOwnerFeedback,
  recordReviewerResult,
  startResolver,
  startReviewWave
} from "../automation/release-control/src/state.mjs";

const head = "a".repeat(40);

function completedWave(state, waveNumber, hasFindings) {
  let next = markReviewerRequested(state, { waveNumber, reviewer: "copilot" });
  next = markReviewerRequested(next, { waveNumber, reviewer: "codex" });
  next = recordReviewerResult(next, { waveNumber, reviewer: "copilot", hasFindings, headSha: next.headSha });
  next = recordReviewerResult(next, { waveNumber, reviewer: "codex", hasFindings: false, headSha: next.headSha });
  return finishReviewWave(next, { waveNumber });
}

test("a shared review wave requests each reviewer only once", () => {
  const started = startReviewWave(createPullRequestState({ number: 21, headSha: head }), {
    headSha: head,
    now: "2026-09-08T10:00:00Z"
  });
  const once = markReviewerRequested(started.state, { waveNumber: 1, reviewer: "copilot" });
  assert.throws(() => markReviewerRequested(once, { waveNumber: 1, reviewer: "copilot" }), /already requested/);
});

test("findings in wave one lead to exactly one resolver and then wave two", () => {
  const first = startReviewWave(createPullRequestState({ number: 21, headSha: head }), {
    headSha: head,
    now: "2026-09-08T10:00:00Z"
  });
  const waitingResolver = completedWave(first.state, 1, true);
  const activeResolver = startResolver(waitingResolver);
  const readyForSecond = finishResolver(activeResolver, { headSha: "b".repeat(40) });
  const second = startReviewWave(readyForSecond, {
    headSha: "b".repeat(40),
    now: "2026-09-08T10:10:00Z"
  });
  assert.equal(second.wave.number, 2);
  assert.throws(() => startReviewWave(second.state, {
    headSha: "b".repeat(40),
    now: "2026-09-08T10:11:00Z"
  }), /not waiting/);
});

test("owner feedback after wave two cannot create a third review", () => {
  const first = startReviewWave(createPullRequestState({ number: 21, headSha: head }), {
    headSha: head,
    now: "2026-09-08T10:00:00Z"
  });
  const firstResolver = startResolver(completedWave(first.state, 1, true));
  const secondReady = finishResolver(firstResolver, { headSha: "b".repeat(40) });
  const second = startReviewWave(secondReady, {
    headSha: "b".repeat(40),
    now: "2026-09-08T10:05:00Z"
  });
  const secondResolver = startResolver(completedWave(second.state, 2, true));
  const approvedHead = finishResolver(secondResolver, { headSha: "c".repeat(40) });
  const presented = presentForOwnerApproval(approvedHead, {
    headSha: "c".repeat(40),
    commentId: 100,
    now: "2026-09-08T10:10:00Z"
  });
  const resolverWaiting = recordOwnerFeedback(presented, { headSha: "c".repeat(40), feedback: "Clarify the final change." });
  const resolverActive = startResolver(resolverWaiting);
  const afterFeedback = finishResolver(resolverActive, { headSha: "d".repeat(40) });
  assert.equal(afterFeedback.phase, "awaiting-owner");
  assert.throws(() => startReviewWave(afterFeedback, {
    headSha: "d".repeat(40),
    now: "2026-09-08T10:11:00Z"
  }), /not waiting/);
});

test("approval is bound to the stored current head", () => {
  const first = startReviewWave(createPullRequestState({ number: 21, headSha: head }), {
    headSha: head,
    now: "2026-09-08T10:00:00Z"
  });
  const ready = completedWave(first.state, 1, false);
  const presented = presentForOwnerApproval(ready, {
    headSha: head,
    commentId: 100,
    now: "2026-09-08T10:05:00Z"
  });
  const changed = observeHead(presented, "b".repeat(40));
  assert.equal(changed.activeApproval, null);
  assert.throws(() => acceptOwnerApproval(changed, { headSha: head, commentId: 101, createdAt: "2026-09-08T10:06:00Z" }), /current pull-request head/);
});

test("a reviewer result for an older commit cannot complete the current wave", () => {
  const started = startReviewWave(createPullRequestState({ number: 21, headSha: head }), {
    headSha: head,
    now: "2026-09-08T10:00:00Z"
  });
  const requested = markReviewerRequested(started.state, { waveNumber: 1, reviewer: "copilot" });
  assert.throws(() => recordReviewerResult(requested, {
    waveNumber: 1,
    reviewer: "copilot",
    hasFindings: false,
    headSha: "b".repeat(40)
  }), /current pull-request head/);
});

test("owner feedback preserves its triggering comment identifier for the resolver", () => {
  const started = startReviewWave(createPullRequestState({ number: 21, headSha: head }), {
    headSha: head,
    now: "2026-09-08T10:00:00Z"
  });
  const ready = presentForOwnerApproval(completedWave(started.state, 1, false), {
    headSha: head,
    commentId: 100,
    now: "2026-09-08T10:05:00Z"
  });
  const feedback = recordOwnerFeedback(ready, { headSha: head, feedback: "Please explain this.", commentId: 101 });
  assert.equal(pendingCommands(feedback).at(-1)?.commentId, 101);
});
