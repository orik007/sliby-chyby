# SLAVA Index methodology

## Confirmed purpose

The SLAVA Index measures a party's fidelity to its own pre-election promises. It does not judge whether the promised policy is good or bad, and it is not simply the percentage of promises already completed.

The name is written **SLAVA Index**, without diacritics.

Promise admission is governed by [promise-selection.md](promise-selection.md). Only statements that pass that confirmed selection methodology enter this scoring system. A rejected candidate is not assigned `0` and is not included in the SLAVA Index denominator.

## Confirmed promise scale

| Score | Canonical status | Rule |
|---:|---|---|
| `-2` | `acting-against` | A documented significant act directly contradicts the promise, the party caused a definitive contrary result, or the promised conduct itself was directly violated. |
| `-1` | `moving-against` | A concrete intention, proposal, commitment, vote, or other step points against the promise, but the definitive contrary result has not necessarily occurred. |
| `0` | `no-progress` | The promise is assessable and checked, but no documented significant movement exists in either direction, or it is genuinely too early. |
| `+1` | `moving-towards` | A concrete, verifiable step supports the promise, but the promised outcome has not yet occurred. |
| `+2` | `fulfilled` | The verifiable promised outcome occurred, or the party performed the exact conduct it explicitly promised to perform. |

The scale describes consistency with the promise, not moral approval.

## Confirmed aggregate calculation

Each promise contributes only its current published assessment. Let `N` be the number of tracked promises and `s_i` each current score:

```text
SLAVA Index = (sum(s_i) / (2 * N)) * 100
```

Properties:

- all assessable promises at `+2` produce `+100`;
- all at `-2` produce `-100`;
- all at `0` produce `0`;
- the aggregate is derived, never manually stored.

If `N = 0`, the index is unavailable; division by zero must not be represented as `0`.

The mathematical range is confirmed. The UI displays the result as index points without a percent sign, for example `SLAVA Index: +14`. This is intentionally not presented as “14% of the programme fulfilled.”

### Worked example

A party has 13 promises: five fulfilled (`5 × +2 = +10`), two acted against (`2 × -2 = -4`), three moving towards fulfillment (`3 × +1 = +3`), one moving against (`1 × -1 = -1`), and two with no progress (`2 × 0 = 0`). The point sum is `+8`, the maximum is `26`, and the resulting SLAVA Index is `round(8 / 26 × 100) = +31`.

## Confirmed evidence rules

### Promise evidence

Keep the exact original wording and an attributable source, preferably:

- an official election programme;
- a party campaign website;
- a poster or leaflet;
- a direct video, debate transcript, or official statement.

Do not infer a precise commitment from vague rhetoric. For example, “we will manage responsibly” is not automatically a promise never to support a deficit over a particular number.

### Action and outcome evidence

Prefer primary evidence:

- roll-call votes;
- bills and amendments;
- enacted laws;
- state budgets;
- government resolutions;
- ministerial decisions;
- authoritative outcome data.

News articles are primarily discovery and explanatory context. A report can support a preliminary direction, but a strong final `+2` or `-2` should normally be verified against the underlying primary source.

One article alone is insufficient for a strong final assessment when a relevant primary source should exist. Independent context should not be counted twice when multiple articles merely repeat the same agency report.

## Confirmed relationship between evidence and score

- One promise has one current score.
- Votes, statements, articles, laws, and outcomes are evidence, not separate scores.
- Do not average multiple votes.
- A positive vote does not automatically cancel a negative vote and produce `0`.
- Contradictory actions remain visible in the evidence and history.
- The significance of an act matters more than the number of acts.

### Confirmed party-vote attribution

A Chamber vote is attributed to a party by directly comparing the `yes` and `no` choices cast by members of its parliamentary group at the time of the vote.

