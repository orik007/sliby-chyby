import assert from "node:assert/strict";
import test from "node:test";
import { noticesAfterPublication, planAssessmentPublication } from "../scripts/lib/assessment-publication.mjs";

const proposal = (promiseId, assessmentFingerprint, resolutionState, extra = {}) => ({ proposalId: `${promiseId}--${assessmentFingerprint}`, promiseId, assessmentFingerprint, resolutionState, resolutionReason: null, ...extra });

test("publishes the assessment of each promise's current package, matched by its fingerprint", () => {
  const reviewManifest = { proposals: [
    proposal("a", "a1", "candidate"),
    proposal("a", "a2", "human-review-required", { resolutionReason: "arbiter-cannot-decide" }),
    proposal("b", "b1", "candidate", { reducedAssessmentFingerprint: "b2" }),
    proposal("c", "c1", "human-review-required", { resolutionReason: "insufficient-evidence" }),
    proposal("d", "d1", "human-review-required", { resolutionReason: "arbiter-selected-insufficient-evidence" }),
    proposal("e", "e1", "candidate"),
    proposal("g", "g1", "human-review-required", { resolutionReason: "arbiter-input-too-large" }),
    proposal("h", "h1", "candidate")
  ] };
  const currentFingerprints = new Map([
    // a's current package has the fingerprint of its newer proposal.
    ["a", "a2"],
    // b's package differs only by law changes its assessors found not relevant.
    ["b", "b2"],
    ["c", "c1"], ["d", "d1"],
    // e's package changed and is not assessed yet: its older proposal is not published.
    ["e", "e2"],
    ["g", "g1"],
    // Both assessors failed on h's current package, after an older proposal.
    ["h", "h2"]
  ]);
  const failures = [{ promiseId: "h", assessmentFingerprint: "h2", path: "failures/h/h2" }, { promiseId: "c", assessmentFingerprint: "c0", path: "failures/c/c0" }];
  const plan = planAssessmentPublication({ reviewManifest, currentFingerprints, failures });
  assert.deepEqual(plan.candidates.map(({ proposalId }) => proposalId), ["b--b1"]);
  assert.deepEqual(plan.insufficientEvidence.map(({ promiseId }) => promiseId), ["c", "d"]);
  assert.deepEqual(plan.inconclusive.map(({ promiseId, path }) => path ?? promiseId), ["a", "g", "failures/h/h2"]);
  assert.deepEqual(plan.notAssessed.map(({ promiseId }) => promiseId), ["e"]);
});

test("too-much-evidence notices stay unless renewed or followed by an inconclusive assessment; inconclusive notices are replaced", () => {
  const notices = [
    { promiseId: "x", kind: "too-much-evidence", asOf: "2026-11-01", lawChangeCount: 131 },
    { promiseId: "y", kind: "too-much-evidence", asOf: "2026-11-01", lawChangeCount: 2 },
    { promiseId: "z", kind: "inconclusive-assessment", asOf: "2026-10-01" }
  ];
  const after = noticesAfterPublication({ notices, inconclusive: [{ promiseId: "w", kind: "inconclusive-assessment", asOf: "2026-11-01" }], renewedPromiseIds: ["y"] });
  assert.deepEqual(after.map(({ promiseId }) => promiseId), ["w", "x"]);
  const replaced = noticesAfterPublication({ notices, inconclusive: [{ promiseId: "x", kind: "inconclusive-assessment", asOf: "2026-11-06" }], renewedPromiseIds: [] });
  assert.deepEqual(replaced.map(({ promiseId, kind }) => `${promiseId} ${kind}`), ["x inconclusive-assessment", "y too-much-evidence"]);
});
