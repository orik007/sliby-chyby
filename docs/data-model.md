# Data model

## Confirmed invariants

- A promise belongs to one party in one electoral period. Repeated wording in a later period is a new promise.
- Only confirmed promises are in `data/` and visible publicly.
- Every confirmed promise has one current score revision. The default score is `0` when no documented assessment conclusion sets another score.
- Score revisions are append-only. The latest revision is current.
- Every revision lists traceable source records. The SLAVA Index is derived, never stored as an editable value.
- A source is one document or record. A promise references one source and an exact locator.
- Candidate and rejected promises remain in `research/`; a rejected promise has a reason.

## Files

```text
data/
  periods/
  parties/
  party-periods/
  promise-categories.json
  sources/
  promises/
  assessment-revisions/
  system-status.json
```

`Promise` stores its exact original wording, party period, primary source, and source locator. `AssessmentRevision` stores its score, public Czech explanation, date, and cited source IDs. A zero-default revision cites the promise source; when a documented assessment already establishes another score, its first revision cites that evidence directly.

`promise-categories.json` contains the controlled common policy categories and exactly one mapping for every confirmed promise. A mapping includes the original programme chapter and optional verified source-section metadata for traceability. The public interface uses only the common category label.

`research/2025-election/promises.json` contains the campaign-source catalogue and non-public promises. Its `sources` list contains one record per source document. Every research promise has a `sourceId`, a locator, exact wording, and one status: `candidate`, `confirmed`, or `rejected`.
