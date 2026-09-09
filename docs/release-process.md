# Release process

This document describes the confirmed release policy and its server-side implementation.

## Confirmed decisions

- Evidence collection, assessment, review, merge, and deployment must run on server-side services. The project must not depend on an owner's computer or an active local session.
- Automated political assessments remain unpublished until the project owner explicitly approves them.
- GitHub Copilot and Codex reviews are never initiated, requested, repeated, or awaited automatically. No pull-request event, workflow, agent, release role, commit, draft-state change, or owner-feedback event may trigger either review.
- The owner may explicitly authorize one GitHub Copilot or Codex review for an identified pull request and exact head revision. It is advisory only and is never a release gate or a substitute for owner approval.
- The owner's approval applies only to the revision presented for review. The release controller stores that revision internally; the owner never needs to type a commit hash.
- If the pull request changes after approval, the approval is invalid. A new ready-for-owner-approval comment is required after the changed head passes deterministic gates.
- A pull request may be merged only after the `Verify pull request` workflow succeeds for its exact current head revision.
- If the owner explicitly requests a review, evaluate any finding against the code and canonical documentation rather than accepting it automatically. Answer non-applicable findings with a concise evidence-based reason and handle addressable review threads. The review is optional and does not delay owner approval, verification, or release.
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
| PR author | Delivers one scoped, locally validated change and explicitly marks its head ready for owner approval. | Initiate a Copilot or Codex review without explicit owner authorization, approve, merge, or expand the approved scope. |
| Optional quality reviewer | GitHub Copilot or Codex inspects one owner-authorized exact head and reports technical findings. | Edit the branch, merge, replace owner approval, or determine a political score. |
| Release controller | `slibychyby-release-control[bot]` persists per-PR state, recognizes owner approval or feedback, verifies gates, and performs the permitted merge. | Edit implementation, interpret findings or feedback, or initiate a review. |
| Feedback resolver | Exactly one server-side cloud task for one PR at a time. It evaluates owner feedback, makes permitted remediation commits, replies, and resolves addressable threads. | Initiate a review, merge, change release state, add unrelated scope, or run concurrently with another resolver for the same PR. |
| CI verifier | Runs required tests, build, and deployment-package validation for an exact head. | Approve, merge, or deploy a non-`main` revision to production. |
| Deployer | Builds and deploys a successful `main` revision to Cloudflare Workers. | Deploy an unpublished branch or treat deployment as editorial approval. |
| Owner | Gives `schvaluji` or feedback in the individual GitHub pull-request conversation. | Delegate approval implicitly to an automated reviewer or merge. |

## Required approval flow

1. The PR author explicitly marks a locally validated head ready for owner approval. Opening a PR, marking a draft ready, pushing a commit, or an owner comment never starts a Copilot or Codex review.
2. The owner may explicitly authorize a GitHub Copilot or Codex review of one identified head. No workflow, agent, release role, or other automatic process may make or repeat that request.
3. The current head must pass deterministic verification before the release controller stores it and posts one ready-for-owner-approval comment mentioning `@orik007`. GitHub Mobile sends the owner a notification that opens this individual PR.
4. The owner replies exactly `schvaluji` to that active comment to approve. Any other owner comment is feedback. The controller returns feedback to the single resolver task, does not merge, and posts a new ready comment only after resolver work and deterministic verification finish.
5. Before merging, the controller verifies the stored head is still current and verification still succeeds. It rejects stale approval rather than merging.
6. Cloudflare Workers Builds automatically builds and deploys merged `main`. The controller reports merge and deployment success or failure in the same PR.

## Current operational state

The first repository-triggered production deployment completed successfully on 2026-09-03 after pull request 11 was approved and merged. Cloudflare built the exact `main` merge commit and the public Worker responded successfully, including the server-rendered collection-status endpoint. This verifies the merge-to-deployment path.

The earlier ChatGPT Sites demo is currently still available. This is operational state, not an active fallback or retention rule; its removal timing remains open.

No GitHub Copilot or Codex review is automatic or required. A review may occur only after the owner explicitly authorizes it for a specific pull request and revision. The earlier shared ChatGPT approval conversation and experimental per-PR cloud task record are not part of the required release path.

The GitHub App, signed webhook receiver, durable per-PR controller state, resolver dispatch, GitHub Mobile ready comment, and deployment-result reporting specified here are required target infrastructure. They are not yet deployed; until then, no agent may claim that owner feedback is automatically being read or handled.

## Open questions

- Which public product name and custom domain will replace the temporary hosting addresses.
- When the earlier ChatGPT Sites demo should be removed.
- Which precise Cloudflare webhook or status-check event will provide final deployment confirmation to the release controller.
