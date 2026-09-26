# Unpublished assessment proposals

This is the human-review queue of proposed assessments of promises, kept on the audit branch.

- A proposal is created from one evidence package: the law changes routed to one promise and the party's attributable conduct on them.
- Two independent assessors evaluate it; an arbiter is used when valid assessments disagree or exactly one assessor output is invalid.
- Models may cite only evidence supplied in that package. Each assessor states for every law change whether it is relevant to the promise and why.
- Every proposal remains unpublished and requires human review; a score change is a separate pull request.
- The assessment fingerprint prevents another model call when the assessable input, active prompts, providers, and models are unchanged.

The active prompts are named in `scripts/lib/assessment-config.mjs`.
