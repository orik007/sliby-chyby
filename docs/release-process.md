# Release process

This document describes the confirmed release policy and its deliberately simple implementation.

## Confirmed decisions

- Evidence collection, assessment, CI verification, and deployment run on server-side services. Owner approval and merging are manual GitHub pull-request actions.
- Automated political assessments remain unpublished until the project owner explicitly approves them.
- GitHub Copilot and Codex reviews are never initiated, requested, repeated, or awaited automatically. No pull-request event, workflow, agent, release role, commit, draft-state change, or owner-feedback event may trigger either review.
- The owner may explicitly authorize one GitHub Copilot or Codex review for an identified pull request and exact head revision. It is advisory only and is never a release gate or a substitute for owner approval.
- The owner's `schvaluji` approval applies only to the exact current pull-request head. The owner does not need to type a commit hash.
- If the pull request changes after approval, the approval is invalid and the owner must approve the new verified head again.
- A pull request may be merged only after the `Verify pull request` workflow succeeds for its exact current head revision.
- If the owner explicitly requests a review, evaluate any finding against the code and canonical documentation rather than accepting it automatically. Answer non-applicable findings with a concise evidence-based reason and handle addressable review threads. The review is optional and does not delay owner approval, verification, or release.
- A successful merge into `main` is the release boundary and must be followed by deployment.
- The owner checks merge and deployment status manually. No controller posts release status in the pull-request conversation.
- Reviewer-facing technical detail may be precise, but any text proposed for the public website must use plain Czech and explain unfamiliar references.
- Cloudflare Workers is the production deployment target before a final domain is selected. The server runtime preserves the live collection-status endpoint used by the site.
- Cloudflare watches only `main` for production deployments. No non-production trigger is configured, so unpublished review proposals cannot become public through a branch preview.
- Cloudflare runs `npm run build` and then `npx wrangler deploy --config wrangler.deploy.jsonc`. A failed test, validation, build, or deployment keeps the previous production version live.

## Operational role boundaries

These roles handle repository quality and release only. They do not collect evidence, assess a political promise, or approve publication of a political assessment.

| Role | Owns | Must not do |
|---|---|---|
| PR author | Delivers one scoped, locally validated change and addresses feedback manually. | Initiate a Copilot or Codex review without explicit owner authorization, approve, merge, or expand the approved scope. |
| Optional quality reviewer | GitHub Copilot or Codex inspects one owner-authorized exact head and reports technical findings. | Edit the branch, merge, replace owner approval, or determine a political score. |
| CI verifier | Runs required tests, build, and deployment-package validation for an exact head. | Approve, merge, or deploy a non-`main` revision to production. |
| Deployer | Builds and deploys a successful `main` revision to Cloudflare Workers. | Deploy an unpublished branch or treat deployment as editorial approval. |
| Owner | Reviews the exact current head, gives `schvaluji` or feedback, and merges manually after verification succeeds. | Delegate approval implicitly to an automated reviewer. |

## Required approval flow

1. The PR author opens a pull request with a locally validated scoped change. Opening a PR, marking a draft ready, pushing a commit, or an owner comment never starts a Copilot or Codex review.
2. The `Verify pull request` workflow must succeed for the PR's exact current head.
3. The owner reviews that head. The owner may explicitly authorize one GitHub Copilot or Codex review of that identified head; no workflow, agent, or other automatic process may make or repeat the request.
4. The owner replies `schvaluji` to approve the exact current head, or leaves feedback. The PR author addresses feedback manually and a changed head returns to step 2.
5. The owner merges the approved verified head manually.
6. Cloudflare Workers Builds automatically builds and deploys merged `main`. The owner checks its outcome manually.

## Current operational state

The first repository-triggered production deployment completed successfully on 2026-09-03 after pull request 11 was approved and merged. Cloudflare built the exact `main` merge commit and the public Worker responded successfully, including the server-rendered collection-status endpoint. This verifies the merge-to-deployment path.

The earlier ChatGPT Sites demo is currently still available. This is operational state, not an active fallback or retention rule; its removal timing remains open.

No GitHub Copilot or Codex review is automatic or required. A review may occur only after the owner explicitly authorizes it for a specific pull request and revision.

No release controller, feedback resolver, GitHub App, signed webhook receiver, durable release state, automatic ready comment, or deployment-result reporter is part of the release path.

## Open questions

- Which public product name and custom domain will replace the temporary hosting addresses.
- When the earlier ChatGPT Sites demo should be removed.
