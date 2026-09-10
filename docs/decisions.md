# Current project rules

This document contains only the current confirmed rules. When a rule changes, replace this document and every implementation of the prior rule; do not keep superseded models, procedures, prompts, or decision records.

## Promise catalogue

- A source is one verifiable item: one PDF, page, post, video, article, vote, or official record. It has an ID, type, title, publisher, URL, and any known date.
- A source can support many promises. A promise records its source ID and an exact locator, such as a PDF page, paragraph, or video timestamp.
- Every promise is exactly `candidate`, `confirmed`, or `rejected`.
- `confirmed` means public immediately. There is no confirmed-but-unpublished state.
- A rejected promise records its reason. Candidates and rejected promises are not public.
- The initial catalogue covers ANO 2011, SPD, and Motoristé sobě in the 2025 Czech Chamber of Deputies election, from official national party sources.

## Scores and index

- Every confirmed promise has one current numerical score from `-2` to `+2`. Its initial score is `0`.
- A score is separate from the promise lifecycle and may change whenever traceable evidence justifies a new current assessment.
- The SLAVA Index includes every confirmed promise of the party and is `round(sum(scores) / (2 × promise count) × 100)`. It ranges from `-100` to `+100`.
- No manual aggregate is stored.

## Evidence automation

- The daily workflow runs at 09:37 Europe/Prague and retains a manual trigger.
- It collects allowlisted sources, matches evidence to confirmed promises, enriches known official documents, and writes a coverage audit.
- It sends each new or changed bounded evidence package to two independent assessors. If they disagree, an arbiter selects one assessment or returns no conclusion.
- It writes only unpublished human-review proposals. A proposal may be kept in its dedicated proposal pull request, but it never changes public data, a public score, or publication status.
- The assessors and arbiter may cite only supplied evidence IDs. Their active prompt versions, providers, model IDs, confidence, evidence IDs, and input fingerprint remain auditable.
- The fingerprint prevents paid reassessment when assessable input, active prompts, providers, and models are unchanged.
- A failed complete run does not advance public freshness.

## Delivery

- Changes for `main` use a pull request, exact-head verification, explicit owner approval (`schvaluji`), and a manual merge.
- Copilot and Codex reviews never start automatically. They run only after an explicit owner request for a specified pull request and head, and are advisory.
- Only `main` deploys. The stack is Astro, TypeScript, plain CSS, and schema-validated versioned files.
