# Project instructions

## Cold start

- Read `docs/project-guide.md` and `docs/decisions.md` completely before a material product, methodology, data, automation, or release change.
- Then read the canonical document named by the guide. Do not recreate its rules in code comments, prompts, or another document.
- Derive current counts and operational state from the repository and connected server-side systems, not a conversation summary.

## Language and decisions

- Write repository content, code, identifiers, comments, and documentation in English. Communicate with the owner in Czech unless asked otherwise.
- Preserve exact Czech political quotations; do not translate them and present them as original.
- `docs/decisions.md` contains the only current project rules. When a confirmed rule changes, replace or delete every superseded rule, implementation, test, workflow, prompt, and artifact. Do not preserve prior models, procedures, or decision records in the repository.

## Canonical rules

- [promise-selection.md](docs/promise-selection.md) is the sole promise-lifecycle rule.
- [scoring.md](docs/scoring.md) is the sole score and SLAVA Index rule.
- [evidence-pipeline.md](docs/evidence-pipeline.md) is the sole evidence-pipeline rule.
- [release-process.md](docs/release-process.md) is the sole release rule.

## Non-negotiable safeguards

- Preserve exact promise wording and source. Use only clear official national party commitments in the initial catalogue.
- A confirmed promise is public immediately; candidates and rejected occurrences are not. Do not add a fourth promise state.
- A score is always a number from `-2` to `+2`, defaulting to `0` except for a documented maintenance baseline defined in the canonical scoring rule; it is separate from lifecycle.
- Keep public assessment history append-only and derive, never manually edit, the SLAVA Index.
- The daily post-confirmed pipeline uses two independent AI assessors and one arbiter when the valid assessments disagree or exactly one assessor output is invalid. Their output is an unpublished human-review proposal, never a public score or publication decision.
- Models may cite only evidence supplied in their bounded package. Keep active prompt, model, evidence-ID, confidence, and fingerprint records auditable.
- The daily pipeline runs at 09:37 Europe/Prague and keeps the manual trigger. A failed complete run must not advance public freshness.
- No GitHub Copilot or Codex review may be started, requested, repeated, or awaited without the owner's explicit instruction for the exact pull request and head. Such a review is advisory only.
- Follow the pull-request feedback-response protocol in [release-process.md](docs/release-process.md): post the visible item-by-item resolution before resolving its line-review thread.
- Repository changes for `main` use a PR, a successful exact-head `Verify pull request` run, and the owner's explicit `schvaluji`. The owner merges manually; only `main` deploys.

## Scope

- Keep the public site simple, mobile-first, traceable, and free of live AI calls.
- Use Astro, TypeScript, plain CSS, and schema-validated versioned files unless a confirmed decision changes that stack.
- Do not add a database, CMS, accounts, search engine, public AI endpoint, release controller, feedback resolver, webhook receiver, or Cloudflare connector without a confirmed decision.
