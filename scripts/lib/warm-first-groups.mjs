/**
 * Groups of checks that share a long input (the relevance checks of one law
 * change), taken by a pool of workers (docs/evidence-pipeline.md, Audit and
 * cost control). A group's checks are made one at a time until one of them
 * calls the provider, which writes the shared input to the provider's prompt
 * cache; the rest of the group is then open to every worker, at most
 * `perGroupLimit` at a time. Open groups are taken before a new one is
 * started, and new groups largest first, ties in the order `compare` gives.
 */
export function createWarmFirstQueue({ perGroupLimit, compare = () => 0 }) {
  if (!Number.isInteger(perGroupLimit) || perGroupLimit < 1) throw new Error(`perGroupLimit must be a positive integer, not ${perGroupLimit}`);
  // Groups not yet warmed and not being warmed, and groups open to all.
  const fresh = [];
  const open = [];
  let inFlight = 0;
  let changed = null;

  function signal() {
    changed?.resolve();
    changed = null;
  }

  function finish(group, warming, called) {
    inFlight -= 1;
    group.inFlight -= 1;
    if (warming) {
      if (called) open.push(group);
      // Not warmed by a check answered from saved results: the next check
      // of the group warms it.
      else if (group.next < group.entries.length) fresh.push(group);
    }
    signal();
  }

  return {
    /** Adds a group of entries; an empty group is ignored. */
    add(entries) {
      if (entries.length === 0) return;
      fresh.push({ entries, next: 0, inFlight: 0 });
      signal();
    },
    /**
     * The next entry to check, with `done(called)` to call once it is
     * checked (`called`: a provider call answered it); null when no entry
     * can start now.
     */
    take() {
      const available = open.find((group) => group.next < group.entries.length && group.inFlight < perGroupLimit);
      const warming = !available && fresh.length > 0;
      if (!available && !warming) return null;
      if (warming) fresh.sort((left, right) => (right.entries.length - right.next) - (left.entries.length - left.next) || compare(left.entries[left.next], right.entries[right.next]));
      const group = available ?? fresh.shift();
      const entry = group.entries[group.next];
      group.next += 1;
      group.inFlight += 1;
      inFlight += 1;
      let finished = false;
      return {
        entry,
        done(called) {
          if (finished) return;
          finished = true;
          finish(group, warming, called);
        }
      };
    },
    /** True while an entry is being checked. */
    get busy() {
      return inFlight > 0;
    },
    /** Resolves on the next added group or finished check. */
    changed() {
      changed ??= Promise.withResolvers();
      return changed.promise;
    }
  };
}
