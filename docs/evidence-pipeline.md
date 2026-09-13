# Evidence automation

## Purpose

The workflow checks confirmed public promises against records from allowlisted sources. It does not discover or confirm campaign promises. Its AI output is an unpublished proposal; it never changes a public score or publishes data.

## Daily workflow

It runs once daily at `09:37` in `Europe/Prague` and keeps a manual trigger.

1. For each enabled source, select its own collection start. A source without a checkpoint performs a bootstrap from `bootstrapFrom`; an existing source starts from its own last successful collection date. A manual run may explicitly override that start.
2. Collect and normalize the records and retain provenance and content hashes. Only after every selected collector succeeds, write the updated per-source checkpoints atomically.
3. Match records deterministically to every confirmed promise. A match is only potentially relevant.
4. Build a bounded package of attributable primary evidence for each promise where that is possible.
5. Enrich a known official parliamentary document only when its exact target appears in a package.
6. Send each new or changed package independently to two assessors. They can cite only evidence IDs in that package.
7. Send an assessor disagreement to an arbiter, which may select one assessment or return no conclusion.
8. Store the result as an unpublished human-review proposal and write a coverage audit for every confirmed promise and enabled source.

The workflow updates one dedicated audit pull request with unpublished proposals and per-source checkpoints. It must fail if it cannot create or update that required pull request. This is not a Copilot or Codex review. It never writes a public score revision, changes published `data/`, or publishes anything. A failed complete run does not advance public freshness.

Human review of that audit may establish that a score should change, but it does not publish anything. The score change must be prepared in a separate scoped pull request based on current `main`; that PR adds an append-only assessment revision with cited public sources and follows the release process.

## Evidence boundaries

- Prefer primary official records. Media are discovery and context, not decisive evidence by themselves.
- Preserve the original record, source URL, time, and content hash.
- A party vote is attributable only under the strict-majority and decisive-motion rule in [scoring.md](scoring.md).
- Bill authorship alone is not party conduct.
- The collector, matcher, and document enricher never choose a score.
- The assessors and arbiter use the five-step decision order in [scoring.md](scoring.md). Their output is only a proposal for human review.
- A changed-input fingerprint includes assessable content, active prompt content, providers, and model IDs. Run timestamps and collection IDs alone do not trigger another paid assessment.

## Source registry

`automation/collectors/sources.json` is the enabled-source registry. It defines each source's host, format, coverage semantics, and intended use. Adding or changing a source requires a validated registry change.

Every source defines `bootstrapFrom`. `automation/collectors/checkpoints.json`, held on the durable audit branch, records the source-specific successful collection state. A new source has no checkpoint and therefore receives its own bootstrap; it never inherits another source's cursor. The checkpoint is operational audit data, not public assessment data.

Current source IDs: `psp-core-2025`, `government-cz-rss`, `mpsv-press-archive-2025-2026`, `mf-press-archive-2025-2026`, `mzd-press-wordpress`, `mk-news-archive`, `msmt-news-api`, `motoriste-party-news-wordpress`, `irozhlas-domestic-rss`, `ct24-rss`, `seznam-zpravy-rss`, `novinky-news-sitemap`, `ano-party-news`, `spd-party-news`, `odok-veklep`, and `e-sbirka-open-data`.
