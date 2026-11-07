# SLAVA Index

## Authority

This is the only operational definition of the SLAVA Index, the aggregate of a party's promise scores. It is a **confirmed decision**. How one promise is scored is defined only in [scoring.md](scoring.md).

## Which promises count

The index of a party includes every one of its promises (`kind` `promise`), which are exactly the promises scored on the public site ([promise-selection.md](promise-selection.md)). Statements and rejected occurrences never count. Each promise counts with its current score, including `0`.

## Calculation

For a party with current scores `s₁ … sₙ`:

```text
SLAVA Index = round(sum(sᵢ) / (2 × n) × 100)
```

It ranges from `−100` to `+100` and is shown as index points without a percent sign. If a party has no promises, the index is unavailable.

## Positive and negative parts

The scale of the index also shows its two parts, each on the same scale and rounded the same way: the positive part from the promises' positive scores alone, `round(sum(sᵢ > 0) / (2 × n) × 100)`, and the negative part from their negative scores alone. A part that rounds to `0` is not shown. The parts are rounded separately, so their sum can differ from the index by one point; the index itself is always calculated as above.

## Derivation

The index is derived, never stored as an editable value. It is recalculated from every promise whenever public promise data or a current score revision changes.
