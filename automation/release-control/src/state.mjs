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
    pendingCommands: [],
    processedDeliveryIds: []
  };
}

function enqueue(state, command) {
  if (!state.pendingCommands.some((candidate) => candidate.id === command.id)) {
    state.pendingCommands.push(command);
  }
}

function takeCommand(state, commandId) {
  const command = state.pendingCommands.find((candidate) => candidate.id === commandId);
  if (!command) throw new Error("The completed command is not pending.");
  state.pendingCommands = state.pendingCommands.filter((candidate) => candidate.id !== commandId);
  return command;
}

function enqueueReviewRequests(state, wave) {
  enqueue(state, { id: `review-${wave.number}-copilot-${wave.headSha}`, type: "request-copilot", wave: wave.number, headSha: wave.headSha });
  enqueue(state, { id: `review-${wave.number}-codex-${wave.headSha}`, type: "request-codex", wave: wave.number, headSha: wave.headSha });
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
  next.pendingCommands = next.pendingCommands.filter((command) => command.headSha === headSha || command.type === "merge");

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
  enqueueReviewRequests(next, wave);
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

export function recordReviewerResult(state, { waveNumber, reviewer, hasFindings, headSha }) {
  const next = clone(state);
  const wave = next.waves.find((candidate) => candidate.number === waveNumber);
  if (!wave || next.phase !== "reviewing") {
    throw new Error("There is no active review wave.");
  }
  requireCurrentHead(next, headSha);
  if (wave.headSha !== headSha) {
    throw new Error("The review result does not cover the active review-wave head.");
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
    enqueue(next, { id: `resolver-${next.resolver.source}-${wave.headSha}`, type: "dispatch-resolver", headSha: wave.headSha, reviewWave: wave.number, feedback: "Address the completed AI review findings." });
  } else {
    next.phase = "awaiting-owner";
    enqueue(next, { id: `present-owner-${wave.headSha}`, type: "present-owner", headSha: wave.headSha });
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
    enqueue(next, { id: `present-owner-${headSha}`, type: "present-owner", headSha });
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

export function acceptOwnerApproval(state, { headSha, commentId, createdAt }) {
  requireCurrentHead(state, headSha);
  const next = clone(state);
  if (next.phase !== "awaiting-owner" || !next.activeApproval || next.activeApproval.headSha !== headSha) {
    throw new Error("There is no active approval for this pull-request head.");
  }
  if (!commentId || commentId === next.activeApproval.commentId || !createdAt || createdAt <= next.activeApproval.presentedAt) {
    throw new Error("The approval comment is not a newly created response to the active notice.");
  }
  next.phase = "merging";
  enqueue(next, { id: `merge-${headSha}`, type: "merge", headSha });
  return next;
}

export function recordOwnerFeedback(state, { headSha, feedback, commentId }) {
  requireCurrentHead(state, headSha);
  const next = clone(state);
  if (next.phase !== "awaiting-owner" || !next.activeApproval) {
    throw new Error("Owner feedback is not actionable in the current state.");
  }
  next.activeApproval = null;
  next.phase = "resolving";
  next.resolver = { source: "owner-feedback", headSha, started: false };
  enqueue(next, { id: `resolver-owner-feedback-${headSha}`, type: "dispatch-resolver", headSha, feedback, commentId });
  return next;
}

export function completeCommand(state, { commandId }) {
  const next = clone(state);
  const command = takeCommand(next, commandId);
  requireCurrentHead(next, command.headSha);
  if (command.type === "request-copilot") return markReviewerRequested(next, { waveNumber: command.wave, reviewer: "copilot" });
  if (command.type === "request-codex") return markReviewerRequested(next, { waveNumber: command.wave, reviewer: "codex" });
  if (command.type === "dispatch-resolver") return startResolver(next);
  if (command.type === "present-owner") return next;
  if (command.type === "merge") {
    next.phase = "merged";
    return next;
  }
  throw new Error("Unknown completed command type.");
}

export function pendingCommands(state) {
  return structuredClone(state.pendingCommands);
}
