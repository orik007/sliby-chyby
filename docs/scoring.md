# Scoring

## Authority

This is the only operational definition of score values and the SLAVA Index. It is a **confirmed decision**. Promise lifecycle is defined only in [promise-selection.md](promise-selection.md).

## Current score

Every promise has one current numerical score. The default is `0`. The score may change whenever new attributable evidence justifies it; it is not a lifecycle state and it does not decide whether a promise is public.

| Score | Public label | Meaning |
| ---: | --- | --- |
| `+2` | Splněno | The whole promised result or exact promised conduct occurred. |
| `+1` | Směřuje ke splnění | A meaningful concrete step advances a real part of the promise. |
| `0` | Zatím bez ověřeného podstatného posunu | No documented meaningful movement in either direction. |
| `-1` | Směřuje proti slibu | Documented conduct moves against the promise, or a verified direct decisive opportunity to support the exact promise was missed under the vote rule. |
| `-2` | Jedná proti slibu | A significant direct violation, definitive contrary result, or exact opposite conduct occurred. |

During a live electoral period, elapsed time alone does not change `0`.

## Decision order

For each changed evidence package, apply this order:

1. Establish the relevant facts from supplied, traceable evidence.
2. Establish whether the party's conduct is attributable under the applicable rule.
3. Compare that conduct with the exact promise, without making the promise more specific.
4. Choose the single score that best describes the current position.
5. Record a new immutable revision when the current score or its explanation changes.

Contradictory evidence stays in the audit. Evidence items are not separately scored and are never averaged. If the package cannot support a fair conclusion, retain the current score unchanged; that lack of conclusion is not a score status.

## Party votes

For a Chamber vote, attribute party conduct only when the vote is a verified decisive substantive motion on the promise and a strict majority of the party's parliamentary-group members at the date of that vote made the relevant choice. Bill authorship, current membership, and an unresolved motion are not party conduct.

## SLAVA Index

Only `confirmed` promises enter the index. For a party with current scores `s₁ … sₙ`:

```text
SLAVA Index = round(sum(sᵢ) / (2 × n) × 100)
```

It ranges from `−100` to `+100` and is shown as index points without a percent sign. Recalculate it from every confirmed promise whenever public promise data or a current score revision changes. If a party has no confirmed promises, the index is unavailable.

## Record

Assessment revisions are append-only and list their cited evidence source IDs. No separate candidate score, unassessed score, or human-review state exists.
