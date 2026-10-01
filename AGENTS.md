# Project instructions

## Cold start

- Read `docs/project-guide.md` and `docs/decisions.md` completely before a material product, methodology, data, automation, or release change.
- Then read the canonical document named by the guide. Do not recreate its rules in code comments, prompts, or another document.
- Derive current counts and operational state from the repository and connected server-side systems, not a conversation summary.

## Accuracy

- **Answer only with verified facts. When you do not know something, look it up in a primary source or say plainly that you do not know. Never guess, invent, or present an assumption as fact.**
- **Never build logic on data you have not inspected. When a source is unreachable, say so before writing code against it, and do not present untested code as working.**

## Language and decisions

- Write repository content, code, identifiers, comments, and documentation in English. Communicate with the owner in Czech unless asked otherwise.
- Preserve exact Czech political quotations; do not translate them and present them as original.
- `docs/decisions.md` contains the only current project rules. When a confirmed rule changes, replace or delete every superseded rule, implementation, test, workflow, prompt, and artifact. Do not preserve prior models, procedures, or decision records in the repository.

## Canonical rules

- [promise-selection.md](docs/promise-selection.md) is the sole promise-catalogue rule.
- [scoring.md](docs/scoring.md) is the sole rule for scoring a promise.
- [slava-index.md](docs/slava-index.md) is the sole SLAVA Index rule.
- [evidence-pipeline.md](docs/evidence-pipeline.md) is the sole evidence-pipeline rule.
- [release-process.md](docs/release-process.md) is the sole release rule.

## Non-negotiable safeguards

- Preserve exact programme wording and source; every quote must match the archived programme text. The catalogue covers every statement of the official national party programmes as defined in the canonical catalogue rule.
- Every catalogued item is a promise, a statement, or a rejected occurrence. A promise is public and scored; a statement is public, has no score, and never counts in the SLAVA Index; a rejected occurrence has a technical reason and is not public. Do not add a fourth state.
- A promise's score is always a number from `-2` to `+2`, defaulting to `0` except for a documented maintenance baseline defined in the canonical scoring rule; it is separate from the catalogue state.
- Keep a promise's public assessment history append-only while it is a promise (the catalogue rule removes it only when the item stops being a promise) and derive, never manually edit, the SLAVA Index.
- Promise routing tags are assigned once and reviewed with the promise; no model tags promises. The daily pipeline uses two independent AI assessors; an invalid assessor output is asked for again at most twice, and one arbiter is called only when the valid assessments give different scores or exactly one assessor output stays invalid. Their output is an unpublished human-review proposal, never a public score or publication decision.
- Models may cite only evidence supplied in their bounded package. Keep active prompt, model, evidence-ID, confidence, and fingerprint records auditable.
- The daily pipeline runs at 09:37 Europe/Prague and keeps the manual trigger. A failed complete run must not advance public freshness.
- No GitHub Copilot or Codex review may be started, requested, repeated, or awaited without the owner's explicit instruction for the exact pull request and head. Such a review is advisory only.
- Follow the pull-request feedback-response protocol in [release-process.md](docs/release-process.md): post the visible item-by-item resolution before resolving its line-review thread.
- Repository changes for `main` use a PR, a successful exact-head `Verify pull request` run, and the owner's explicit `schvaluji`. The owner merges manually; only `main` deploys.

## Scope

- Keep the public site simple, mobile-first, traceable, and free of live AI calls.
- Use Astro, TypeScript, plain CSS, and schema-validated versioned files unless a confirmed decision changes that stack.
- Do not add a database, CMS, accounts, search engine, public AI endpoint, release controller, feedback resolver, webhook receiver, or Cloudflare connector without a confirmed decision.
