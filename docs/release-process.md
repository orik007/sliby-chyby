# Release process

This document separates the confirmed release policy from the automation that is still being tested.

## Confirmed decisions

- Evidence collection, assessment, review, merge, and deployment must run on server-side services. The project must not depend on an owner's computer or an active local session.
- Automated political assessments remain unpublished until the project owner explicitly approves them.
- A review request must identify the pull request and its exact current head revision.
- The owner's approval applies only to the revision presented for review.
- If the pull request changes after approval, the approval is invalid and a new review is required.
- A pull request may be merged only after the `Verify pull request` workflow succeeds for its exact current head revision.
- A successful merge into `main` is the release boundary and must be followed by deployment.
- The approval conversation must report whether merge and deployment succeeded or failed.
- Reviewer-facing technical detail may be precise, but any text proposed for the public website must use plain Czech and explain unfamiliar references.

## Working proposal under test

- GitHub pull-request activity wakes a cloud ChatGPT approval conversation available on mobile.
- The conversation presents a plain-language summary, links to the pull request, records the exact head revision, and asks for either `schvaluji` or specific feedback.
- After `schvaluji`, the connected GitHub app verifies the unchanged revision and required checks before merging.
- The deployment mechanism publishes the merged `main` revision and returns the public URL to the same conversation.

## Open questions

- Whether the current Sites hosting can provide the permanent server-side deployment step directly after every GitHub merge.
- Which hosting and domain will be used for the final public production release.
