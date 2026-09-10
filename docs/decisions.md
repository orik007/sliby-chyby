# Decision register

This is the historical register of accepted decisions, working proposals, and open questions. Operational rules live only in the canonical documents named by [project-guide.md](project-guide.md).

## Confirmed decisions

### Promise lifecycle and score — 2026-09-10

- A source occurrence is exactly one of `candidate`, `confirmed`, or `rejected`.
- Confirmation and publication are the same event. There is no confirmed-but-unpublished state.
- A score is independent of lifecycle, always numerical from `-2` to `+2`, and defaults to `0`.
- Every confirmed promise contributes its current score to the derived SLAVA Index.
- During the live period, the daily evidence pipeline may revise a confirmed promise's current score when traceable evidence justifies it. Insufficient evidence leaves the current score unchanged.
- A period-closing state or final-score process is future work, not current behavior.

### Daily evidence workflow

- Run one complete evidence pipeline daily at 09:37 Europe/Prague and retain a manual trigger.
- Keep collection, matching, evidence packaging, and scoring distinct and auditable.
- Use two independent assessors and an arbiter for disagreement. Models may cite only supplied evidence.
- Do not repeat paid assessment for an unchanged assessment fingerprint.
- A failed complete run does not advance public freshness.

### Release and code review

- Repository changes for `main` use a PR, exact-head verification, owner `schvaluji`, and a manual merge.
- Cloudflare deploys only `main`.
- Copilot and Codex reviews never start automatically. The owner may request a single advisory review for a specified PR and exact head.
- No release controller, resolver, GitHub App, webhook receiver, or automated PR/deployment reporter is used.

### Initial scope and stack

- The initial catalogue tracks ANO 2011, SPD, and Motoristé sobě in the 2025 Czech Chamber of Deputies period.
- Use Astro, TypeScript, plain CSS, and schema-validated versioned files. Do not introduce a database without a later confirmed need.

## Superseded decisions

- **Automatic Copilot/Codex review waves and their controller** were superseded because they consumed credits and complicated the release process.
- **Unpublished human-review score proposals as an active publication gate** were superseded by the 2026-09-10 lifecycle-and-score decision. Existing proposal files remain historical audit records until migrated.
- **Cloudflare connector-based agent work** was superseded; no Cloudflare connector is used.

## Working proposals

- Expand the promise catalogue from official national party sources until the catalogue is complete, not a quota-based sample.
- Add another assessment provider only after a deliberate evaluation; the current two-assessor pattern may initially use separate stateless calls to one provider.

## Open questions

- Exact period boundaries and a future closing assessment.
- Minimum primary evidence for each strong score.
- Source snapshot and retention policy.
- Final public name and custom domain.
