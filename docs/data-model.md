# Data model

## Confirmed invariants

- A catalogue item belongs to one party in one electoral period. Repeated wording in a later period is a new item.
- Promises and statements are in `data/promises`; rejected occurrences are in `research/2025-election/rejected.json` and are never public ([promise-selection.md](promise-selection.md)).
- Every promise has one current score revision. The default score is `0` when no documented assessment conclusion sets another score, except for a documented maintenance baseline as defined in `scoring.md`. A statement has no score revision.
- Score revisions are append-only while the item is a promise ([promise-selection.md](promise-selection.md)). The latest revision is current.
- Every revision lists traceable source records. The SLAVA Index is derived, never stored as an editable value ([slava-index.md](slava-index.md)).
- A source is one document or record. An item references one source and an exact locator.

## Files

```text
data/
  periods/
  parties/
  party-periods/
  promise-categories.json
  sources/
  promises/
  assessment-revisions/
  system-status.json
```

A file in `data/promises` stores one item: `id`, `slug` (its URL), `partyPeriodId`, `kind` (`promise` or `statement`), `title`, `originalText` (the exact quote), `policyCategoryId`, `primarySourceId`, `sourceLocator` (the PDF page), `sourceOrder` (its position in the programme), and `isDemo`. A promise that is a maintenance commitment ([scoring.md](scoring.md)) also stores `maintenanceBaseline`: the preserved state in Czech (`preservedStateCz`) and its primary `source` (`id`, `url`, `publishedAt`, `locator`, `factSummary`, `primary`).

`AssessmentRevision` stores its score, public Czech explanation, date, and cited source IDs. A zero-default revision cites the promise source; a documented maintenance baseline or other assessment conclusion cites its supporting evidence directly.

`promise-categories.json` contains the controlled common policy categories with their order; each item names its category in `policyCategoryId`.

`automation/topic-routing/promise-tags.json` maps every promise ID to its reviewed specific routing tags ([evidence-pipeline.md](evidence-pipeline.md)); statements have none.

`research/2025-election/rejected.json` lists every rejected occurrence with its `sourceId`, `locator`, exact `originalTextCz`, and `reason` code; a duplicate names the published item it repeats in `duplicateOf`. `research/2025-election/not-catalogued.json` lists every other programme passage with its `sourceId`, `locator`, exact `originalTextCz`, and `reason` code. `research/2025-election/programme-text/` holds the text of each archived programme, page by page, extracted by `scripts/extract-programme-text.mjs`; `tests/promise-catalogue.test.mjs` checks that it is the text of the archived files, that every quote and recorded passage is its exact wording, and that together they account for the whole text of every programme.

## Promise source archive

`archive/promise-sources/manifest.json` has `schemaVersion: "1.0.0"` and an `entries` array. Each entry records `sourceId`, `originalUrl`, `retrievedUrl`, `retrievedAt` (UTC), `mediaType`, `byteLength`, `sha256`, and a repository-relative `path`. The original URL must match the source catalogue. Retrieval time records when this copy was downloaded, not proof that these bytes were already present on the source's publication date.

PDF copies are stored at `archive/promise-sources/<election-year>/<sourceId>/<sha256>.pdf`. Multiple versions of a source can coexist. These files are outside the site's `public/` directory; creating the archive does not change public links or add automatic fallback behavior.

`tests/promise-source-archive.test.mjs` validates the manifest schema, file hashes and lengths, PDF signatures, and coverage of the sources of every published item and rejected occurrence. Future source formats require a corresponding schema and validation update.
