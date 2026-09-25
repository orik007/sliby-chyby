# Data model

## Confirmed invariants

- A promise belongs to one party in one electoral period. Repeated wording in a later period is a new promise.
- Only confirmed promises are in `data/` and visible publicly.
- Every confirmed promise has one current score revision. The default score is `0` when no documented assessment conclusion sets another score, except for a documented maintenance baseline as defined in `scoring.md`.
- Score revisions are append-only. The latest revision is current.
- Every revision lists traceable source records. The SLAVA Index is derived, never stored as an editable value ([slava-index.md](slava-index.md)).
- A source is one document or record. A promise references one source and an exact locator.
- Candidate and rejected promises remain in `research/`; a rejected promise has a reason.

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

`Promise` stores its exact original wording, party period, primary source, and source locator. `AssessmentRevision` stores its score, public Czech explanation, date, and cited source IDs. A zero-default revision cites the promise source; a documented maintenance baseline or other assessment conclusion cites its supporting evidence directly.

`promise-categories.json` contains the controlled common policy categories and exactly one explicit, promise-level mapping for every confirmed promise. A mapping is decided from the exact commitment and source context; it includes the original programme chapter and optional verified source-section metadata for traceability. The public interface uses only the common category label.

`research/2025-election/promises.json` contains the campaign-source catalogue and non-public promises. Its `sources` list contains one record per source document. Every research promise has a `sourceId`, a locator, exact wording, and one status: `candidate`, `confirmed`, or `rejected`.

## Promise source archive

`archive/promise-sources/manifest.json` has `schemaVersion: "1.0.0"` and an `entries` array. Each entry records `sourceId`, `originalUrl`, `retrievedUrl`, `retrievedAt` (UTC), `mediaType`, `byteLength`, `sha256`, and a repository-relative `path`. The original URL must match the source catalogue. Retrieval time records when this copy was downloaded, not proof that these bytes were already present on the source's publication date.

PDF copies are stored at `archive/promise-sources/<election-year>/<sourceId>/<sha256>.pdf`. Multiple versions of a source can coexist. These files are outside the site's `public/` directory; creating the archive does not change public links or add automatic fallback behavior.

`tests/promise-source-archive.test.mjs` validates the manifest schema, file hashes and lengths, PDF signatures, and coverage of all public promises' primary sources and the research promise source catalogue. Future source formats require a corresponding schema and validation update.
