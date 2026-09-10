# Data model

## Confirmed invariants

- A promise belongs to one party in one electoral period. Repeated wording in a later period is a new promise.
- Only confirmed promises are in `data/` and visible publicly.
- Every confirmed promise has one current score revision; its first score is `0`.
- Score revisions are append-only. The latest revision is current.
- Every revision lists traceable source records. The SLAVA Index is derived, never stored as an editable value.
- Campaign-source occurrences outside the public catalogue are `candidate` or `rejected` and remain in `research/` with source locators; a rejection also has a reason.

## Files

```text
data/
  periods/
  parties/
  party-periods/
  sources/
  promises/
  assessment-revisions/
  system-status.json
```

`Promise` stores its exact original wording, party period, and primary source. `AssessmentRevision` stores its score, public Czech explanation, date, and cited source IDs. An initial zero revision cites the promise source; a later revision cites the relevant evidence.
