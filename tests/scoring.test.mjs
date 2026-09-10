import assert from "node:assert/strict";
import test from "node:test";
import { calculateSlavaIndex } from "../src/lib/scoring.ts";

test("sums the full positive and negative range", () => {
  assert.equal(calculateSlavaIndex([2, 2, 2]), 6);
  assert.equal(calculateSlavaIndex([-2, -2, -2]), -6);
});

test("keeps verified no-progress promises at zero", () => {
  assert.equal(calculateSlavaIndex([0, 0, 0]), 0);
});

test("returns no index when there are no tracked promises", () => {
  assert.equal(calculateSlavaIndex([]), null);
});

test("sums point scores without normalization", () => {
  assert.equal(calculateSlavaIndex([2, 1, 0]), 3);
  assert.equal(calculateSlavaIndex([-1, 0, 0]), -1);
});
