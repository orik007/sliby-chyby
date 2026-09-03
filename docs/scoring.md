# SLAVA Index methodology

## Status and authority

The five-state scale, aggregate formula, live-period rule, closing audit, and party-vote rule in this document are **confirmed decisions**. This is the canonical operational scoring reference. [`docs/decisions.md`](decisions.md) records why decisions were made; it is not a second scoring checklist. The active assessor prompt must implement the decision order below without adding policy.

Promise admission is governed separately by [promise-selection.md](promise-selection.md). A rejected or unreviewed candidate is not assigned `0` and does not enter the index denominator.

## Purpose

The **SLAVA Index** measures whether a party's conduct matches its own pre-election promises. It does not judge whether a policy is good, and it is not the percentage of a programme already completed. The name is written without diacritics and the result is displayed as index points, for example `SLAVA Index: +14`.

## The five states

| Score | Internal status | Meaning |
|---:|---|---|
| `-2` | `acting-against` | The party performed a significant act that directly violated the promise, caused a definitive contrary result, or performed the exact conduct it promised not to perform. |
| `-1` | `moving-against` | A concrete intention, proposal, vote, missed direct voting opportunity, abandonment, or other step points against the promise, without necessarily creating the definitive contrary result. |
| `0` | `no-progress` | During a live period, no significant documented movement exists in either direction. |
| `+1` | `moving-towards` | A concrete, attributable, verifiable step advances all or a real part of the promise, but the whole result or exact promised conduct has not yet been completed. |
| `+2` | `fulfilled` | The whole promised result occurred, the party performed the exact promised conduct, or the full-measure legislative vote rule below applies. |

The English names are internal values. Public copy must express the meaning in natural Czech and must never expose these values or other project labels.

## Canonical decision order

Every assessment follows these five steps. Later sections clarify a step but do not create a second decision path.

### 1. Use the supplied assessment moment

Read `assessmentContext.mode`; an assessor never chooses it from elapsed time.

- In `live` mode, inactivity stays `0`. Silence, elapsed months, incomplete progress, or the absence of a later step is not negative by itself.
- In `closing-audit` mode, a promise untouched throughout the electoral period becomes `-1`. Meaningful incomplete progress remains `+1`.
- Close earlier only when the original promise contains an explicit deadline or one-time event and supplied evidence shows that it has closed. Never invent a waiting period.

The ordinary pipeline currently emits only `live` packages. The one-time period-closing audit is a separate future workflow.

### 2. Verify relevance, attribution, and proof

Use evidence only when it is materially relevant to the exact promise and fairly attributable:

- a verified party proposal or vote is party conduct; a vote counts regardless of who introduced the bill;
- a government action is only an attribution candidate until other evidence connects it to the party;
- an official party publication proves publication, not automatically an adopted position or the truth of a claimed event; only explicit party or parliamentary-group wording can establish a directional intention;
- an interview or third-party statement does not become a party position merely because a party site republishes it;
- official print excerpts show proposal content, not authorship, passage, legal effect, or real-world outcome.

Prefer the underlying official record for votes, bills, laws, budgets, government resolutions, ministerial decisions, and outcomes. News sources are primarily for discovery and context. A strong `+2` or `-2` should normally have primary evidence; several articles repeating one report do not become independent proof.

If a material fact, exact proposal effect, or party link is unresolved, mark the evidence insufficient instead of filling the gap.

### 3. Identify phase, direction, and completeness

Distinguish intention, formal proposal, vote, adopted measure, and real-world outcome. Then decide whether the event advances or contradicts the whole promise, a real part of it, or neither.

A meaningful step changes the promised amount, scope, rights, obligations, implementation, or formal legislative path. General rhetoric, speculation, unrelated preparation, or a cosmetic reference is not enough. When a promise needs a special boundary, record its short `progressTest` before assessing evidence.

- A verified concrete intention or formal proposal in the promised direction can be `+1`; an intention or step in the opposite direction can be `-1`.
- A partial measure can be `+1` but never `+2`.
- Incompleteness is not negative. A partial step becomes negative only when evidence shows contrary conduct, prevention, reversal, or explicit abandonment of the remainder.
- Do not assume that a partial measure is the final solution merely because no later action is documented.
- A later roll-call vote is stronger than an earlier voting intention and may confirm or supersede it; the earlier evidence remains in history.

