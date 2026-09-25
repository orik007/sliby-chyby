# SLAVA Index

## Authority

This is the only operational definition of the SLAVA Index, the aggregate of a party's promise scores. It is a **confirmed decision**. How one promise is scored is defined only in [scoring.md](scoring.md).

## Which promises count

The index of a party includes every one of its `confirmed` promises, which are exactly the promises shown on the public site ([promise-selection.md](promise-selection.md)). Candidate and rejected promises never count. Each counts with its current score, including `0`.

## Calculation

For a party with current scores `s₁ … sₙ`:

```text
SLAVA Index = round(sum(sᵢ) / (2 × n) × 100)
```

It ranges from `−100` to `+100` and is shown as index points without a percent sign. If a party has no confirmed promises, the index is unavailable.

## Derivation

The index is derived, never stored as an editable value. It is recalculated from every confirmed promise whenever public promise data or a current score revision changes.
