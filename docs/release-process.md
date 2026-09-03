# Release process

This document describes the confirmed release policy and its server-side implementation.

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
- Cloudflare Workers is the production deployment target before a final domain is selected. The server runtime preserves the live collection-status endpoint used by the site.
- Cloudflare watches only `main` for production deployments. No non-production trigger is configured, so unpublished review proposals cannot become public through a branch preview.
- Cloudflare runs `npm run build` and then `npx wrangler deploy --config wrangler.deploy.jsonc`. A failed test, validation, build, or deployment keeps the previous production version live.
- The existing ChatGPT Sites URL remains a temporary demo during the hosting transition.

## Implemented approval flow

- GitHub pull-request activity wakes a cloud ChatGPT approval conversation available on mobile.
- The conversation presents a plain-language summary, links to the pull request, records the exact head revision, and asks for either `schvaluji` or specific feedback.
- After `schvaluji`, the connected GitHub app verifies the unchanged revision and required checks before merging.
- Cloudflare Workers Builds automatically builds and deploys the merged `main` revision.
- The approval conversation reports the merge result. Deployment confirmation in that conversation remains to be connected to the Cloudflare result.

## Open questions

- Which public product name and custom domain will replace the temporary hosting addresses.
- How the approval conversation should receive and report the final Cloudflare Workers deployment result automatically.
