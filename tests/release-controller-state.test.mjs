import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptOwnerApproval,
  createPullRequestState,
  finishResolver,
  finishReviewWave,
  markReviewerRequested,
  observeHead,
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
  next = recordReviewerResult(next, { waveNumber, reviewer: "copilot", hasFindings });
  next = recordReviewerResult(next, { waveNumber, reviewer: "codex", hasFindings: false });
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
  const afterFirst = completedWave(first.state, 1, false);
  const approvedHead = presentForOwnerApproval(afterFirst, {
    headSha: head,
    commentId: 100,
    now: "2026-09-08T10:05:00Z"
  });
  const resolverWaiting = recordOwnerFeedback(approvedHead, { headSha: head });
  const resolverActive = startResolver(resolverWaiting);
  const afterFeedback = finishResolver(resolverActive, { headSha: "b".repeat(40) });
  assert.equal(afterFeedback.phase, "awaiting-owner");
  assert.throws(() => startReviewWave(afterFeedback, {
    headSha: "b".repeat(40),
    now: "2026-09-08T10:10:00Z"
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
  assert.throws(() => acceptOwnerApproval(changed, { headSha: head }), /current pull-request head/);
});
