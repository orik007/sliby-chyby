# Evidence collectors

Collectors discover possible evidence. They never assign a SLAVA status or direction and never publish an assessment.

## Enabled sources

The initial verified registry contains:

- daily full PSP open-data snapshots for votes, parliamentary prints, and time-bounded parliamentary-club membership;
- official RSS from the Government Office and MPSV;
- publisher-provided feeds from iROZHLAS, ČT24, and Seznam Zprávy;
- the Novinky.cz Google News sitemap advertised in its `robots.txt` file.

Media sources are discovery and context only. Their inclusion in the registry is not a general endorsement and does not make an article decisive evidence. A strong `+2` or `-2` assessment should normally cite the underlying primary decision, enacted measure, authoritative outcome, or official record.

## Stored content

- PSP records retain structured facts and official identifiers needed to reproduce vote and legislative history.
- Feeds retain publisher, title, URL, time, feed identifier, author names when supplied, and at most the short configured feed excerpt.
- The collector never downloads or stores full news article bodies.
- Every source response and normalized record receives a SHA-256 hash.
- A source may redirect only to a hostname explicitly allowed in the registry.

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
