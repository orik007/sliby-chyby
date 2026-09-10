# Data model

## Authority

This document defines storage relationships and validation boundaries. It does not define promise lifecycle, scores, or evidence decisions; use the canonical documents linked from [project-guide.md](project-guide.md).

## Confirmed invariants

- A promise belongs to one party in one electoral period. Repeated wording in a later period is a new promise.
- Only confirmed promises exist in `data/` and are rendered publicly.
- Every confirmed promise has a current score revision, initially `0`.
- Score revisions are append-only. The latest revision is current.
- Every revision references traceable source records. The SLAVA Index is derived, not stored as an editable value.
- Candidate and rejected campaign occurrences remain in `research/`, including their reasons and source locators.

## File model

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

`Promise` contains exact original wording, party-period, primary source, locator, and matching information. `AssessmentRevision` contains one score, public Czech explanation, date, cited source IDs, methodology identity, and audit identity. Initial `0` revisions cite the promise source; later revisions cite conduct evidence.

## Research audit

The research record for an occurrence stores its `candidate`, `confirmed`, or `rejected` outcome, the reason where rejected, and resulting promise IDs where confirmed. The exact JSON layout remains an implementation detail so long as that audit remains traceable.

## Automation audit

Automated assessment artifacts retain raw model outputs separately from public data. They are audit records, not promise or score states. A successful score update must have both a public revision in `data/assessment-revisions/` and a corresponding immutable audit record.
