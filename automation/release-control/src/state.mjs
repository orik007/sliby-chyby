export const READY_COMMAND = "@slibychyby-release-control ready";
export const OWNER_APPROVAL = "schvaluji";

const MAX_REVIEW_WAVES = 2;

export function createPullRequestState({ number, headSha }) {
  return {
    number,
    headSha,
    phase: "awaiting-ready",
    waves: [],
    activeApproval: null,
    resolver: null,
    processedDeliveryIds: []
  };
}

function clone(value) {
  return structuredClone(value);
}

function requireCurrentHead(state, headSha) {
  if (state.headSha !== headSha) {
    throw new Error("The command does not target the current pull-request head.");
  }
}

export function recordDelivery(state, deliveryId) {
  const next = clone(state);
  if (next.processedDeliveryIds.includes(deliveryId)) {
    return { state: next, duplicate: true };
  }
  next.processedDeliveryIds = [...next.processedDeliveryIds, deliveryId].slice(-100);
  return { state: next, duplicate: false };
}

export function observeHead(state, headSha) {
  const next = clone(state);
  if (next.headSha === headSha || next.phase === "merged") {
    return next;
  }

  next.headSha = headSha;
  next.activeApproval = null;

  if (next.phase === "resolving") {
    return next;
  }

  if (next.waves.length >= MAX_REVIEW_WAVES) {
    next.phase = "blocked-unreviewed-head";
    return next;
  }

  next.phase = "awaiting-ready";
  return next;
}

export function startReviewWave(state, { headSha, now }) {
  requireCurrentHead(state, headSha);
  const next = clone(state);
  if (next.phase !== "awaiting-ready") {
    throw new Error("This pull request is not waiting for an explicit ready command.");
  }
  if (next.waves.length >= MAX_REVIEW_WAVES) {
    throw new Error("A third AI review wave is forbidden.");
  }

  const wave = {
    number: next.waves.length + 1,
    headSha,
    startedAt: now,
    copilotRequested: false,
    codexRequested: false,
    copilotResponded: false,
    codexResponded: false,
    hasFindings: false
  };
  next.waves.push(wave);
  next.phase = "reviewing";
  return { state: next, wave };
}

export function markReviewerRequested(state, { waveNumber, reviewer }) {
  const next = clone(state);
  const wave = next.waves.find((candidate) => candidate.number === waveNumber);
  if (!wave || next.phase !== "reviewing") {
    throw new Error("There is no active review wave.");
  }
  const key = reviewer === "copilot" ? "copilotRequested" : "codexRequested";
  if (wave[key]) {
    throw new Error(`The ${reviewer} review was already requested for this wave.`);
  }
  wave[key] = true;
  return next;
}

export function recordReviewerResult(state, { waveNumber, reviewer, hasFindings }) {
  const next = clone(state);
  const wave = next.waves.find((candidate) => candidate.number === waveNumber);
  if (!wave || next.phase !== "reviewing") {
    throw new Error("There is no active review wave.");
  }
  const responseKey = reviewer === "copilot" ? "copilotResponded" : "codexResponded";
  wave[responseKey] = true;
  wave.hasFindings ||= hasFindings;
  return next;
}

export function finishReviewWave(state, { waveNumber }) {
  const next = clone(state);
  const wave = next.waves.find((candidate) => candidate.number === waveNumber);
  if (!wave || next.phase !== "reviewing") {
    throw new Error("There is no active review wave.");
  }
  if (!wave.copilotRequested || !wave.codexRequested || !wave.copilotResponded || !wave.codexResponded) {
    throw new Error("Both reviewers must respond before the wave can finish.");
  }

  if (wave.hasFindings) {
    next.phase = "resolving";
    next.resolver = { source: `wave-${wave.number}`, headSha: wave.headSha, started: false };
  } else {
    next.phase = "awaiting-owner";
  }
  return next;
}

export function startResolver(state) {
  const next = clone(state);
  if (next.phase !== "resolving" || !next.resolver || next.resolver.started) {
    throw new Error("No resolver task is waiting to start.");
  }
  next.resolver.started = true;
  return next;
}

export function finishResolver(state, { headSha }) {
  const next = clone(state);
  if (next.phase !== "resolving" || !next.resolver || !next.resolver.started) {
    throw new Error("No resolver task is active.");
  }
  next.headSha = headSha;
  const source = next.resolver.source;
  next.resolver = null;

  if (source === "wave-1") {
    next.phase = "awaiting-ready";
  } else {
    next.phase = "awaiting-owner";
  }
  return next;
}

export function presentForOwnerApproval(state, { headSha, commentId, now }) {
  requireCurrentHead(state, headSha);
  const next = clone(state);
  if (next.phase !== "awaiting-owner") {
    throw new Error("The pull request is not ready for owner approval.");
  }
  next.activeApproval = { headSha, commentId, presentedAt: now };
  return next;
}

export function acceptOwnerApproval(state, { headSha }) {
  requireCurrentHead(state, headSha);
  const next = clone(state);
  if (next.phase !== "awaiting-owner" || !next.activeApproval || next.activeApproval.headSha !== headSha) {
    throw new Error("There is no active approval for this pull-request head.");
  }
  next.phase = "merging";
  return next;
}

export function recordOwnerFeedback(state, { headSha }) {
  requireCurrentHead(state, headSha);
  const next = clone(state);
  if (next.phase !== "awaiting-owner" || !next.activeApproval) {
    throw new Error("Owner feedback is not actionable in the current state.");
  }
  next.activeApproval = null;
  next.phase = "resolving";
  next.resolver = { source: "owner-feedback", headSha, started: false };
  return next;
}
