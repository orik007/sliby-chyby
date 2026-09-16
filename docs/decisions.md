# Current project rules

This document contains only the current confirmed rules. When a rule changes, replace this document and every implementation of the prior rule; do not keep superseded models, procedures, prompts, or decision records.

## Public identity

- The public brand is Sliboměr.
- The canonical public origin is `https://slibomer.cz`.
- Existing repository, Worker, and automation identifiers retain `sliby-chyby` until a separate infrastructure decision changes them.

## Promise catalogue

- A source is one verifiable item: one PDF, page, post, video, article, vote, or official record. It has an ID, type, title, publisher, URL, and any known date.
- A source can support many promises. A promise records its source ID and an exact locator, such as a PDF page, paragraph, or video timestamp.
- Every promise is exactly `candidate`, `confirmed`, or `rejected`.
- `confirmed` means public immediately. There is no confirmed-but-unpublished state.
- A rejected promise records its reason. Candidates and rejected promises are not public.
- The initial catalogue covers ANO 2011, SPD, and Motoristé sobě in the 2025 Czech Chamber of Deputies election, from official national party sources.

## Promise source archive

- Preserve the original files supporting catalogue promises in a versioned repository archive, independent of the automation audit branch. This includes the source catalogue for candidate and rejected promises.
- Record each copy's source ID, original URL, retrieval URL and time, byte length, and SHA-256 hash. Preserve downloaded bytes unchanged; changed source content receives a new copy rather than replacing an archived file.
- Public source links continue to point to the original publisher. An archived copy can be used as an explicitly labelled fallback if the original disappears, through the normal release process.
- This archive covers promise sources. Daily assessment evidence is retained separately as an unpublished operational queue on the dedicated audit branch; it is not part of the public source archive.

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
- It collects each allowlisted source from its own durable checkpoint. A source without a checkpoint performs a bootstrap from its registry-defined `bootstrapFrom` date; a manual run may explicitly override that start for every selected source.
- After a complete successful collection stage, each selected source records its own collection time, requested start, newest observed record, record count, run ID, and available snapshot hash. A failed run writes no new checkpoint.
- It retrieves evidence candidates for every confirmed promise by combining precise identifiers and phrases with semantic similarity against versioned promise profiles. Semantic retrieval retains only candidates at or above the configured minimum similarity, then at most the configured top number per primary record. A candidate relationship never establishes relevance, attribution, a score, or publication.
- The semantic index is versioned operational audit data. It derives each profile from the exact promise wording, its fulfillment and contradiction tests, and precise matching signals; it records the embedding provider, model, dimensions, and profile hash. Each retrieved candidate separately records its retrieval rank.
- It sends each new or changed bounded evidence package to two independent assessors. Each assessor first determines whether its supplied candidate evidence is materially relevant; only then does it propose a score. If the valid assessments disagree, or exactly one assessor output is invalid, an arbiter selects a usable assessment or returns no conclusion. Two invalid outputs write a private failure audit and re-enter a later assessment batch unless a newer current package for the same promise replaces them.
- After every successful collection, it persists source checkpoints. After successful matching and enrichment, it persists the semantic index and enriched evidence packages to one dedicated unpublished audit pull request before any assessment call. The queue retains exactly one current package for each promise and keeps superseded package versions auditable. A package blocked by an official-document enrichment warning is retried from that queue until it succeeds or a newer package supersedes it. Assessment proposals join that same pull request, which may grow until it is reviewed. It never changes public data, a public score, or publication status.
- A human-approved score change uses a separate scoped pull request based on current `main`. It adds an append-only public assessment revision with its cited sources; its approval and merge are governed by the release process.
- The assessors and arbiter may cite only supplied evidence IDs. Their active prompt versions, providers, model IDs, confidence, evidence IDs, and input fingerprint remain auditable.
- The fingerprint prevents paid reassessment when assessable input, active prompts, providers, and models are unchanged.
- A failed complete run does not advance public freshness.

## Delivery

- Changes for `main` use a pull request, exact-head verification, explicit owner approval (`schvaluji`), and a manual merge.
- Copilot and Codex reviews never start automatically. They run only after an explicit owner request for a specified pull request and head, and are advisory.
- Addressed review feedback receives a visible, item-by-item resolution before its corresponding line-review thread is resolved. The response protocol is defined in `release-process.md`.
- Only `main` deploys. The stack is Astro, TypeScript, plain CSS, and schema-validated versioned files.
