# SLAVA Index methodology

## Confirmed purpose

The SLAVA Index measures a party's fidelity to its own pre-election promises. It does not judge whether the promised policy is good or bad, and it is not simply the percentage of promises already completed.

The name is written **SLAVA Index**, without diacritics.

Promise admission is governed by [promise-selection.md](promise-selection.md). Only statements that pass that confirmed selection methodology enter this scoring system. A rejected candidate is not assigned `0` and is not included in the SLAVA Index denominator.

## Confirmed promise scale

| Score | Canonical status | Rule |
|---:|---|---|
| `-2` | `acting-against` | A documented significant act directly contradicts the promise, the party caused a definitive contrary result, or the promised conduct itself was directly violated. |
| `-1` | `moving-against` | A concrete intention, proposal, commitment, vote, verified failure to support the exact promise at a decisive vote, or other step points against the promise, but the definitive contrary result has not necessarily occurred. |
| `0` | `no-progress` | The promise is assessable and checked, but no documented significant movement exists in either direction, or it is genuinely too early. |
| `+1` | `moving-towards` | A concrete, verifiable step supports the promise, but the promised outcome has not yet occurred. |
| `+2` | `fulfilled` | The verifiable promised outcome occurred, the party performed the exact conduct it explicitly promised, or the party gave strict-majority support at a verified decisive substantive vote to a measure that itself would deliver the whole legislative promise. |

The scale describes consistency with the promise, not moral approval.

### Confirmed reader-facing language

Canonical English status names are internal values. They must not appear in the proposed public copy. Public text states the meaning naturally, for example “strana udělala dílčí krok ke splnění slibu”, “zatím se nic podstatného nestalo”, or “strana jednala proti svému slibu”. A clearly separated technical reviewer section may show the canonical values for audit and debugging.

Parliamentary and legal references in proposed public copy must be explained on first use. Write what the proposal concerns and what it would change, then add the official identifier for traceability if useful. A bare phrase such as “tisk 201” or an implementation phrase such as “ověřené sponzorské propojení” is not acceptable reader-facing Czech. The explanation must make sense by itself and state who acted, what happened, and how it affects the promise.

## Confirmed simple period and partial-progress rule

The project uses two clearly separated assessment moments. It does not gradually penalize a promise because several weeks or months have passed.

### During an active electoral period

- A promise with no meaningful documented action remains `no-progress` (`0`).
- A meaningful, concrete, attributable step that advances a real part of the promise is `moving-towards` (`+1`), even when the whole promise is not yet complete.
- Partial delivery never qualifies as `fulfilled`; the whole promised result or exact promised conduct is required for `+2`.
- For a legislative promise, formally proposing a relevant measure is `+1`. A verified decisive substantive vote can raise the assessment to `+2` only when the voted measure would deliver the whole promise; voting for a partial measure remains `+1`.
- Incompleteness, silence after a first step, or preservation of part of an existing system does not by itself make the step negative.
- A partial measure is negative only when evidence documents an affirmative contrary step, prevention or reversal of the promise, or explicit abandonment of the remainder.
- Do not infer that a partial measure is a final replacement merely because no later step has yet appeared.

A meaningful step changes the promised amount, scope, rights, obligations, implementation, or formal legislative path in the promised direction. General rhetoric, speculation, unrelated preparation, or a cosmetic reference is not enough. Where a promise needs a promise-specific boundary, record a short `progressTest` before assessing evidence rather than inventing the boundary afterward.

### One-time closing audit

At the end of the electoral period, the project performs one closing audit rather than applying monthly waiting rules:

- a promise untouched for the entire period changes from `no-progress` (`0`) to `moving-against` (`-1`);
- a meaningful but incomplete partial step remains `moving-towards` (`+1`);
- a completely achieved promise remains `fulfilled` (`+2`);
- documented contrary or definitive contrary conduct remains `-1` or `-2` under the ordinary rules.

An earlier closing point exists only when the original promise itself contains an explicit deadline or one-time event and the evidence package documents that it has closed. Assessors must never invent an implicit deadline or decide that the project has simply waited long enough.