### 4. Apply the party-vote rule when relevant

A Chamber vote establishes a party position only when more than half of all members of its parliamentary group at the vote time cast the same `yes` or `no` choice. The threshold is `floor(group members / 2) + 1`. Abstentions, registered non-votes, absences, excuses, and members who had not taken the oath remain in the denominator and audit.

Apply the following results only when official evidence resolves the exact, valid, decisive substantive motion and its material effect on the promise:

| Party conduct | Full measure that would deliver the legislative promise | Partial measure |
|---|---:|---:|
| Strict-majority `yes` | `+2` | `+1` |
| Strict-majority `no` | normally `-2` | assess its actual direction under step 3 |
| Neither strict majority | normally `-1` for failing to support the party's own promise at that direct opportunity | assess under step 3; do not apply the automatic penalty |

The full-measure `+2` assesses whether the party performed its part. It applies even when another actor introduced the measure or other parties caused the overall motion to fail.

For example, a seven-member group needs four matching votes. `3 yes`, `0 no`, and `4 absent` does not establish support and is a `-1` candidate only at a verified direct full-promise opportunity.

Do not attribute a position from merely similar, procedural, ambiguous, materially mixed, voided, manual, technically incomplete, or context-unresolved votes.

### 5. Select one current state and explain it

One promise has one current assessment. Votes, articles, laws, and statements are evidence for that assessment, not separate scores. Do not average them or mechanically cancel positive and negative items. Preserve contradictory evidence and judge its significance rather than its count.

Public-facing Czech must make sense without audit context. It states who acted, what happened, what it changed, and why that affects the promise. Explain parliamentary and legal references on first use; never write an unexplained label such as “tisk 201” or an internal phrase such as “verified-party-vote”.

## Aggregate calculation

Each tracked promise contributes only its current published score. Let `N` be the number of tracked promises and `s_i` each current score:

```text
SLAVA Index = (sum(s_i) / (2 * N)) * 100
```

The range is `-100` to `+100`; the aggregate is derived and never manually stored. If `N = 0`, the index is unavailable rather than `0`. The UI omits the percent sign because the number is an index, not a completion percentage.

### Worked example

A party has 13 promises: five at `+2`, two at `-2`, three at `+1`, one at `-1`, and two at `0`. The sum is `+8`, the maximum is `26`, and `round(8 / 26 × 100)` produces a SLAVA Index of `+31`.

## Revisions and automation

The current assessment is the latest published revision. Never overwrite history silently. A revision retains the promise ID, status, plain-language explanation, evidence IDs, publication time, methodology and prompt version, assessor audit data, and material uncertainty or dissent.

Automated collection, matching, and assessment are separate stages described in [evidence-pipeline.md](evidence-pipeline.md). Two assessors use only supplied evidence. When they disagree, an arbiter may select either review or return `cannot-decide`; it may not browse or invent a third interpretation. Every model result remains an unpublished proposal until the human publication gate approves a later public revision.

## Deferred real-case rules

The five public states are the complete current scale. If a real promise cannot be assessed fairly, pause that case and revise the methodology from the concrete evidence rather than inventing a result or a new status.

The following are **working proposals**, not scoring rules:

- classify promises as outcome, process, or behavior promises when that helps identify what completion means;
- while an outcome is unresolved, significant mixed conduct may justify the worse applicable interim state rather than an average;
- a definitive outcome may supersede earlier signals, while one contrary act may irreversibly break a one-time behavior promise.

## Open questions

- If a real promise cannot be scored fairly, should it receive a new status, be withheld from publication, or use another treatment?
- How should blocked-by-others and compromise cases affect the score?
- How should unusual explicit-deadline promises be represented when the source wording leaves the closing event ambiguous?
- What exact rule should resolve materially mixed conduct?
- What minimum evidence package should be mandatory for each state, especially `+2` and `-2`?
