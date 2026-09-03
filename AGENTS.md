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

## Operational authorities

- Use `docs/promise-selection.md` to decide what enters the promise catalog.
- Use `docs/evidence-pipeline.md` for collection, matching, attribution boundaries, and publication separation.
- Use the five-step decision order in `docs/scoring.md` for every assessment. Do not create a parallel scoring checklist in implementation notes or prompts.
- Use `docs/decisions.md` as the historical decision register, not as an additional operational algorithm.

## Evidence and scoring integrity

- Preserve the exact original wording and source of every promise.
- For the first public version, admit only clear party commitments from official national party sources. Personal, regional, allied-party, and unadopted third-party commitments do not transfer into the party's index.
- When official pre-election wording changes, use the latest official version as the active promise. Retain earlier versions internally for audit, but do not show the change publicly in the first version.
- Publish a smaller fully verified promise set rather than padding coverage with vague or uncertain statements.
- Do not turn a vague statement into a more specific promise.
- Prefer primary sources. Media are primarily for discovery and context; a strong `+2` or `-2` should normally be verified against the underlying primary record.
- One promise has one current assessment. Keep contradictory evidence, judge significance, and never average evidence items into a score.
- Do not invent or implement an unscored public status until a real promise demonstrates the need. Revisit the methodology with that concrete case.
- Never store a manually edited aggregate SLAVA Index. Derive it from current assessable promise revisions.
- Calculate the public SLAVA Index from every currently published promise for the party and recalculate it whenever published data changes. If the party has no published promises, show the index as unavailable rather than zero.
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
- An unambiguous owner message in Codex that identifies the approved promise proposals is valid editorial approval. Preserve that approval in the publication change; a general acknowledgement such as `ok` is not sufficient.
- Use the stable assessment fingerprint for the changed-input gate. It includes assessable content, methodology, prompt hashes, providers, and model IDs; volatile run timestamps and collection IDs must not cause paid reassessment.

## Data and periods

- A promise belongs to exactly one party in exactly one electoral period.
- Do not carry a promise or its score into a later period. Repeated wording in a later election is a new promise.
- Retain historical periods and their assessment history.
- Resolve parliamentary-group membership at the vote date. Follow the exact strict-majority and decisive-motion rules in `docs/scoring.md`; do not infer party conduct from current membership, an unresolved vote, or bill authorship.

## Product and implementation

- Optimize the first view for quick comprehension and mobile use; place detailed evidence behind progressive disclosure.
- Keep the proposed public copy in every review visibly separate from technical reviewer notes. Only the public-copy section is a candidate for the website; review approval by itself does not publish it.
- Write every proposed public explanation in plain, natural Czech for an ordinary reader. It must make sense on its own and state who did what and how that affects the promise. Technical reviewer notes may use internal English enum values and project terminology when they are clearly separated from the public copy.
- Explain parliamentary and legal references on first use in proposed public copy. Never write a bare identifier such as “tisk 201”; identify the proposal and its practical meaning before or alongside the traceable number.
- Never rely on color alone. Pair color with a symbol and text label.
- Keep fictional fixtures out of the production data directories and never publish unverified real-world political claims.
- The confirmed initial stack is Astro, TypeScript, plain CSS, and schema-validated versioned files. Do not introduce a database without a demonstrated need and a confirmed decision.
- Validate all data relationships and make invalid data fail the build or validation step.
- Prefer the simplest architecture that preserves auditability, deterministic builds, and a future database migration path.
- Run the complete evidence pipeline once daily at 09:37 in `Europe/Prague`, while retaining the manual trigger. The public freshness date represents the last successful complete run and must never advance after a failed run.

## Scope control

- The initial product is a clear public tracker, not a complex political-science analytics suite.
- Keep research automation separate from the public website runtime.
- Do not add accounts, a CMS, a live public AI endpoint, a database, or a search engine without a demonstrated need and a confirmed decision.
