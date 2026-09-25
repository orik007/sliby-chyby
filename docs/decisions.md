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
- The SLAVA Index of a party is derived from the current scores of all its confirmed promises, which are exactly its promises on the public site. It ranges from `-100` to `+100`; its formula is in [slava-index.md](slava-index.md). No manual aggregate is stored.

## Evidence automation

- The daily workflow runs at 09:37 Europe/Prague and retains a manual trigger. It is paused until a manual run of the current pipeline has been verified end to end.
- Every run collects every active source completely from its `bootstrapFrom` date, so each package is built from the whole record history. The unit of evidence is a **law change**: one part of a print's official proposal text, usually the amendment of one act. The print only links a law change to the party's attributable conduct on it (its decisive votes and its submission). A law change has versions as the bill is debated (proposed, approved by the Chamber, passed by Parliament), and each conduct is judged against the version it concerned. Print texts are downloaded again in every run; only paid model results are cached.
- Two independent screeners read every law change in full, with no change dropped by rule; a change is substantive when either screener says so. A substantive change is routed to confirmed promises by direct legal-identifier links or two agreeing taggers, and a promise and change are kept unless two independent relevance checks both find them unrelated.
- A promise's package holds every kept law change in full with the party's conduct on it, without a count limit or excerpt selection; a package too large to assess at the normal price is reported for human review, never trimmed. Each new or changed package, up to a per-run cap on paid assessments, goes to two independent assessors, with an arbiter when their valid assessments differ or exactly one output is invalid. Each assessor states for every law change in the package whether it is relevant to the promise and why.
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