- More `yes` than `no` means the party supported the motion.
- More `no` than `yes` means the party opposed the motion.
- Equal `yes` and `no` counts, including `0–0`, establish no party direction.
- Abstentions, registered non-votes, absences, excuses, and members who had not yet taken the oath are retained and displayed but do not determine direction.
- There is no minimum participation threshold. For example, `3 yes`, `0 no`, and `4 absent` is attributed as support and displayed with the exact counts.
- Voided votes and manual or technically incomplete votes do not establish a party position from individual-vote data.
- A numerical majority is not enough when the exact motion or legislative context is unresolved. The official vote must be linked to a documented decisive context before it can enter an assessment package as verified party conduct.
- The author or sponsor of the bill is irrelevant to vote attribution. A tracked party's verified vote is its conduct even when another party, the government, or another authorized proposer introduced the bill.

This rule determines attribution only. Whether a majority `yes` supports or contradicts a promise depends on the exact motion and is decided later from the bounded evidence package.

Examples recorded in the conversations:

- A party announces that it will accept an outcome contrary to its promise: typically `-1`.
- It then votes for a definitive contrary budget or measure: potentially `-2`.
- It proposes a concrete measure supporting the promised result: `+1`.
- The promised measurable result actually occurs: `+2`.
- “We will never vote for this law,” followed by a vote for it: `-2`, because the promised behavior itself was violated.

## Working classification of promise types

Classifying a promise helps determine whether a vote is merely progress or the promised result itself:

- **Outcome promise** — promises a measurable final state. A supporting vote may be `+1`; the final state is required for `+2`.
- **Process promise** — promises a change in rules or procedure. Completion depends on the exact promised process.
- **Behavior promise** — promises that the party will or will not take a defined action. The relevant vote or act can itself be `+2` or `-2`.

This classification is a **working proposal** and needs validation against real cases.

## Working rule for contradictory actions

The conversations converged on the following proposed rule, but did not fully formalize every edge case:

- While the outcome remains unresolved, meaningful contradictory actions generally lead to the worse applicable current assessment rather than an average.
- Repetition increases confidence but does not automatically convert `-1` to `-2`; significance decides.
- A definitive final outcome can supersede earlier directional signals for an outcome promise, while those signals remain in history.
- A one-time behavior promise such as “we will never support X” may be irreversibly broken by one contrary act; later compliant action does not erase the breach.

## Deferred handling of unscorable promises

The current methodology intentionally contains only the five scored states. A hypothetical “not assessable” state was removed because no concrete project case yet requires it.

If a real promise later proves too vague, materially contradictory, impossible to attribute, or otherwise impossible to score fairly, do not invent a result. Pause that case and update this methodology based on the actual evidence before adding a new public status or denominator rule.

## Assessment revisions

The current assessment is the latest published revision. A revision should record at least:

- promise identifier;
- canonical status;
- plain-language explanation;
- evidence identifiers;
- publication time;
- methodology/prompt version;
- assessor information needed for audit;
- any uncertainty or dissent.

Old revisions remain available. Corrections create a new transparent revision rather than silently rewriting history.

## AI assessment proposal

Automated evidence collection and candidate scoring are the confirmed intended workflow. The scoring system must keep discovery separate from judgment:

- a collection stage records sources and creates deduplicated events;
- a matching stage selects a bounded evidence package relevant to one promise;
- scoring assessors may use only the supplied evidence identifiers and excerpts;
- every output remains a revisioned candidate assessment until it passes the configured publication gate.

Two assessors should independently return structured answers covering:

- relevance of the event to the promise;
- attribution to the party;
- sufficiency of evidence;
- process phase: intention, proposal, vote, law, or outcome;
- direction: supports, contradicts, or neutral;
- proposed canonical status;
- cited evidence IDs and exact excerpts;
- short explanation and confidence.

On disagreement, an arbiter receives the same evidence plus anonymized reviews. The proposed arbiter rule is to select A, select B, or return `cannot-decide`; it should not invent a third unsupported interpretation or search for new evidence. Human review handles unresolved cases.

## Open methodology questions

- If a real promise cannot be scored fairly, does the product need a new status, a publication filter, or another treatment?
- How should blocked-by-others and compromise cases affect the score?
- What counts as a missed deadline, and when does it become `-1` or `-2`?
- When mixed actions exist, what precise rule determines when the worse interim assessment applies?
- What minimum evidence package is required for each status, especially `+2` and `-2`?
