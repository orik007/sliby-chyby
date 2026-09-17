# Topic routing and assessment design

## Status

This document records the agreed target design for replacing the legacy exact-phrase and globally capped semantic candidate routing. It is a migration design, not a second active evidence-pipeline rule. Until the implementation, tests, workflow, and canonical evidence-pipeline rule change together, the live workflow remains governed by [evidence-pipeline.md](evidence-pipeline.md).

The target design must be implemented as one replacement. It must not leave the legacy top-three semantic route as an alternative that can suppress a tag-routed or directly linked candidate.

## Objective

Slibomer has exact confirmed promises and collected source records. A source record can be a parliamentary vote, parliamentary print, enacted law, government publication, party publication, or discovery record from media. It is not necessarily a political statement or evidence of conduct.

The target process must reliably route potentially relevant primary records to every applicable promise, then let the existing score methodology decide the result. It must:

- preserve exact promise text and source;
- allow one source record to relate to more than one promise;
- keep routing separate from relevance, attribution, score, and publication;
- make an unclassified or uncertain primary record visible for review rather than treating it as no progress;
- bound model calls and retain fingerprints so unchanged work is not paid for again; and
- keep all automated assessment output unpublished until a human approves a separate public assessment revision.

The score meanings and decision order remain defined only in [scoring.md](scoring.md).

## Controlled topic taxonomy

Public policy categories remain the public navigation taxonomy. They are not sufficient for routing and are not changed by this design.

The routing taxonomy is a separate, versioned, controlled vocabulary. Each tag has:

- a stable identifier and optional parent;
- an English definition for humans and model instructions;
- inclusion and exclusion examples;
- centrally managed Czech aliases and legislative expressions;
- optional direct legal identifiers or structured-source mappings; and
- a taxonomy version.

For example, `public-finance` may contain `fiscal-responsibility`, which may contain `deficit-and-debt`, `fiscal-rules`, and `debt-brake`. A broad parent tag alone never creates an assessment candidate. A candidate requires a shared sufficiently specific tag, a configured parent-child rule, or a direct structural legal link.

Models may select only existing tag identifiers or `unknown`. They may never create tags at runtime. Adding, deleting, moving, or redefining a tag is a reviewed taxonomy change. The change records the affected taxonomy subtree so all dependent promise and source classifications can be recomputed consistently.

## Records and routing decisions

The operational audit stores these distinct objects:

| Object | Meaning |
| --- | --- |
| Promise topic assignment | Controlled routing tags assigned to one confirmed promise. |
| Source topic assignment | Controlled routing tags assigned to one collected source record or enriched official document. |
| Routing decision | The reason a source-promise relationship was created, reviewed, or not created. |
| Evidence package | A bounded set of primary evidence for one promise, ready for assessment. |
| Assessment proposal | Unpublished assessor and arbiter output for human review. |

A source assignment and a promise assignment record the taxonomy version, input-content hash, prompt version, provider, model, returned confidence, selected tags, supporting source excerpts, and any `unknown` or disagreement result.

Every material primary source record receives one routing disposition:

- `candidate-created`: one or more assessable source-promise relationships were created;
- `routing-review`: a possible relationship is uncertain and requires human routing review;
- `orphan-review`: no safe topic assignment or matching promise was found; or
- `not-conduct-evidence`: the record is not eligible to establish party conduct, with the reason recorded.

None of these dispositions is a score or a conclusion that a promise has no progress.

## Target process

### 1. Collect and normalize

The robot collects records only from allowlisted sources, keeps source-specific checkpoints, preserves provenance and content hashes, deduplicates records, and records source type and primary status.

For parliamentary votes it derives structured facts from the official source: the motion, result, time-resolved party-group membership, each member's vote, and the strict-majority calculation. This is factual normalization, not an attribution or score decision.

Media and other discovery records may locate an official record. They cannot alone establish conduct evidence where a primary record should exist.

### 2. Resolve and enrich official documents before routing

Before final topic routing, the robot resolves linked parliamentary prints, enacted laws, and other official documents for every material primary record. It stores official document references and extracts bounded, locatable text.

Structured official facts, such as linked prints, changed acts, parliamentary descriptors, vote counts, and enactment status, remain separate from any AI-written explanatory text. An optional short AI source brief may only summarize supplied source excerpts; it never replaces the original document or establishes legal effect.

### 3. Assign promise topics

For the initial taxonomy pass, two independent taggers propose controlled tags for each confirmed promise from its exact wording and source context. A human reviews the taxonomy and the assignments required by the routing policy. The accepted assignment is cached and versioned.

On a later taxonomy change, the system recomputes every assignment under the affected subtree and every relevant `unknown` assignment. Changing a parent definition or its aliases recomputes the complete parent subtree. It must not patch a single promise or a single parliamentary print in isolation.

### 4. Assign source topics

The robot first applies direct structural mappings and the central alias registry. A direct match is a routing signal, not a score or attribution conclusion.

Where deterministic signals do not make the assignment safe, two independent taggers receive a bounded routing brief containing only official source metadata, locatable source excerpts, and the controlled taxonomy definitions. Each returns existing tags or `unknown`, supporting excerpts, and confidence.

Model confidence is retained for audit but is not a sufficient decision rule by itself. Routing state combines direct evidence, tag specificity, and agreement between independent taggers:

| Routing state | Requirement | Next step |
| --- | --- | --- |
| Auto-candidate | Direct structural link, or both taggers agree on a sufficiently specific tag | Create candidate relationships. |
| Routing review | One tagger only, disagreement, weak support, or other ambiguous classification | Human reviews the routing decision before assessment. |
| Orphan review | `unknown`, no controlled tag, or no matching promise after a safe assignment | Human reviews taxonomy or source coverage. |

The union of all proposed relationships is retained in audit data. The auto-candidate rule only controls which relationships may consume assessor calls without prior routing review.

### 5. Create candidate relationships

The robot uses an inverted index from controlled tags and direct legal references to promise identifiers. A source may create relationships to several promises. It records every route basis, including tag identifiers, direct references, structured-source signals, and any semantic discovery signal.

Embeddings may remain a discovery aid, but they cannot suppress a relationship created through tags or direct evidence. No global top-N result may determine that a tag-routed relationship disappears.

### 6. Build bounded evidence packages

The robot builds a package only from primary, attributable evidence where possible. It includes the exact promise and promise source, relevant current public assessment context, the collected conduct evidence, official document excerpts, and structured vote facts needed to apply [scoring.md](scoring.md).

The package has an explicit evidence and token budget. If relevant material exceeds the budget, the system partitions it or creates a human-review case. It does not silently discard evidence. Every omitted item and reason remains in the routing audit.

A vote that lacks the strict majority or decisive-motion conditions is recorded as such and does not become attributable party conduct merely through tag matching.

### 7. Assess packages

Two independent assessors receive each new or changed eligible package. They decide material relevance, attribution, the factual effect of the supplied evidence, and a proposed current status using only the bounded package and [scoring.md](scoring.md).

The topic taxonomy, tag definitions, routing confidence, and retrieval scenarios are not scoring criteria and do not enter the assessor's promise test. The assessor may cite only evidence identifiers supplied in the package.

When valid assessors disagree, or exactly one assessor output is invalid, an arbiter applies the existing arbitration rule. Two invalid outputs remain private failure audit data and are eligible for later retry. No model output changes public data.

### 8. Human review, release, and index

Human routing review resolves taxonomy and candidate-routing uncertainty. Human assessment review decides whether an unpublished proposal justifies a public score change.

An approved public conclusion is prepared in a separate scoped pull request based on current `main`. That pull request adds an append-only assessment revision with cited public sources and follows [release-process.md](release-process.md). The audit branch is never merged and an audit review is not release approval.

The robot derives the current score and the SLAVA Index from published assessment revisions. It never stores or edits a manual aggregate.

## Separation of responsibilities

| Actor | May do | Must not do |
| --- | --- | --- |
| Robot | Collect, hash, normalize, resolve official references, derive vote facts, route by stored rules, package, fingerprint, validate, and calculate the index | Infer political relevance, party attribution, legal effect, score, or publication. |
| Tagging AI | Select controlled routing tags from supplied evidence and flag uncertainty | Invent a tag, create a score, or provide evidence outside the supplied record. |
| Assessment AI | Propose a conclusion from one bounded package under the canonical scoring rule | Browse, add evidence, publish a score, or treat routing metadata as a scoring criterion. |
| Human | Approve taxonomy changes, resolve routing uncertainty, decide public assessment revisions, and approve releases | Treat an orphan or a missing candidate as zero points. |

## Pilot and acceptance cases

The first implementation pass is a tagging and routing pass, not an assessment pass. It may use cached tagging AI but sends no evidence packages to assessors or arbiters.

The pilot must produce an unpublished report with counts of source records, material primary records, direct assignments, agreed assignments, routing reviews, orphan reviews, candidate relationships, predicted packages, and token usage by model and pass.

It must contain both positive and negative deterministic fixtures:

- A fiscal-responsibility fixture based on the exact promise `candidate-d5359e35a4c4`, with official-document and vote inputs sufficient to prove that routing creates a candidate relationship. It must not assert a score; scoring remains an assessor and human-review question.
- A public-finance fixture that shares only the broad parent category, such as a tax measure, and proves that it does not create a fiscal-responsibility candidate.
- An `unknown` fixture proving that a material primary record becomes visible in orphan review rather than being recorded as no candidate match.

The pilot is accepted only when the fixtures pass and the owner has reviewed the real routing report and the expected assessor budget.

## Token budget model

The initial backfill is distinct from a daily incremental run. The following are planning ranges, not a cost commitment:

| Pass | Unit | Planning range |
| --- | --- | --- |
| Taxonomy drafting | Whole catalogue | 0.1–0.3 million input tokens. |
| Promise tagging | 610 promises, two taggers | 1.8–3.1 million input and 0.12–0.25 million output tokens. |
| Embedding discovery | 13,000 record briefs | 3–7 million embedding input tokens. |
| Source tagging | 4,000 material primary records, two taggers | 14–22 million input and 0.8–1.6 million output tokens. |
| Assessment | One changed package | Two assessor calls, each approximately 5–8 thousand input and 0.5–1 thousand output tokens; an arbitration call only on disagreement or one invalid result. |

The pilot measures the actual material-primary-record count and package count before any paid assessment pass. Daily runs process only new or changed records and fingerprints prevent repeated calls for unchanged inputs.

## Migration gate

Before the target procedure replaces the live matcher, one implementation change must update the canonical decisions, evidence-pipeline rule, data model, workflow, validation, prompts, and retired exact/top-N semantic routing artifacts together. It must also preserve auditable operational state or provide an explicit validated migration.

Until that replacement has passed its fixtures and review, the legacy workflow must not be described as using this target procedure.
