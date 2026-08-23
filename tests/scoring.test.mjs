import assert from "node:assert/strict";
import test from "node:test";
import { calculateSlavaIndex } from "../src/lib/scoring.ts";

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
