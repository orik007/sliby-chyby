# Product vision

## Status of this document

This document separates confirmed product decisions from working proposals and open questions. It records the two imported planning conversations; it does not independently verify their time-sensitive market research.

## Confirmed vision

SlibyChyby will show what a specific political party promised before an election and whether its actual post-election conduct is consistent with that promise.

The project is not limited to a government's collective programme. It is party-oriented and should connect original campaign commitments with later evidence such as:

- parliamentary votes;
- bills and amendments;
- decisions by ministers;
- coalition agreements and compromises;
- official statements about intended action;
- enacted measures and measurable outcomes.

The first version is for ordinary visitors who want a quick, understandable account of a party's record. Complex analysis is not part of the initial scope. Detailed sourcing remains available to visitors who choose to inspect a promise.

Every proposed public explanation must use plain, natural Czech that an ordinary reader can understand without knowing parliamentary procedure, legal terminology, or the project's data model. It must make sense without surrounding audit context and say who did what and why that matters to the promise. Legislative identifiers remain available for traceability, but the first mention must explain what the proposal is and what it changes; a bare reference such as “tisk 201” is not sufficient.

A human-review document has two visibly separated audiences. Its public-copy section is the only candidate for later website publication and follows the strict reader-facing language rule. The remaining reviewer material may be more technical and may show internal values such as `moving-towards`, because it is never copied to the public site automatically. Reviewing or merging the document does not itself publish either section.

## Confirmed initial scope

- Start with the current electoral period.
- Initially show ANO, SPD, and Motoristé.
- Track party promises rather than only government-wide commitments.
- Include campaign programmes, posters, campaign statements, and other attributable original promises where they can be sourced precisely.
- Keep every promise within one electoral period.
- Preserve older periods as browsable history; do not roll promises or scores into a new period.
- Use the **SLAVA Index** name without diacritics for international typing and reuse.
- Build an AI-assisted research workflow, but do not rely on a single AI assessor.

## Product differentiation recorded in the research conversations

The intended differentiator is the complete traceable path:

`party promise -> coalition/government compromise -> proposal -> vote/decision -> enacted result -> observable outcome`

The imported research described Demagog.cz as a strong Czech neighbor focused on selected government-programme commitments. SlibyChyby is intended to differ by keeping the original party attribution, including campaign sources, and explicitly showing conduct that moves against a promise.

The research also identified international promise-tracking patterns under the label *Campaign Pledge Evaluation Tool (CPET)*. Useful examples recorded in the conversation were:

- [Istinomjer](https://istinomjer.ba/predizborna_obecanja/) for promise detail, evidence, and a distinct broken/contrary state;
- [CivicStat](https://www.civicstat.nl/) for connecting manifestos to parliamentary votes;
- [PolitiFact promise trackers](https://www.politifact.com/truth-o-meter/promises/) for original quotations and chronological assessment updates;
- [Polimeter](https://polimeter.org/) for period, party, topic, and status filtering;
- [RMIT Promise Tracker](https://www.rmit.edu.au/about/schools-colleges/media-and-communication/industry/promise-tracker) for distinguishing a broken promise from one blocked by circumstances or another actor.

These are research notes, not adopted feature requirements. Market-size and traffic claims from the original conversation must be reverified before publication or business use.

## Confirmed information hierarchy

The public interface must be understandable within seconds and work well on mobile.

### Home page

The confirmed concept contains:

1. a site title;
2. the selected electoral period;
3. three prominent, fully clickable party circles for ANO, SPD, and Motoristé;
4. the party leader's photograph within each circle;
5. the party's SLAVA Index shown prominently with a red-to-green scale, labelled `-100` on the left and `+100` on the right so the range is immediately visible.

The exact public site name remains unresolved.

### Party page

The confirmed concept contains:

- the party's SLAVA Index near the top;
- the number and distribution of tracked promises;
- a simple promise list or table;
- a symbol and a text label for every promise state;
- an expandable summary for explanation and evidence;
- a link to a full standalone promise detail.

The owner preferred directional arrows for in-progress states and a single check mark for completion. The current display concept is:

| Score | Symbol | Meaning |
|---:|:---:|---|
| `+2` | `✓` | Fulfilled |
| `+1` | `↗` | Moving towards fulfillment |
| `0` | `—` | No documented movement |
| `-1` | `↘` | Moving against the promise |
| `-2` | `×` | Acting against the promise |

Every symbol must also have a text label, and color must never be the only carrier of meaning.

The current product deliberately has no public “not assessable” status. If a real promise later cannot be placed on the five-point scale, the methodology will be reconsidered using that concrete case.

### Promise detail

The working content order is:

1. exact original promise wording and its primary source;
2. a short plain-language Czech explanation of who did what, what changed, and why it affects the promise;
3. decisive primary evidence such as a vote, law, budget, or official decision;
4. contextual reporting from news sources;
5. the last assessment date;
6. a timeline and prior assessment revisions.

This order is a **working proposal**, although the requirement for explanation, sources, voting links, and accessible history is confirmed.

## Confirmed automation direction

The system should monitor reliable news sources and public institutional data, match events to promises, and produce evidence-backed candidate assessments. Exhaustive manual research of post-election conduct is not the intended primary workflow.

The confirmed pipeline separates responsibilities:

1. an evidence collector discovers relevant official records and reliable reporting;
2. a matcher builds a bounded evidence package for a specific promise;
3. independent assessors evaluate only that supplied package under the versioned methodology;
4. an arbiter handles assessor disagreement;
5. validation and the current publication gate run before the result reaches the public site.

The evidence collector must not treat its own discovery ranking as a score. Assessors must cite supplied source identifiers and excerpts rather than silently performing an unrecorded search.

The owner explicitly required more than one AI assessor. The intended pattern is:

1. two independent assessors review the same evidence without seeing each other's answers;
2. if they agree and validation passes, the system produces a candidate assessment;
3. if they disagree, a third AI acts as arbiter;
4. unresolved cases go to a human.

The details of future model providers and confidence thresholds remain proposals. Publication always requires the confirmed owner approval described below.

An unambiguous Codex message from the owner that identifies the approved promise proposals is the confirmed editorial approval mechanism. The publication change must preserve that approval and still pass deterministic validation. A merge of an automated review proposal alone is not approval, and no AI-generated assessment is published automatically.

## Confirmed technical direction

The owner confirmed the following initial architecture. It may be revisited later if implementation evidence shows a need:

- Astro, TypeScript, and plain CSS for a mostly static public website;
- native HTML disclosure controls and minimal client-side JavaScript;
- versioned, schema-validated files as the first public data store;
- GitHub for source code, public data history, pull requests, and automated checks;
- Cloudflare Workers Static Assets for hosting;
- Cloudflare R2 for lawful archival copies of programmes, public documents, and campaign images;
- a database only when an editorial UI, concurrent writes, or a large automated event queue creates a real need;
- no live AI or database request during a normal public page view.

The one narrow runtime exception is source freshness: the site may read public GitHub Actions metadata and display the date of the latest successful complete collection. It uses a build-verified fallback if that metadata is temporarily unavailable. This endpoint does not collect evidence, score promises, or change published political data.

The earlier route structure was a working proposal. The current implementation uses Czech path names:

```text
/
/strany/{party-slug}
/sliby/{party-slug}/{promise-slug}
/metodika
```

The suggestion that every party and promise route should remain permanent and shareable is still a **working proposal**. The implemented paths are an observed current state, not a newly confirmed permanence requirement.

The site runs on production data and grows incrementally. Two ANO promises with primary sources and human-approved `+1` revisions form the initial published set. The SLAVA Index is calculated from all currently published promises and updates automatically as more reviewed records are added. Fictional fixtures do not belong in the production data directories.

## Out of scope for the first version

The conversations explicitly deprioritized:

- complex political-science analytics;
- user accounts;
- a public editorial CMS;
- a standalone application server;
- a dedicated search engine;
- live AI calls from the public website;
- automatic publication of unreviewed political assessments.

## Open product questions

- What is the public site name and subtitle? Suggestions such as “Sliby vlády” were not accepted as final.
- Which distribution summary belongs on the home page versus only on a party page?
