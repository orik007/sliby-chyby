# Data model

## Confirmed invariants

- A catalogue item belongs to one party in one electoral period. Repeated wording in a later period is a new item.
- Promises and statements are in `data/promises`; rejected occurrences are in `research/2025-election/rejected.json` and are never public ([promise-selection.md](promise-selection.md)).
- Every promise has one current score revision. The default score is `0` when no documented assessment conclusion sets another score, except for a documented maintenance baseline as defined in `scoring.md`. A statement has no score revision.
- Score revisions are append-only while the item is a promise ([promise-selection.md](promise-selection.md)). The latest revision is current.
- Every revision cites traceable source records or an evidence trail of official records. The SLAVA Index is derived, never stored as an editable value ([slava-index.md](slava-index.md)).
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
  changelog.json
```

A file in `data/promises` stores one item: `id`, `slug` (its URL), `partyPeriodId`, `kind` (`promise` or `statement`), `title`, `originalText` (the exact quote), `policyCategoryId`, `primarySourceId`, `sourceLocator` (the PDF page), `sourceOrder` (its position in the programme), and `isDemo`. A promise that is a maintenance commitment ([scoring.md](scoring.md)) also stores `maintenanceBaseline`: the preserved state in Czech (`preservedStateCz`) and its primary `source` (`id`, `url`, `publishedAt`, `locator`, `factSummary`, `primary`).

`AssessmentRevision` stores its score, public Czech explanation, date, and cited source IDs (`evidenceSourceIds`). A zero-default revision cites only the promise source and has no evidence trail; a documented maintenance baseline cites its supporting evidence directly.

A revision made from a reviewed assessment proposal ([evidence-pipeline.md](evidence-pipeline.md), From proposal to public score) also stores the `proposalId` it was made from and, when the assessment cites relevant law changes, its `evidenceTrail`: one entry per Chamber print, one per government regulation or ministerial decree, and one per government resolution (below). A print entry has the print number and its official page (`printUrl`), the cited relevant law changes of that print (`lawChangeId`, `headingCz`, `titleCz`, `amendedActs`), and the cited `steps` in order:

- `submission`: date, `evidenceId`, the kind of proposal (`member-bill`, `government-bill`, `state-budget`, `treaty`), and for a member bill the official proposer label;
- `government-opinion`: date (the Chamber's distribution of the opinion), `evidenceId`, the opinion (`agrees` or `disagrees`), the sub-print (`7/1`), and the link to its page;
- `vote`: date, `evidenceId`, the link to the vote, the official print-history stage and action, the club's result (`yes`, `no` for did not support, or `no-majority`), and the club's counts;
- `amendment`: date (its presentation in the second reading), `evidenceId`, its label in the summary (`labelCz`, “D1”), its parliamentary document (`documentNumber`), who presented it (`presenterCz`), and the link to the document's page;
- `amendment-vote`: date, `evidenceId`, the link to the vote, the amendment's label (with its variant), its parliamentary documents, who presented it, the link to the turn of the stenographic record that names it (`stenoUrl`), the club's result (`yes` or `no`), and the club's counts;
- `senate-resolution`: `evidenceId`, the sub-print (`77/7`), and the link to its text. It has no date, because the package dates it only by the vote that followed it.

A submission, a government opinion, an amendment, and a vote also name the version of the text they concerned (`proposed`, `approved`, `passed`), the link to that text, and `notes` naming the law changes for which the linked text is not exactly that version (`published-version-missing`, `removed`, `text-not-published`, `third-reading-rejection`, and `amended-proposal` for an amendment or a vote on one, which changes the proposed text) or is the act as promulgated, because psp.cz does not publish that version (`promulgated-text`); a step without a text link always has a note. Every link points to an official psp.cz record, except the link to such a text, which points to the act as promulgated in e-Sbírka (`https://e-sbirka.gov.cz/sb/<year>/<number>/0000-00-00`); the trail stores no text excerpt. A regulation entry (`kind: "regulation"`) is one cited relevant regulation or decree: its `lawChangeId`, its short citation (`citationCz`, “Nařízení vlády č. 16/2026 Sb.”), its `titleCz`, the link to its text as promulgated in e-Sbírka (`textUrl`, `https://e-sbirka.gov.cz/sb/<year>/<number>/0000-00-00`), and its `adoption`: date, `evidenceId`, whether the government or a ministry adopted it (`by`), and the issuer as its heading names it (`issuerCz`). A resolution entry (`kind: "resolution"`) is one cited relevant government resolution: its `lawChangeId`, its number (`numberCz`, “Usnesení vlády č. 330/2026”), the title of its material (`titleCz`), the link to its page in zVlády (`pageUrl`, `https://odok.gov.cz/portal/zvlady/usneseni/<year>/<number>/`), and its `adoption`: date and `evidenceId`. A revision with an evidence trail cites no other source record.

When the assessed package fit the models only without part of its context ([evidence-pipeline.md](evidence-pipeline.md), Package), the revision also stores `contextOmissions`: per law-change version and amended act, the print number, `lawChangeId`, `headingCz`, `titleCz`, `version`, the `act`, the wording's date of effect (`wordingFrom`, `null` for the act as promulgated) with a link to that wording in e-Sbírka (`wordingUrl`), the number of provisions whose wording the assessment had (`suppliedCount`), and the `provisions` it did not have, each with its citation and a link to it in that wording (`https://e-sbirka.gov.cz/sb/<year>/<number>/<wording>#<node path from the §>`). It is copied from the reviewed proposal and stores no text excerpt.

`changelog.json` holds the site changes page ([decisions.md](decisions.md)): `released`, dated entries (`date`, `items` in Czech) with unique dates, newest first, and `planned`, the features being prepared in Czech.

`promise-categories.json` contains the controlled common policy categories with their order; each item names its category in `policyCategoryId`.

`automation/topic-routing/promise-tags.json` maps every promise ID to its reviewed specific routing tags ([evidence-pipeline.md](evidence-pipeline.md)); statements have none.

`research/2025-election/rejected.json` lists every rejected occurrence with its `sourceId`, `locator`, exact `originalTextCz`, and `reason` code; a duplicate names the published item it repeats in `duplicateOf`. `research/2025-election/not-catalogued.json` lists every other programme passage with its `sourceId`, `locator`, exact `originalTextCz`, and `reason` code. `research/2025-election/programme-text/` holds the text of each archived programme, page by page, extracted by `scripts/extract-programme-text.mjs`; `tests/promise-catalogue.test.mjs` checks that it is the text of the archived files, that every quote and recorded passage is its exact wording, and that together they account for the whole text of every programme.

## Promise source archive

`archive/promise-sources/manifest.json` has `schemaVersion: "1.0.0"` and an `entries` array. Each entry records `sourceId`, `originalUrl`, `retrievedUrl`, `retrievedAt` (UTC), `mediaType`, `byteLength`, `sha256`, and a repository-relative `path`. The original URL must match the source catalogue. Retrieval time records when this copy was downloaded, not proof that these bytes were already present on the source's publication date.

PDF copies are stored at `archive/promise-sources/<election-year>/<sourceId>/<sha256>.pdf`. Multiple versions of a source can coexist. These files are outside the site's `public/` directory; creating the archive does not change public links or add automatic fallback behavior.

`tests/promise-source-archive.test.mjs` validates the manifest schema, file hashes and lengths, PDF signatures, and coverage of the sources of every published item and rejected occurrence. Future source formats require a corresponding schema and validation update.