Every evidence package declares `assessmentContext.mode` as either `live` or `closing-audit`. Models do not choose the mode.

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

A Chamber vote establishes positive or negative party conduct only when more than half of all members of its parliamentary group at the vote time cast the same `yes` or `no` choice.

- The threshold is `floor(eligible group members / 2) + 1`.
- A strict-majority `yes` establishes party support for the motion.
- A strict-majority `no` establishes party opposition to the motion.
- Abstentions, registered non-votes, absences, excuses, and members who had not yet taken the oath remain in the denominator and are retained for display.
- At a verified decisive vote on a motion that directly and materially advances the party's own promise, failure to provide a strict-majority `yes` is a concrete failure to support the promise and is normally `moving-against` (`-1`). This includes a split vote, abstention, non-voting, or absence that leaves the party below the threshold.
- For example, a seven-member group needs four `yes` votes. `3 yes`, `0 no`, and `4 absent` does not establish party support and is a `-1` candidate when the motion is a verified direct opportunity to advance its own promise.
- Voided votes and manual or technically incomplete votes do not establish a party position from individual-vote data.
- A numerical majority is not enough when the exact motion or legislative context is unresolved. The official vote must be linked to a documented decisive context before it can enter an assessment package as verified party conduct.
- The author or sponsor of the bill is irrelevant to vote attribution. A tracked party's verified vote is its conduct even when another party, the government, or another authorized proposer introduced the bill.
- A strict-majority `yes` at a verified decisive substantive vote is `+2` when the motion itself would fully deliver the legislative promise. This measures whether the party performed its part; the motion does not have to receive enough votes from other parties to pass.
- A strict-majority `no` at that same kind of direct opportunity is an `acting-against` (`-2`) candidate. Failure to reach either strict majority remains the confirmed `-1` candidate described above.

This rule does not infer what a motion means. Whether a `yes`, `no`, or failure to provide a majority supports or contradicts a promise depends on the exact motion and is decided later from the bounded evidence package.

### Confirmed pre-vote evidence

`No-progress` does not mean “no roll-call vote has occurred yet.” It means that no significant concrete evidence exists in either direction.

- A verified, attributable announcement that the party will vote for a measure directly advancing its promise can establish `moving-towards` (`+1`) before the vote.
- Formally submitting a measure that materially advances the promise can likewise establish `moving-towards` (`+1`). The tracked party does not have to be the author for its later vote to count.
- A verified, attributable announcement that the party will vote against such a measure can establish `moving-against` (`-1`) before the vote.
- A news report may surface the announcement, but the quoted position and party attribution must be verifiable. Speculation about likely voting behavior is not enough.
- The later roll-call vote is stronger evidence. It confirms, contradicts, or supersedes the announced intention while the earlier evidence remains in history.

Examples recorded in the conversations:

- A party announces that it will accept an outcome contrary to its promise: typically `-1`.
- It then votes for a definitive contrary budget or measure: potentially `-2`.
- It proposes a concrete measure supporting the promised result: `+1`.
- It gives strict-majority support at the decisive substantive vote on a measure that would deliver the whole legislative promise: `+2`, even if the measure was introduced elsewhere or ultimately lacks enough votes from other parties.
- For a non-legislative outcome promise, the promised measurable result actually occurs: `+2`.
- “We will never vote for this law,” followed by a vote for it: `-2`, because the promised behavior itself was violated.

## Working classification of promise types

Classifying a promise helps determine whether a vote is merely progress or the promised result itself:

- **Outcome promise** — promises a measurable final state. Outside a legislative path, the final state is required for `+2`. When the promise is to secure a legal change, the party's verified decisive support for a measure that would fully deliver it can itself be `+2` under the confirmed party-fidelity rule.
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
- How should unusual explicit-deadline promises be represented when the source wording leaves the closing event ambiguous?
- When mixed actions exist, what precise rule determines when the worse interim assessment applies?
- What minimum evidence package is required for each status, especially `+2` and `-2`?
