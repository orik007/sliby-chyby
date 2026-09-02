# Unpublished assessment review proposals

This directory is a durable human-review queue for automated SLAVA assessment proposals.

- Every proposal is created from one bounded evidence package and retains the complete assessment audit.
- `manifest.json` records the assessment fingerprint used by the changed-input gate.
- `manifest.json` is also the authority for proposal supersession. A replacement points to the previous proposal, which points back to its replacement; old audit files are never deleted or rewritten.
- A fingerprint covers assessable evidence, methodology, active prompt content, providers, and model identifiers. Volatile collection timestamps and run identifiers do not trigger repeated model calls.
- Every proposal has `humanReviewRequired: true` and `publicationApproved: false`.
- Merging a review-proposal pull request preserves the audit. It does not publish a score or change public website data.
- Published assessment revisions require a separate, explicitly approved publication workflow.

Files are grouped as `promise-id/assessment-fingerprint/`. Each group contains `review.md` as the human entry point, the exact enriched evidence package, the complete assessor and arbiter audit, and a concise machine-readable proposal record.

Every `review.md` visibly separates `Návrh pro veřejný web` from `Technické podklady pro reviewera`. The first section is the only candidate for later publication and must use self-contained, plain Czech without internal labels or unexplained identifiers. The technical section may expose canonical status values and other project terms for audit and debugging. Neither section is published by creating, reviewing, or merging the proposal.
