# Scoring

## Authority

This is the only operational definition of score values and the SLAVA Index. It is a **confirmed decision**. Promise lifecycle is defined only in [promise-selection.md](promise-selection.md).

## Current score

Every promise has one current numerical score. The default is `0`, except for a documented maintenance baseline as defined below. The score may change whenever new attributable evidence justifies it; it is not a lifecycle state and it does not decide whether a promise is public.

| Score | Public label | Meaning |
| ---: | --- | --- |
| `+2` | Splněno | The whole promised result or exact promised conduct occurred. |
| `+1` | Směřuje ke splnění | A meaningful concrete step advances a real part of the promise, or a documented maintenance baseline remains in force under the responsible party or government. |
| `0` | Zatím bez ověřeného podstatného posunu | No documented meaningful movement in either direction. |
| `-1` | Směřuje proti slibu | Documented conduct moves against the promise, or a verified direct decisive opportunity to support the exact promise was missed under the vote rule. |
| `-2` | Jedná proti slibu | A significant direct violation, definitive contrary result, or exact opposite conduct occurred. |

During a live electoral period, elapsed time alone does not change `0`.

## Maintenance commitments

A maintenance commitment is a promise that the party or its government will not itself make one clearly identified change. Its fulfillment consists of preserving an already observable state.

Classify a promise as a maintenance commitment only when all of these are true:

1. the exact wording is a commitment to refrain from a specific change, not a commitment to stop, abolish, prevent, or otherwise actively change something;
2. the state to be preserved exists when the party or its government assumes responsibility; and
3. the responsible party or government has the power to make the identified change.

A documented maintenance baseline is `+1` when the preserved state holds at the point of responsibility. Its public explanation states that the state promised to be preserved currently remains in force. It is not `+2`: full fulfillment requires the end of the relevant electoral period with that state preserved, or another complete and attributable fulfillment of the exact promise.

Do not infer a maintenance commitment merely from a negative word, and do not award `+1` for elapsed time alone. Commitments such as “we will stop”, “we will abolish”, or “we will prevent” require a documented active step and otherwise remain at `0`.

Example: “Zavazujeme se, že naše vláda nepřijme euro ani nepodnikne žádné kroky směrem k jeho zavedení.” is a maintenance commitment. If the Czech Republic has not adopted the euro when the responsible government takes office and it does not take an adoption step, the current state may be recorded as `+1` with the explanation: “Stav, který slib zachovává, zatím trvá.” It becomes `+2` only after the relevant period ends with that state preserved.

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

## Audit

Assessment revisions are append-only and list their cited evidence source IDs. An automated assessment is only an unpublished human-review proposal; it is not a score state and cannot change public data. Its audit retains active prompt and model identifiers, evidence identifiers, confidence, and the changed-input fingerprint.
