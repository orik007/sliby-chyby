# Unpublished assessment review proposals

This directory is a durable human-review queue for automated SLAVA assessment proposals.

- Every proposal is created from one bounded evidence package and retains the complete assessment audit.
- `manifest.json` records the assessment fingerprint used by the changed-input gate.
- A fingerprint covers assessable evidence, methodology, active prompt content, providers, and model identifiers. Volatile collection timestamps and run identifiers do not trigger repeated model calls.
- Every proposal has `humanReviewRequired: true` and `publicationApproved: false`.
- Merging a review-proposal pull request preserves the audit. It does not publish a score or change public website data.
- Published assessment revisions require a separate, explicitly approved publication workflow.

Files are grouped as `promise-id/assessment-fingerprint/`. Each group contains the exact enriched evidence package, the complete assessor and arbiter audit, and a concise proposal record.
