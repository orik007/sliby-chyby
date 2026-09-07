# Release process

This document describes the confirmed release policy and its server-side implementation.

## Confirmed decisions

- Evidence collection, assessment, review, merge, and deployment must run on server-side services. The project must not depend on an owner's computer or an active local session.
- Automated political assessments remain unpublished until the project owner explicitly approves them.
- A review request must identify the pull request and its exact current head revision.
- The owner's approval applies only to the revision presented for review.
- If the pull request changes after approval, the approval is invalid and a new review is required.
- A pull request may be merged only after the `Verify pull request` workflow succeeds for its exact current head revision.
- Every pull request has at most two **shared** AI review waves, not two waves per reviewer. Each shared wave requests GitHub Copilot code review and Codex review once for the same exact head revision. The first wave reviews a locally validated ready head. If it has no findings, its head is ready for owner approval after verification. If it has findings, handle every finding and make one consolidated first-wave remediation commit for all valid fixes before the second wave. Run the second wave after all first-wave findings are disposed, even if the first-wave disposition did not change the head. If the second wave has no findings, its head is ready for owner approval after verification. If it has findings, a final remediation commit may contain only direct fixes for valid cited second-wave findings and does not receive a third AI review.
- Every AI finding must be evaluated against the code and canonical documentation rather than accepted automatically. Answer non-applicable findings with a concise evidence-based reason. Reply to and resolve each addressable review thread after handling it. Record the disposition of summary-only or suppressed findings in the pull-request conversation. Before owner approval, all addressable review threads must be resolved and `Verify pull request` must pass for the exact current head: the first-wave head when it had no findings, the second-wave head when it had no findings, or the final remediation head after second-wave fixes. A scope expansion or newly discovered material issue must move to a new pull request, rather than being added to the unreviewed final remediation. These reviews are advisory quality gates and do not replace owner approval.
- AI review credits are a constrained resource. Run local validation before the first review wave, gather all available first-wave findings, and make one consolidated fix rather than triggering paid reviews after each small edit. Automatic Codex review is disabled. The central review coordinator alone requests Copilot and Codex, once per shared wave, after checking the pull-request timeline and the per-PR task state. No PR event, draft-state change, or later commit is itself a review trigger.
- A successful merge into `main` is the release boundary and must be followed by deployment.
- The approval conversation must report whether merge and deployment succeeded or failed.
- Reviewer-facing technical detail may be precise, but any text proposed for the public website must use plain Czech and explain unfamiliar references.
- Cloudflare Workers is the production deployment target before a final domain is selected. The server runtime preserves the live collection-status endpoint used by the site.
- Cloudflare watches only `main` for production deployments. No non-production trigger is configured, so unpublished review proposals cannot become public through a branch preview.
- Cloudflare runs `npm run build` and then `npx wrangler deploy --config wrangler.deploy.jsonc`. A failed test, validation, build, or deployment keeps the previous production version live.

## Operational role boundaries

These roles handle repository quality and release only. They do not collect evidence, assess a political promise, or approve publication of a political assessment.

| Role | Owns | Must not do |
|---|---|---|
| PR author | Delivers a locally validated, scoped change and declares the head ready for review. | Request reviewers, approve, merge, or expand a final-remediation commit. |
| PR quality reviewers | GitHub Copilot and Codex inspect the exact pull-request head and report technical findings. | Merge, replace owner approval, or determine a political score. |
| Review coordinator | The server-side coordinator creates or reuses the dedicated per-PR mobile task, owns the two shared review-wave counter, and initiates each permitted Copilot and Codex request exactly once. | Edit the implementation, start a reviewer from a PR event alone, or start any review after wave two. |
| Feedback resolver | Evaluates review findings against canonical documentation, makes the permitted consolidated remediation commit, replies, and resolves addressable threads. | Request reviewers, merge, or add unrelated scope to final remediation. |
| Approval coordinator | The dedicated cloud mobile task verifies the exact head and checks, presents it to the owner, and after explicit approval performs the merge. | Start an unbounded new review wave, treat a generic acknowledgement as approval, or merge without the owner's explicit approval for the presented head. |
| CI verifier | Runs the required tests, build, and deployment-package validation for the exact head. | Approve, merge, or deploy a non-`main` revision to production. |
| Deployer | Builds and deploys a successful `main` revision to Cloudflare Workers. | Deploy an unpublished review branch or treat deployment as editorial approval. |
| Owner | Gives or withholds explicit approval for the exact reviewed pull-request head. | Delegate that approval implicitly to an automated reviewer or merge. |

## Required approval flow

- GitHub pull-request activity reaches a server-side dispatcher. The dispatcher creates or reuses one dedicated cloud mobile task for that pull request; the shared dispatcher conversation posts only the task link.
- Automatic Codex review is disabled. The review coordinator, not the PR author or feedback resolver, requests GitHub Copilot as a reviewer and posts one `@codex review` comment for each permitted shared wave.
- The dedicated approval task waits for the applicable completed review wave for the last reviewed head, no unresolved addressable review threads, and successful verification for the exact current head. That current head is the first-wave head with no findings, the second-wave head with no findings, or the unreviewed final remediation head after second-wave fixes.
- The dedicated task presents a plain-language summary, links to the pull request, records the exact head revision, and asks for either `schvaluji` or specific feedback.
- After `schvaluji`, the connected GitHub app verifies the unchanged revision and required checks before merging.
- Cloudflare Workers Builds automatically builds and deploys the merged `main` revision.
- The approval conversation reports the merge result. Deployment confirmation in that conversation remains to be connected to the Cloudflare result.

## Current operational state

The first repository-triggered production deployment completed successfully on 2026-09-03 after pull request 11 was approved and merged. Cloudflare built the exact `main` merge commit and the public Worker responded successfully, including the server-rendered collection-status endpoint. This verifies the merge-to-deployment path. It does not resolve the open callback from Cloudflare into the mobile approval conversation.

The earlier ChatGPT Sites demo is currently still available. This is operational state, not an active fallback or retention rule; its removal timing remains open.

Codex automatic review was disabled on 2026-09-07 after duplicate trigger activity consumed review credits. A dedicated cloud task was created for pull request 19 as the first per-PR mobile audit record. Creating a dedicated task automatically from every future inbound GitHub event remains to be verified with the next pull request; until that verification, the server-side dispatcher must create or reuse it before it starts a review wave.

## Open questions

- Which public product name and custom domain will replace the temporary hosting addresses.
- When the earlier ChatGPT Sites demo should be removed.
- How the approval conversation should receive and report the final Cloudflare Workers deployment result automatically.
