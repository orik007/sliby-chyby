# Evidence collectors

Collectors discover possible evidence. They never assign a SLAVA status or direction and never publish an assessment.

The canonical end-to-end pipeline and the authoritative human-readable source list are in [`docs/evidence-pipeline.md`](../../docs/evidence-pipeline.md). This file documents collector-specific implementation details.

## Enabled sources

The authoritative allowlist and source roles are maintained once in [`docs/evidence-pipeline.md`](../../docs/evidence-pipeline.md) and machine-read from [`sources.json`](sources.json). This README does not duplicate that registry.

Media sources are discovery and context only. Their inclusion in the registry is not a general endorsement and does not make an article decisive evidence. A strong `+2` or `-2` assessment should normally cite the underlying primary decision, enacted measure, authoritative outcome, or official record.

## Stored content

- PSP records retain structured facts and official identifiers needed to reproduce vote and legislative history.
- The collector records the official publication timestamp needed by the later print-document enrichment stage. It does not download every parliamentary document during broad collection.
- Feeds retain publisher, title, URL, time, feed identifier, author names when supplied, and at most the short configured feed excerpt.
- The collector never downloads or stores full news article bodies.
- Every source response and normalized record receives a SHA-256 hash.
- Every source declares whether it is a full term snapshot, a since-filtered historical archive, or only a current publisher window. The run stores both that declaration and the actually observed date range.
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

Generate JSON and human-readable coverage reports after collection and matching:

```text
node scripts/run-coverage-audit.mjs --collector-run <collector-run.json> --matcher-run <match-run.json> --output <coverage-audit.json> --markdown <coverage-audit.md>
```

The report covers every reviewed promise. `No candidate match` describes one run only and never means zero points or verified inactivity.

## GitHub Actions pipeline

The `Collect, match, and assess evidence candidates` workflow runs the canonical sequence from [`docs/evidence-pipeline.md`](../../docs/evidence-pipeline.md) daily at 09:37 Prague time and may also be started manually. It collects each enabled source once, checks the full reviewed registry, assesses only changed bounded packages, and retains a complete unpublished audit. It never changes public data or deploys the website.
