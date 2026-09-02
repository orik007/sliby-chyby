# Evidence collectors

Collectors discover possible evidence. They never assign a SLAVA status or direction and never publish an assessment.

The canonical end-to-end pipeline and the authoritative human-readable source list are in [`docs/evidence-pipeline.md`](../../docs/evidence-pipeline.md). This file documents collector-specific implementation details.

## Enabled sources

The initial verified registry contains:

- daily full PSP open-data snapshots for votes, parliamentary prints, and time-bounded parliamentary-club membership;
- official RSS from the Government Office and MPSV;
- publisher-provided feeds from iROZHLAS, ČT24, and Seznam Zprávy;
- the Novinky.cz Google News sitemap advertised in its `robots.txt` file.

Media sources are discovery and context only. Their inclusion in the registry is not a general endorsement and does not make an article decisive evidence. A strong `+2` or `-2` assessment should normally cite the underlying primary decision, enacted measure, authoritative outcome, or official record.

## Stored content

- PSP records retain structured facts and official identifiers needed to reproduce vote and legislative history.
- The collector records the official publication timestamp needed by the later print-document enrichment stage. It does not download every parliamentary document during broad collection.
- Feeds retain publisher, title, URL, time, feed identifier, author names when supplied, and at most the short configured feed excerpt.
- The collector never downloads or stores full news article bodies.
- Every source response and normalized record receives a SHA-256 hash.
- A source may redirect only to a hostname explicitly allowed in the registry.
- The Government Office feed legitimately links some cabinet-agenda items to the official `www.odok.cz` portal; both government hostnames are explicitly allowlisted for that source.
- The same feed may reuse one GUID and URL for an agenda, its addenda, and notices. Feed-record identity therefore also includes the publication time and title so that these distinct official occurrences remain separate.

## Deferred sources

ODok/eKLEP is recorded but disabled until a stable documented machine-readable endpoint is verified. e-Sbírka is recorded but disabled because its own current notice recommends production Open Data integration only after 15 January 2027 and its public API requires registration.

## Commands

Collect enabled records from the last seven days:

```text
npm run collect:evidence
```

Choose an explicit cutoff and output directory:

```text
node scripts/run-collectors.mjs --since 2026-08-01 --output automation/runs/collectors/manual
```

Choose one or more sources:

```text
node scripts/run-collectors.mjs --source psp-core-2025 --source government-cz-rss
```

Collector runs are unpublished audit artifacts. Promise matching and assessment are separate downstream stages.

## GitHub Actions pipeline

The manually triggered `Collect and match evidence candidates` workflow runs the production-shaped non-AI portion of the pipeline:

1. collect all enabled verified sources once;
2. compare the resulting records with every promise in the reviewed registry;
3. generate bounded evidence packages only where attributable primary candidate evidence exists;
4. retrieve official DOCX files only for parliamentary prints already present in those packages, hash them, and select bounded numbered excerpts without assigning direction;
5. upload the collector run, complete match audit, original packages, enriched packages, and enrichment audit as one unpublished artifact.

The workflow never assigns evidence direction, calls an assessor, changes public data, or deploys the website. Assessment remains a separate stage so that empty, noisy, or clearly irrelevant collection runs do not create unnecessary model calls.
