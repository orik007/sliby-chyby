# Current project rules

This document contains only the current confirmed rules. When a rule changes, replace this document and every implementation of the prior rule; do not keep superseded models, procedures, prompts, or decision records.

## Public identity

- The public brand is Sliboměr.
- The canonical public origin is `https://slibomer.cz`.
- Existing repository, Worker, and automation identifiers retain `sliby-chyby` until a separate infrastructure decision changes them.

## Promise catalogue

- A source is one verifiable item: one PDF, page, post, video, article, vote, or official record. It has an ID, type, title, publisher, URL, and any known date.
- A source can support many promises. A promise records its source ID and an exact locator, such as a PDF page, paragraph, or video timestamp.
- Every promise is exactly `candidate`, `confirmed`, or `rejected`.
- `confirmed` means public immediately. There is no confirmed-but-unpublished state.
- A rejected promise records its reason. Candidates and rejected promises are not public.
- The initial catalogue covers ANO 2011, SPD, and Motoristé sobě in the 2025 Czech Chamber of Deputies election, from official national party sources. Election programmes are promise sources, never evidence of conduct.

## Promise source archive

- Preserve the original files supporting catalogue promises in a versioned repository archive, independent of the automation audit branch. This includes the source catalogue for candidate and rejected promises.
- Record each copy's source ID, original URL, retrieval URL and time, byte length, and SHA-256 hash. Preserve downloaded bytes unchanged; changed source content receives a new copy rather than replacing an archived file.
- Public source links continue to point to the original publisher. An archived copy can be used as an explicitly labelled fallback if the original disappears, through the normal release process.

## Policy categories

- Every confirmed promise has exactly one common policy category from the controlled 2025 category list.
- The common category is decided for each promise from its exact commitment and source context. A party programme chapter is traceability metadata and never decides a category by itself.
- When one already-confirmed promise mentions several subjects, its category follows the principal action to be assessed; its exact wording remains unchanged.
- The public site groups and orders promises only by that common category. It does not display party-specific programme chapters as categories.
- The category mapping retains the original programme chapter, its order, and any verified narrower source section solely for source traceability and later maintenance.
- A category is a navigational subject label, not an editorial measure of importance.

## Evidence and conduct

- Only official records are evidence. A party's own website or publication, a press release, and the media are never evidence and are not collected.
- Evidence sources are added one at a time and only after their structure is verified against official documentation and real data, their completeness is measured, and their per-run quality checks exist. The canonical source list and data rules are in [evidence-pipeline.md](evidence-pipeline.md).
- The active source is the Chamber of Deputies. Government resolutions and the Collection of Laws follow in that order. The European Parliament and the Council of the EU come later; the Senate is not tracked now.
- Attributable conduct is: a decisive Chamber vote (by strict majority of the party's club), a member bill (every party with a proposing MP), a government proposal, government resolution, government regulation, or ministerial decree (every governing party on its date). The canonical table is in [scoring.md](scoring.md).
- A government decision is conduct of all governing parties together. The current government of ANO 2011, SPD, and Motoristé sobě was appointed on 15 December 2025.

## Scores and index

- Every confirmed promise has one current numerical score from `-2` to `+2`. The default is `0`, except for a verified maintenance baseline defined in [scoring.md](scoring.md).
- A proposal in line with or against the promise is `+1` or `-1`. A decision (a decisive vote, regulation, decree, or binding resolution) delivering or contradicting the whole promise is `+2` or `-2`, and only a part of it `+1` or `-1`. A decision outweighs a proposal; among conduct of the same weight, the most recent decides.
- A score is separate from the promise lifecycle and may change whenever attributable official evidence justifies a new current assessment.
- The SLAVA Index includes every confirmed promise of the party and is `round(sum(scores) / (2 × promise count) × 100)`. It ranges from `-100` to `+100`. No manual aggregate is stored.

## Evidence automation

- The daily workflow runs at 09:37 Europe/Prague and retains a manual trigger. It is paused until a manual run of the current pipeline has been verified end to end.
- It collects each active source from its own durable checkpoint, routes records to confirmed promises by direct legal-identifier links or two agreeing taggers, keeps only attributable conduct, and sends each new or changed bounded package to two independent assessors, with an arbiter when their valid assessments differ or exactly one output is invalid.
- Its output is an unpublished human-review proposal on a dedicated audit pull request. It never changes public data, a public score, or publication status. A human-approved score change is a separate scoped pull request.
- The assessors and arbiter may cite only supplied evidence IDs. Their active prompt versions, providers, model IDs, confidence, evidence IDs, and input fingerprint remain auditable, and the fingerprint prevents paid reassessment of unchanged input.
- A failed complete run does not advance public freshness.

## Delivery

- Changes for `main` use a pull request, exact-head verification, explicit owner approval (`schvaluji`), and a manual merge.
- Copilot and Codex reviews never start automatically. They run only after an explicit owner request for a specified pull request and head, and are advisory.
- Addressed review feedback receives a visible, item-by-item resolution before its corresponding line-review thread is resolved. The response protocol is defined in `release-process.md`.
- Only `main` deploys. The stack is Astro, TypeScript, plain CSS, and schema-validated versioned files.
