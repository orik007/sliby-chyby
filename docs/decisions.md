# Current project rules

This document contains only the current confirmed rules. When a rule changes, replace this document and every implementation of the prior rule; do not keep superseded models, procedures, prompts, or decision records.

## Public identity

- The public brand is Sliboměr.
- The canonical public origin is `https://slibomer.cz`.
- Existing repository, Worker, and automation identifiers retain `sliby-chyby` until a separate infrastructure decision changes them.

## Promise catalogue

- A source is one verifiable item: one PDF, page, post, video, article, vote, or official record. It has an ID, type, title, publisher, URL, and any known date.
- A source can support many catalogue items. An item records its source ID and an exact locator, such as a PDF page.
- The catalogue covers every statement of the official national programmes of ANO 2011, SPD, and Motoristé sobě for the 2025 Czech Chamber of Deputies election in which the party says what it will do, what it wants, what it rejects, or how something will be. Every other passage of a programme is recorded with its reason as not catalogued, so that the catalogue is checked against the whole programme text. Election programmes are promise sources, never evidence of conduct.
- Every catalogued item is exactly a `promise` (slib), a `statement` (výrok), or `rejected` (zamítnuto). A promise is an item that attributable conduct can deliver or contradict; it is public, scored, and counts in the SLAVA Index. A statement is an official item that no attributable conduct can deliver or contradict; it is public, has no score, and never counts in the index. A rejected occurrence is not public and records one technical reason code from [promise-selection.md](promise-selection.md): `duplicate`, `summary`, `list-estimate`, `not-party-statement`, or `truncated`.
- The party page shows statements only after the visitor turns on the statements filter; each statement is labelled as having no score. Every promise and statement has a public detail page with its exact quote and a link to the original programme at its page.
- A score revision made from an assessment shows its evidence trail on the promise detail page, for the current score and for every revision in its history: per Chamber print, the relevant law changes and the party's conduct on them (submission, club vote with its result, Senate return), each with a link to its official psp.cz record and the text it concerned. Only links are published, never text excerpts.
- An item's quote is the exact programme wording without layout artefacts; its title names the one commitment assessed, written only from facts in the quote. The canonical rule is [promise-selection.md](promise-selection.md).
- Routing tags of a promise are assigned once when it is catalogued and reviewed in its pull request; no model tags promises.

## Site changes page

- The public page `/zmeny` lists changes to the site's features by date, newest first, and, separately, the features being prepared. It is linked from the footer.
- It lists only what a visitor can use or see on the site: pages, functions, and disclosed limitations. It never lists catalogue content, score changes, or superseded rules; score changes stay in each promise's revision history.
- Its entries are in `data/changelog.json` and validated against its schema. A pull request that adds a visitor-facing feature adds its entry; a prepared feature moves from the prepared list to a dated entry when it is released.

## Promise source archive

- Preserve the original files of every catalogued source in a versioned repository archive, independent of the automation audit branch, together with their extracted text against which every quote is checked.
- Record each copy's source ID, original URL, retrieval URL and time, byte length, and SHA-256 hash. Preserve downloaded bytes unchanged; changed source content receives a new copy rather than replacing an archived file.
- Public source links continue to point to the original publisher. An archived copy can be used as an explicitly labelled fallback if the original disappears, through the normal release process.

## Policy categories

- Every promise and statement has exactly one common policy category from the controlled 2025 category list, decided from its exact wording.
- When one item mentions several subjects, its category follows the principal commitment named by its title.
- The public site groups promises only by that common category and orders them within it by current assessment status (fulfilled, moving towards, acting against, moving against, no verified progress) and then by their order in the programme. Shown statements follow the promises of their category in programme order.
- A category is a navigational subject label, not an editorial measure of importance.

## Evidence and conduct

