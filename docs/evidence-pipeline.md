# Evidence automation

## Purpose

The workflow checks confirmed public promises against records from allowlisted sources. It does not discover or confirm campaign promises. Its AI output is an unpublished proposal; it never changes a public score or publishes data.

## Daily workflow

It runs once daily at `09:37` in `Europe/Prague` and keeps a manual trigger.

1. For each enabled source, select its own collection start. A source without a checkpoint performs a bootstrap from `bootstrapFrom`; an existing source starts from its own last successful collection date. A manual run may explicitly override that start.
2. Collect and normalize the records and retain provenance and content hashes. Only after every selected collector succeeds, write the updated per-source checkpoints atomically.
3. Generate candidate relationships to every confirmed promise. Union precise identifiers and phrase signals with semantic candidates at or above `0.55` similarity, retaining at most the top three per primary record from the versioned promise-embedding index. A candidate is only potentially relevant.
4. Build a bounded package of attributable primary evidence for each promise where that is possible. The package retains its exact and semantic candidate bases, including the semantic model, profile hash, similarity, and rank.
5. Enrich a known official parliamentary document only when its exact target appears in a package. Retry the current queued package when a prior enrichment warning blocked it and no newer package supersedes it.
6. Before any assessment call, persist the successful per-source checkpoints, semantic index, and enriched packages to the dedicated audit branch. A package remains queued until a changed package supersedes it; a later assessment failure or timeout does not discard it.
7. Send each new or changed queued package independently to two assessors in small bounded-concurrency batches. They first determine material relevance and can cite only evidence IDs in that package.
8. Send two valid but different assessments, or one valid assessment whose peer output is invalid, to an arbiter. It may select a usable assessment or return no conclusion. Two invalid outputs write a private failure audit under `automation/review-proposals/failures/`, re-enter a later assessment batch unless a newer current package for the same promise replaces them, fail only that package, and do not stop the batch.
9. Store the result as an unpublished human-review proposal and write a coverage audit for every confirmed promise and enabled source.

The workflow maintains one dedicated audit pull request with queued evidence packages, unpublished proposals, and per-source checkpoints. It creates that pull request at the first successful persistence stage and preserves its human-review body while later commits update the same audit branch. A later assessment failure does not roll the saved audit data back. This is not a Copilot or Codex review. It never writes a public score revision, changes published `data/`, or publishes anything. A failed complete run does not advance public freshness.

Human review of that audit may establish that a score should change, but it does not publish anything. The score change must be prepared in a separate scoped pull request based on current `main`; that PR adds an append-only assessment revision with cited public sources and follows the release process.

## Evidence boundaries

- Prefer primary official records. Media are discovery and context, not decisive evidence by themselves.
- Preserve the original record, source URL, time, and content hash.
- A party vote is attributable only under the strict-majority and decisive-motion rule in [scoring.md](scoring.md).
- Bill authorship alone is not party conduct.
- The collector, exact-signal matcher, semantic retriever, and document enricher never establish relevance, attribution, or a score. Semantic similarity only selects candidates for the assessors.
- The assessors and arbiter use the five-step decision order in [scoring.md](scoring.md). Their output is only a proposal for human review.
- A changed-input fingerprint includes assessable content, active prompt content, providers, and model IDs. Run timestamps and collection IDs alone do not trigger another paid assessment.

## Source registry

`automation/collectors/sources.json` is the enabled-source registry. It defines each source's host, format, coverage semantics, and intended use. Adding or changing a source requires a validated registry change.

Every source defines `bootstrapFrom`. `automation/collectors/checkpoints.json`, held on the durable audit branch, records the source-specific successful collection state. A new source has no checkpoint and therefore receives its own bootstrap; it never inherits another source's cursor. The checkpoint is operational audit data, not public assessment data.

`automation/semantic-index/promise-index.json`, held on the durable audit branch, records embeddings for published promise profiles. It is refreshed when a profile changes and prunes entries for promises no longer published. Each new primary source record is embedded for the current run and compared locally with all published promise profiles; only candidates at or above `0.55` similarity, among its top three, and any precise signal matches continue to assessment. The index is operational audit data, not public assessment data.

`automation/evidence-packages/manifest.json`, held on the durable audit branch, records each enriched package's hash, queue time, enrichment block state, and supersession links. Its `packages/` directory preserves the unchanged bounded package bytes. The current version of each promise package is the only version eligible for assessment; completed assessment output and a timeout never discard the queue.

Current source IDs: `psp-core-2025`, `government-cz-rss`, `mpsv-press-archive-2025-2026`, `mf-press-archive-2025-2026`, `mzd-press-wordpress`, `mk-news-archive`, `msmt-news-api`, `motoriste-party-news-wordpress`, `irozhlas-domestic-rss`, `ct24-rss`, `seznam-zpravy-rss`, `novinky-news-sitemap`, `ano-party-news`, `spd-party-news`, `odok-veklep`, and `e-sbirka-open-data`.
