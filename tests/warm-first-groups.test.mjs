import assert from "node:assert/strict";
import test from "node:test";
import { createWarmFirstQueue } from "../scripts/lib/warm-first-groups.mjs";

test("a group is checked one at a time until a check calls the provider, then several at once up to the limit", () => {
  const queue = createWarmFirstQueue({ perGroupLimit: 2 });
  queue.add(["a1", "a2", "a3", "a4"]);
  const first = queue.take();
  assert.equal(first.entry, "a1");
  assert.equal(queue.take(), null, "nothing else of the group while it is being warmed");
  first.done(true);
  const second = queue.take();
  const third = queue.take();
  assert.deepEqual([second.entry, third.entry], ["a2", "a3"]);
  assert.equal(queue.take(), null, "at most two at once");
  second.done(false);
  assert.equal(queue.take().entry, "a4");
});

test("a check answered from saved results does not warm its group; the next check of the group does", () => {
  const queue = createWarmFirstQueue({ perGroupLimit: 4 });
  queue.add(["a1", "a2", "a3"]);
  const first = queue.take();
  first.done(false);
  const second = queue.take();
  assert.equal(second.entry, "a2");
  assert.equal(queue.take(), null, "still one at a time");
  second.done(true);
  assert.equal(queue.take().entry, "a3");
});

test("an open group is taken before a new group is started, and new groups largest first", () => {
  const queue = createWarmFirstQueue({ perGroupLimit: 8, compare: (left, right) => left.localeCompare(right) });
  queue.add(["s1", "s2"]);
  queue.add(["l1", "l2", "l3"]);
  queue.add(["t1", "t2"]);
  const large = queue.take();
  assert.equal(large.entry, "l1", "the largest group first");
  const small = queue.take();
  assert.equal(small.entry, "s1", "a tie in the order compare gives");
  large.done(true);
  assert.equal(queue.take().entry, "l2", "the open group before the next new one");
  assert.equal(queue.take().entry, "l3");
  assert.equal(queue.take().entry, "t1");
});

test("busy and changed follow the checks in flight", async () => {
  const queue = createWarmFirstQueue({ perGroupLimit: 1 });
  queue.add([]);
  assert.equal(queue.take(), null, "an empty group is ignored");
  queue.add(["a1", "a2"]);
  const first = queue.take();
  assert.equal(queue.busy, true);
  const changed = queue.changed();
  first.done(true);
  first.done(true);
  await changed;
  assert.equal(queue.busy, false);
  const second = queue.take();
  second.done(false);
  assert.equal(queue.take(), null);
});

test("the limit must be a positive integer", () => {
  assert.throws(() => createWarmFirstQueue({ perGroupLimit: 0 }), /positive integer/);
});