- Only official records are evidence. A party's own website or publication, a press release, and the media are never evidence and are not collected.
- Evidence sources are added one at a time and only after their structure is verified against official documentation and real data, their completeness is measured, and their per-run quality checks exist. The canonical source list and data rules are in [evidence-pipeline.md](evidence-pipeline.md).
- The only source is the Chamber of Deputies.
- Attributable conduct is: a decisive Chamber vote (by strict majority of the party's club), a member bill (every party with a proposing MP), or a government proposal (every governing party on its date). The canonical table is in [scoring.md](scoring.md).
- A government proposal is conduct of all governing parties together. The current government of ANO 2011, SPD, and Motoristé sobě was appointed on 15 December 2025.

## Scores and index

- Every promise has one current numerical score from `-2` to `+2`. The default is `0`, except for a verified maintenance baseline defined in [scoring.md](scoring.md). A statement has no score and no score history. Score revisions are append-only while an item is a promise; a promise that becomes a statement or a rejected occurrence loses them.
- A proposal in line with or against the promise is `+1` or `-1`. A decision (a decisive vote) delivering or contradicting the whole promise is `+2` or `-2`, and only a part of it `+1` or `-1`. A decision outweighs a proposal; among conduct of the same weight, the most recent decides.
- A score is separate from the catalogue state and may change whenever attributable official evidence justifies a new current assessment.
- The SLAVA Index of a party is derived from the current scores of all its promises, which are exactly its scored promises on the public site. It ranges from `-100` to `+100`; its formula is in [slava-index.md](slava-index.md). No manual aggregate is stored.

## Evidence automation

- The daily workflow runs at 09:37 Europe/Prague and retains a manual trigger. It is paused until a manual run of the current pipeline has been verified end to end.
- Every run collects every active source completely from its `bootstrapFrom` date, so each package is built from the whole record history. The unit of evidence is a **law change**: one part of a print's official proposal text, usually the amendment of one act. The print only links a law change to the party's attributable conduct on it (its decisive votes and its submission). A law change has versions as the bill is debated (proposed, approved by the Chamber, passed by Parliament), and each conduct is judged against the version it concerned. Print texts are downloaded again in every run; only paid model results are cached.
- Two independent screeners read every law change in full, with no change dropped by rule; a change is substantive when either screener says so. A substantive change is routed to promises by direct legal-identifier links or by the specific tags of either screener, to the promises holding that tag in their reviewed routing tags, and a promise and change are kept unless two independent relevance checks both find them unrelated. Statements are never routed or assessed.
- A promise's package holds every kept law change in full with the party's conduct on it, without a count limit or excerpt selection; a package is assessed whatever its size and is reported for human review only when it is larger than the models can read; it is never trimmed. Each new or changed package, up to a per-run cap on paid assessments, goes to two independent assessors, with an arbiter when their valid assessments differ or exactly one output is invalid. Each assessor states for every law change in the package whether it is relevant to the promise and why.
- Its output is an unpublished human-review proposal on a dedicated audit pull request. It never changes public data, a public score, or publication status. A human-approved score change is a separate scoped pull request.
- Every AI request has its own prompt written only for that request, holding only what it needs. The assessors and the arbiter also receive [scoring.md](scoring.md) unchanged; no prompt restates its rules.
- The assessors and arbiter may cite only supplied evidence IDs. Their active prompt versions, providers, model IDs, confidence, evidence IDs, and input fingerprint remain auditable, and the fingerprint prevents paid reassessment of unchanged input.
- A failed complete run does not advance public freshness.
- When a rule change makes saved audit state (caches and queues) invalid, the pipeline generation changes and the next run starts from empty audit state. Old audit state is never repaired or reused.

## Delivery

- Changes for `main` use a pull request, exact-head verification, explicit owner approval (`schvaluji`), and a manual merge.
- Copilot and Codex reviews never start automatically. They run only after an explicit owner request for a specified pull request and head, and are advisory.
- Addressed review feedback receives a visible, item-by-item resolution before its corresponding line-review thread is resolved. The response protocol is defined in `release-process.md`.
- Only `main` deploys. The stack is Astro, TypeScript, plain CSS, and schema-validated versioned files.
