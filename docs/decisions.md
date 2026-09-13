# Current project rules

This document contains only the current confirmed rules. When a rule changes, replace this document and every implementation of the prior rule; do not keep superseded models, procedures, prompts, or decision records.

## Promise catalogue

- A source is one verifiable item: one PDF, page, post, video, article, vote, or official record. It has an ID, type, title, publisher, URL, and any known date.
- A source can support many promises. A promise records its source ID and an exact locator, such as a PDF page, paragraph, or video timestamp.
- Every promise is exactly `candidate`, `confirmed`, or `rejected`.
- `confirmed` means public immediately. There is no confirmed-but-unpublished state.
- A rejected promise records its reason. Candidates and rejected promises are not public.
- The initial catalogue covers ANO 2011, SPD, and Motoristé sobě in the 2025 Czech Chamber of Deputies election, from official national party sources.

## Policy categories

- Every confirmed promise has exactly one common policy category from the controlled 2025 category list.
- The common category is decided for each promise from its exact commitment and source context. A party programme chapter is traceability metadata and never decides a category by itself.
- When one already-confirmed promise mentions several subjects, its category follows the principal action to be assessed; its exact wording remains unchanged.
- The public site groups and orders promises only by that common category. It does not display party-specific programme chapters as categories.
- The category mapping retains the original programme chapter, its order, and any verified narrower source section solely for source traceability and later maintenance.
- A category is a navigational subject label, not an editorial measure of importance. Within a category, promises follow their programme context and source order where available.

## Scores and index

- Every confirmed promise has one current numerical score from `-2` to `+2`. The default is `0` when no documented assessment conclusion sets another score, except for a verified maintenance baseline defined in `scoring.md`.
- A maintenance commitment promises not to make one identified change. When the existing state is documented and remains under the responsible party or government's control, it may receive `+1`; elapsed time and merely negative wording never suffice.
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
- Addressed review feedback receives a visible, item-by-item resolution before its corresponding line-review thread is resolved. The response protocol is defined in `release-process.md`.
- Only `main` deploys. The stack is Astro, TypeScript, plain CSS, and schema-validated versioned files.
