# Unpublished assessment proposals

This is the queue of proposed assessments of promises, ready for review and kept on the audit branch.

- A proposal is created from one evidence package: the law changes routed to one promise and the party's attributable conduct on them.
- Two independent assessors evaluate it; an invalid assessor output is asked for again at most twice, and an arbiter is used only when the valid assessments give different scores or exactly one output is still invalid.
- Models may cite only evidence supplied in that package. Each assessor states for every law change whether it is relevant to the promise and why.
- Every proposal remains unpublished here; no person checks its content, and an assessment-revision pull request publishes the current proposals ([evidence-pipeline.md](../../docs/evidence-pipeline.md), From proposal to public score).
- The assessment fingerprint prevents another model call when the assessable input, active prompts, providers, and models are unchanged.

The active prompts are named in `scripts/lib/assessment-config.mjs`.
