import assert from "node:assert/strict";
import test from "node:test";
import { calculateSlavaIndex, calculateSlavaIndexParts } from "../src/lib/scoring.ts";

test("returns the full positive and negative range", () => {
  assert.equal(calculateSlavaIndex([2, 2, 2]), 100);
  assert.equal(calculateSlavaIndex([-2, -2, -2]), -100);
});

test("keeps verified no-progress promises at zero", () => {
  assert.equal(calculateSlavaIndex([0, 0, 0]), 0);
});

test("returns no index when there are no tracked promises", () => {
  assert.equal(calculateSlavaIndex([]), null);
});

test("rounds the normalized point score deterministically", () => {
  assert.equal(calculateSlavaIndex([2, 1, 0]), 50);
  assert.equal(calculateSlavaIndex([-1, 0, 0]), -17);
});

test("splits the index into its positive and negative parts on the same scale", () => {
  assert.deepEqual(calculateSlavaIndexParts([2, 1, 0, -1]), { positive: 38, negative: -12 });
  assert.deepEqual(calculateSlavaIndexParts([0, 0]), { positive: 0, negative: 0 });
  assert.deepEqual(calculateSlavaIndexParts([-2]), { positive: 0, negative: -100 });
  assert.equal(calculateSlavaIndexParts([]), null);
});
