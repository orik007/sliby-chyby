# Release process

This document describes the confirmed release policy and its server-side implementation.

## Confirmed decisions

- Evidence collection, assessment, review, merge, and deployment must run on server-side services. The project must not depend on an owner's computer or an active local session.
- Automated political assessments remain unpublished until the project owner explicitly approves them.
- A review request must identify the pull request and its exact current head revision.
- The owner's approval applies only to the revision presented for review.
- If the pull request changes after approval, the approval is invalid and a new review is required.
- A pull request may be merged only after the `Verify pull request` workflow succeeds for its exact current head revision.
- Every pull request has at most two AI review waves. Each wave requires both GitHub Copilot code review and Codex review for its exact head revision. The first wave reviews a locally validated ready head. If it has no findings, its head is ready for owner approval after verification. If it has findings, handle every finding and make one consolidated first-wave remediation commit for all valid fixes before the second wave. Run the second wave after all first-wave findings are disposed, even if the first-wave disposition did not change the head. If the second wave has no findings, its head is ready for owner approval after verification. If it has findings, a final remediation commit may contain only direct fixes for valid cited second-wave findings and does not receive a third AI review.
- Every AI finding must be evaluated against the code and canonical documentation rather than accepted automatically. Answer non-applicable findings with a concise evidence-based reason. Reply to and resolve each addressable review thread after handling it. Record the disposition of summary-only or suppressed findings in the pull-request conversation. Before owner approval, all addressable review threads must be resolved and `Verify pull request` must pass for the exact current head: the first-wave head when it had no findings, the second-wave head when it had no findings, or the final remediation head after second-wave fixes. A scope expansion or newly discovered material issue must move to a new pull request, rather than being added to the unreviewed final remediation. These reviews are advisory quality gates and do not replace owner approval.
- AI review credits are a constrained resource. Run local validation before the first review wave, gather all available first-wave findings, and make one consolidated fix rather than triggering paid reviews after each small edit. Do not request Copilot or Codex again for an unchanged head except for the required second wave after the first wave produced findings but all were non-applicable. Before manually requesting Copilot, confirm that no automatic review for the exact head is already pending or complete; after a changed head, request only the review that was not automatically triggered.
- A successful merge into `main` is the release boundary and must be followed by deployment.
- The approval conversation must report whether merge and deployment succeeded or failed.
- Reviewer-facing technical detail may be precise, but any text proposed for the public website must use plain Czech and explain unfamiliar references.
- Cloudflare Workers is the production deployment target before a final domain is selected. The server runtime preserves the live collection-status endpoint used by the site.
- Cloudflare watches only `main` for production deployments. No non-production trigger is configured, so unpublished review proposals cannot become public through a branch preview.
- Cloudflare runs `npm run build` and then `npx wrangler deploy --config wrangler.deploy.jsonc`. A failed test, validation, build, or deployment keeps the previous production version live.

## Implemented approval flow

- GitHub pull-request activity wakes a cloud ChatGPT approval conversation available on mobile.
- The process requests GitHub Copilot as a reviewer; a plain `@copilot` comment is not used as a substitute for the code-review request. Codex review is automatic on pull-request opening and can be requested again with `@codex review` for the second wave when the first wave produced findings.
- The approval conversation waits for the applicable completed review wave, no unresolved addressable review threads, and successful verification for the exact current head: the first-wave head with no findings, the second-wave head with no findings, or the unreviewed final remediation head after second-wave fixes.
- The conversation presents a plain-language summary, links to the pull request, records the exact head revision, and asks for either `schvaluji` or specific feedback.
- After `schvaluji`, the connected GitHub app verifies the unchanged revision and required checks before merging.
- Cloudflare Workers Builds automatically builds and deploys the merged `main` revision.
- The approval conversation reports the merge result. Deployment confirmation in that conversation remains to be connected to the Cloudflare result.

## Current operational state

The first repository-triggered production deployment completed successfully on 2026-09-03 after pull request 11 was approved and merged. Cloudflare built the exact `main` merge commit and the public Worker responded successfully, including the server-rendered collection-status endpoint. This verifies the merge-to-deployment path. It does not resolve the open callback from Cloudflare into the mobile approval conversation.

The earlier ChatGPT Sites demo is currently still available. This is operational state, not an active fallback or retention rule; its removal timing remains open.

## Open questions

- Which public product name and custom domain will replace the temporary hosting addresses.
- When the earlier ChatGPT Sites demo should be removed.
- How the approval conversation should receive and report the final Cloudflare Workers deployment result automatically.
