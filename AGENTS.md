# Project instructions

## Purpose

SlibyChyby tracks what political parties promised before an election and compares those promises with the parties' subsequent actions and outcomes. The public experience must stay simple, while every assessment remains traceable to evidence.

## Communication and repository language

- Write repository content, code, identifiers, comments, and documentation in English.
- Communicate with the project owner in Czech unless asked otherwise.
- Preserve exact Czech quotations from political sources. Do not translate a quotation and present it as original wording.

## Decision discipline

- Treat `docs/decisions.md` as the decision register.
- Clearly label material as **Confirmed decision**, **Working proposal**, or **Open question**.
- Do not silently promote a proposal to a decision or resolve an open question.
- If new evidence conflicts with a recorded decision, document the conflict before changing behavior.
- Do not infer product requirements from assistant suggestions in historical conversations unless the owner explicitly accepted them.

## Evidence and scoring integrity

- Preserve the exact original wording and source of every promise.
- For the first public version, admit only clearly attributable party commitments from official national party sources. Do not turn a politician's personal promise, a regional commitment, or an allied-party candidate's promise into a national party promise.
- A candidate from another party running on a party's electoral list does not transfer their own party's promises into the tracked party's SLAVA Index. Include such wording only when the tracked party officially adopts it as its own commitment.
- When official pre-election wording changes, use the latest official version as the active promise. Retain earlier versions internally for audit, but do not show the change publicly in the first version.
- Publish a smaller fully verified promise set rather than padding coverage with vague or uncertain statements.
- Do not turn a vague statement into a more specific promise.
- Prefer primary sources for both the promise and the party's subsequent action.
- Use media articles primarily for discovery and context. A strong `+2` or `-2` assessment should normally be verified against a primary source.
- Keep all relevant evidence, including contradictory votes or actions. Do not average evidence into a score.
- One promise has one current assessment. Votes, articles, laws, and statements are evidence for that assessment, not independently scored items.
- Do not invent or implement an unscored public status until a real promise demonstrates the need. Revisit the methodology with that concrete case.
- Never store a manually edited aggregate SLAVA Index. Derive it from current assessable promise revisions.
- Display the aggregate as index points without a percent sign, for example `SLAVA Index: +14`.
- Never overwrite published assessment history silently. Add a new revision and retain prior revisions.
- Record uncertainty and competing interpretations rather than manufacturing certainty.

## AI workflow

- AI output is a proposal backed by supplied source identifiers and excerpts, not an authority.
- Treat automated evidence collection and candidate scoring as the intended primary workflow. Keep evidence discovery, promise matching, and scoring as distinct auditable stages.
- The intended workflow uses two independent assessors and a third arbiter when they disagree.
- Models may cite only evidence supplied to them. Reject invented source IDs, quotations, or unsupported claims.
- Do not publish AI-generated political assessments automatically unless a later confirmed decision explicitly permits it.
- Keep model, prompt/methodology version, evaluation time, evidence IDs, and confidence available for audit.
- Persist automated assessment output only as an unpublished human-review proposal under `automation/review-proposals`. Merging such a proposal preserves its audit and does not authorize publication or a public-data change.
- Use the stable assessment fingerprint for the changed-input gate. It includes assessable content, methodology, prompt hashes, providers, and model IDs; volatile run timestamps and collection IDs must not cause paid reassessment.

## Data and periods

- A promise belongs to exactly one party in exactly one electoral period.
- Do not carry a promise or its score into a later period. Repeated wording in a later election is a new promise.
- Retain historical periods and their assessment history.
- Determine an elected representative's relevant party or parliamentary-group membership at the date of a vote, not from current membership alone.
- Attribute positive or negative Chamber conduct only when more than half of all time-resolved parliamentary-group members cast the same `yes` or `no` choice. Retain abstentions, non-votes, absences, and excuses in the denominator and audit. At a verified decisive vote on a motion that directly and materially advances the party's own promise, failure to provide a strict-majority `yes` is a `moving-against` candidate rather than ordinary inactivity. Do not apply that penalty to merely similar, procedural, ambiguous, or materially mixed motions. Do not attribute voided, manual, technically incomplete, or context-unresolved votes.
- Do not require the tracked party to have authored or sponsored a bill before using its verified vote. Decisive party voting conduct is relevant regardless of who introduced the bill.

## Product and implementation

- Optimize the first view for quick comprehension and mobile use; place detailed evidence behind progressive disclosure.
- Never rely on color alone. Pair color with a symbol and text label.
- Clearly mark fabricated or placeholder political data as demo data.
- Do not present unverified real-world political claims as demo content.
- During the current documentation phase, do not implement the website. Implementation requires a later explicit request.
- The confirmed initial stack is Astro, TypeScript, plain CSS, and schema-validated versioned files. Do not introduce a database for the initial demo.
- When implementation begins, validate all data relationships and make invalid data fail the build or validation step.
- Prefer the simplest architecture that preserves auditability, deterministic builds, and a future database migration path.

## Scope control

- The initial product is a clear public tracker, not a complex political-science analytics suite.
- Keep research automation separate from the public website runtime.
- Do not add accounts, a CMS, a live public AI endpoint, a database, or a search engine without a demonstrated need and a confirmed decision.
