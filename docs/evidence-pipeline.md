# Evidence pipeline

## Authority

This is the only operational definition of evidence collection, matching, and automated assessment. Promise lifecycle belongs to [promise-selection.md](promise-selection.md); score meanings belong to [scoring.md](scoring.md).

## Purpose

The pipeline checks current, confirmed promises against new evidence. It does not discover or confirm campaign promises. A missing match or insufficient evidence leaves the current score unchanged; neither creates a new public state.

## Daily process

The complete process runs once a day at `09:37` in `Europe/Prague`, with a manual trigger retained for recovery and deliberate backfills.

1. **Collect** each enabled allowlisted source once, normalize records, retain provenance and content hashes, and record failures.
2. **Match** new or changed records deterministically against every confirmed promise. A match means only “possibly relevant.”
3. **Package** the complete current relevant evidence for each affected promise. Media can discover or explain an event but does not by itself establish a decisive score.
4. **Enrich** a known official target, such as a parliamentary document, only when the package identifies that exact target. Enrichment does not score.
5. **Assess** only a new assessment fingerprint. Two independent assessors receive only the bounded package and may cite only its evidence identifiers. On disagreement, an arbiter selects one supplied assessment or returns that it cannot decide.
6. **Write** a new immutable score revision only when the assessment supports a fair score or explanation change. Otherwise retain the existing score and retain the audit.
7. **Derive** the SLAVA Index from current scores of all confirmed promises.

The changed-input fingerprint includes assessable content, methodology, prompt hashes, providers, and model IDs; it excludes volatile run timestamps and collection IDs so unchanged evidence does not spend model credits again.

## Evidence boundaries

- Prefer primary official records. News feeds are discovery and context; a strong `+2` or `-2` normally needs the underlying primary record.
- Preserve conflicting evidence. Do not average it.
- A party vote is attributable only under the strict-majority and decisive-motion rule in [scoring.md](scoring.md).
- Bill authorship is not party conduct by itself.
- An official party publication is evidence of an adopted position only when its text expressly adopts it. It is not proof that an asserted law, vote, or outcome occurred.
- The collector, matcher, and enricher never choose a score.

## Audit and safety

For every assessment, retain package content, evidence IDs and excerpts, prompt and methodology versions, model IDs, fingerprint, time, confidence, assessor outputs, and arbitration. Reject invented evidence IDs, quotations, and unsupported claims.

The public site receives no live model call. A failed workflow leaves public data and the public freshness date unchanged.

## Source registry

`automation/collectors/sources.json` is the authoritative enabled/deferred source registry. It records host, format, coverage semantics, and use. Adding a source requires a deliberate registry and validation change. Its current IDs are `psp-core-2025`, `government-cz-rss`, `mpsv-press-archive-2025-2026`, `mf-press-archive-2025-2026`, `mzd-press-wordpress`, `mk-news-archive`, `msmt-news-api`, `motoriste-party-news-wordpress`, `irozhlas-domestic-rss`, `ct24-rss`, `seznam-zpravy-rss`, `novinky-news-sitemap`, `ano-party-news`, `spd-party-news`, `odok-veklep`, and `e-sbirka-open-data`.

## Current implementation gap

The existing workflow still persists legacy `automation/review-proposals` rather than score revisions. Those archived proposals are not a promise or score state. The workflow is retained while the 09:37 process is simplified in its own later change.
