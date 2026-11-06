import assert from "node:assert/strict";
import test from "node:test";
import { noticesAfterPublication, planAssessmentPublication } from "../scripts/lib/assessment-publication.mjs";

const proposal = (promiseId, resolutionState, extra = {}) => ({ proposalId: `${promiseId}--${resolutionState}`, promiseId, resolutionState, resolutionReason: null, supersededByProposalId: null, ...extra });

test("publishes the current proposal of every promise with a current package, by its resolution", () => {
  const reviewManifest = { proposals: [
    proposal("b", "candidate"),
    proposal("a", "candidate", { supersededByProposalId: "a--newer" }),
    proposal("a", "human-review-required", { proposalId: "a--newer", resolutionReason: "arbiter-cannot-decide" }),
    proposal("c", "human-review-required", { resolutionReason: "insufficient-evidence" }),
    proposal("d", "human-review-required", { resolutionReason: "arbiter-selected-insufficient-evidence" }),
    proposal("e", "candidate"),
    proposal("f", "candidate"),
    proposal("g", "human-review-required", { resolutionReason: "arbiter-input-too-large" }),
    proposal("h", "assessment-failed", { resolutionReason: "both-assessors-invalid" })
  ] };
  const packageQueue = { packages: [
    { promiseId: "a" }, { promiseId: "b" }, { promiseId: "c" }, { promiseId: "d" },
    // Every package of e is withdrawn: none of its law changes is relevant any longer.
    { promiseId: "e", withdrawnAt: "2026-10-31T00:00:00Z" },
    // f has only a superseded package.
    { promiseId: "f", supersededByPackageHash: "x" },
    { promiseId: "g" }, { promiseId: "h" }
  ] };
  const plan = planAssessmentPublication({ reviewManifest, packageQueue });
  assert.deepEqual(plan.candidates.map(({ promiseId }) => promiseId), ["b"]);
  assert.deepEqual(plan.inconclusive.map(({ proposalId }) => proposalId), ["a--newer", "g--human-review-required", "h--assessment-failed"]);
  assert.deepEqual(plan.insufficientEvidence.map(({ promiseId }) => promiseId), ["c", "d"]);
});

test("too-much-evidence notices stay unless renewed; inconclusive notices are replaced by the current ones", () => {
  const notices = [
    { promiseId: "x", kind: "too-much-evidence", asOf: "2026-11-01", lawChangeCount: 131 },
    { promiseId: "y", kind: "too-much-evidence", asOf: "2026-11-01", lawChangeCount: 2 },
    { promiseId: "z", kind: "inconclusive-assessment", asOf: "2026-10-01" }
  ];
  const after = noticesAfterPublication({ notices, inconclusive: [{ promiseId: "w", kind: "inconclusive-assessment", asOf: "2026-11-01" }], renewedPromiseIds: ["y"] });
  assert.deepEqual(after.map(({ promiseId }) => promiseId), ["w", "x"]);
});
