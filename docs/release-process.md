# Release process

This document describes the confirmed release policy and its server-side implementation.

## Confirmed decisions

- Evidence collection, assessment, review, merge, and deployment must run on server-side services. The project must not depend on an owner's computer or an active local session.
- Automated political assessments remain unpublished until the project owner explicitly approves them.
- A review request must identify the pull request and its exact current head revision.
- The owner's approval applies only to the revision presented for review. The release controller stores that revision internally; the owner never needs to type a commit hash.
- If the pull request changes after approval, the approval is invalid. A new ready-for-owner-approval comment is required after the changed head passes deterministic gates; it does not create a third AI review wave.
- A pull request may be merged only after the `Verify pull request` workflow succeeds for its exact current head revision.
- Every pull request has at most two **shared** AI review waves, not two waves per reviewer. Each shared wave requests GitHub Copilot code review and Codex review once for the same exact head revision. The first wave reviews a locally validated ready head. If it has no findings, its head is ready for owner approval after verification. If it has findings, handle every finding and make one consolidated first-wave remediation commit for all valid fixes before the second wave. Run the second wave after all first-wave findings are disposed, even if the first-wave disposition did not change the head. If the second wave has no findings, its head is ready for owner approval after verification. If it has findings, a final remediation commit may contain only direct fixes for valid cited second-wave findings and does not receive a third AI review. Owner feedback after wave two may be handled by the same resolver only when it stays within the reviewed scope and receives deterministic revalidation, never a third AI review.
- Every AI finding must be evaluated against the code and canonical documentation rather than accepted automatically. Answer non-applicable findings with a concise evidence-based reason. Reply to and resolve each addressable review thread after handling it. Record the disposition of summary-only or suppressed findings in the pull-request conversation. Before owner approval, all addressable review threads must be resolved and `Verify pull request` must pass for the exact current head: the first-wave head when it had no findings, the second-wave head when it had no findings, or the final remediation head after second-wave fixes. A scope expansion or newly discovered material issue must move to a new pull request, rather than being added to the unreviewed final remediation. These reviews are advisory quality gates and do not replace owner approval.
- AI review credits are a constrained resource. Run local validation before the first review wave, gather all available first-wave findings, and make one consolidated fix rather than triggering paid reviews after each small edit. Automatic Codex review is disabled. The release controller alone requests Copilot and Codex, once per shared wave, after checking durable per-PR state and the pull-request timeline. No PR event, draft-state change, later commit, or owner feedback is itself a review trigger.
- A successful merge into `main` is the release boundary and must be followed by deployment.
- The individual pull-request conversation must report whether merge and deployment succeeded or failed.
- Reviewer-facing technical detail may be precise, but any text proposed for the public website must use plain Czech and explain unfamiliar references.
- Cloudflare Workers is the production deployment target before a final domain is selected. The server runtime preserves the live collection-status endpoint used by the site.
- Cloudflare watches only `main` for production deployments. No non-production trigger is configured, so unpublished review proposals cannot become public through a branch preview.
- Cloudflare runs `npm run build` and then `npx wrangler deploy --config wrangler.deploy.jsonc`. A failed test, validation, build, or deployment keeps the previous production version live.

## Operational role boundaries

These roles handle repository quality and release only. They do not collect evidence, assess a political promise, or approve publication of a political assessment.

| Role | Owns | Must not do |
|---|---|---|
| PR author | Delivers one scoped, locally validated change and explicitly marks its head ready for review. | Request reviewers, interpret findings, approve, merge, or expand final remediation. |
| PR quality reviewers | GitHub Copilot and Codex inspect one requested exact head and report technical findings. | Edit the branch, merge, replace owner approval, or determine a political score. |
| Release controller | `slibychyby-release-control[bot]` persists per-PR state, owns the shared wave counter, requests permitted reviewer pairs, recognizes owner approval or feedback, verifies gates, and performs the permitted merge. | Edit implementation, interpret findings or feedback, start review from an event alone, or start review after wave two. |
| Feedback resolver | Exactly one server-side cloud task for one PR at a time. It evaluates reviewer findings and owner feedback, makes permitted remediation commits, replies, and resolves addressable threads. | Request reviewers, merge, change release state, add unrelated scope, or run concurrently with another resolver for the same PR. |
| CI verifier | Runs required tests, build, and deployment-package validation for an exact head. | Approve, merge, or deploy a non-`main` revision to production. |
| Deployer | Builds and deploys a successful `main` revision to Cloudflare Workers. | Deploy an unpublished branch or treat deployment as editorial approval. |
| Owner | Gives `schvaluji` or feedback in the individual GitHub pull-request conversation. | Delegate approval implicitly to an automated reviewer or merge. |

## Required approval flow

1. The PR author explicitly marks a locally validated head ready. The release controller records the head and starts shared wave one. Opening a PR, marking a draft ready, pushing a commit, or an owner comment does not independently start AI review.
2. Automatic Codex review is disabled. The release controller, not the PR author or feedback resolver, requests GitHub Copilot as a reviewer and posts one `@codex review` comment for each permitted shared wave.
3. If a wave has findings, the controller starts one feedback-resolver task for that PR and waits for it to dispose of every addressable thread. The resolver's consolidated remediation is the only permitted implementation change between waves. The controller starts wave two only after the first resolver task is complete. After wave two, it never starts another AI review.
4. When the applicable review path is complete, the current head has successful verification, and no addressable review thread remains unresolved, the controller stores that head and posts one ready-for-owner-approval comment mentioning `@orik007`. GitHub Mobile sends the owner a notification that opens this individual PR.
5. The owner replies exactly `schvaluji` to that active comment to approve. Any other owner comment is feedback. The controller returns feedback to the single resolver task, does not merge, and posts a new ready comment only after resolver work and deterministic verification finish. Owner feedback after wave two does not restart AI review.
6. Before merging, the controller verifies the stored head is still current, verification still succeeds, and no addressable review thread is open. It rejects stale approval rather than merging.
7. Cloudflare Workers Builds automatically builds and deploys merged `main`. The controller reports merge and deployment success or failure in the same PR.

## Current operational state

The first repository-triggered production deployment completed successfully on 2026-09-03 after pull request 11 was approved and merged. Cloudflare built the exact `main` merge commit and the public Worker responded successfully, including the server-rendered collection-status endpoint. This verifies the merge-to-deployment path.

The earlier ChatGPT Sites demo is currently still available. This is operational state, not an active fallback or retention rule; its removal timing remains open.

Codex automatic review was disabled on 2026-09-07 after duplicate trigger activity consumed review credits. The earlier shared ChatGPT approval conversation and experimental per-PR cloud task record are not part of the required release path.

The GitHub App, signed webhook receiver, durable per-PR controller state, resolver dispatch, GitHub Mobile ready comment, and deployment-result reporting specified here are required target infrastructure. They are not yet deployed; until then, no agent may claim that owner feedback is automatically being read or handled.

## Open questions

- Which public product name and custom domain will replace the temporary hosting addresses.
- When the earlier ChatGPT Sites demo should be removed.
- Which precise Cloudflare webhook or status-check event will provide final deployment confirmation to the release controller.
