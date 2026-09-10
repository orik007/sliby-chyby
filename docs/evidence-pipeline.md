# Evidence automation

## Purpose

The workflow checks confirmed public promises against records from allowlisted sources. It does not discover or confirm campaign promises, score promises, or publish data.

## Daily workflow

It runs once daily at `09:37` in `Europe/Prague` and keeps a manual trigger.

1. Collect each enabled source, normalize its records, and retain provenance and content hashes.
2. Match records deterministically to every confirmed promise. A match is only potentially relevant.
3. Build a bounded package of attributable primary evidence for each promise where that is possible.
4. Enrich a known official parliamentary document only when its exact target appears in a package.
5. Write a coverage audit for every confirmed promise and enabled source.

The workflow uploads its run artifact only. It does not call a model, assign political direction, write score revisions, change `data/`, open a pull request, or publish anything. A failed complete run does not advance public freshness.

## Evidence boundaries

- Prefer primary official records. Media are discovery and context, not decisive evidence by themselves.
- Preserve the original record, source URL, time, and content hash.
- A party vote is attributable only under the strict-majority and decisive-motion rule in [scoring.md](scoring.md).
- Bill authorship alone is not party conduct.
- The collector, matcher, and document enricher never choose a score.

## Source registry

`automation/collectors/sources.json` is the enabled-source registry. It defines each source's host, format, coverage semantics, and intended use. Adding or changing a source requires a validated registry change.

Current source IDs: `psp-core-2025`, `government-cz-rss`, `mpsv-press-archive-2025-2026`, `mf-press-archive-2025-2026`, `mzd-press-wordpress`, `mk-news-archive`, `msmt-news-api`, `motoriste-party-news-wordpress`, `irozhlas-domestic-rss`, `ct24-rss`, `seznam-zpravy-rss`, `novinky-news-sitemap`, `ano-party-news`, `spd-party-news`, `odok-veklep`, and `e-sbirka-open-data`.
