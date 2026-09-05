# Project guide

## Purpose and authority

This is the cold-start guide for SlibyChyby. A new contributor or a new conversation should be able to read this file, follow its links, and understand why the project exists, what is public, how information moves through the system, and where human approval is required.

This guide summarizes existing confirmed decisions. It does not replace the canonical rules:

- [decisions.md](decisions.md) records accepted decisions, working proposals, and open questions;
- [promise-selection.md](promise-selection.md) decides which campaign statements qualify as promises;
- [scoring.md](scoring.md) defines the SLAVA assessment states and decision order;
- [evidence-pipeline.md](evidence-pipeline.md) controls post-election collection, matching, assessment, and publication boundaries;
- [data-model.md](data-model.md) defines the domain entities and storage direction;
- [release-process.md](release-process.md) controls approval, merge, and deployment.

If this summary conflicts with one of those documents, stop and record the conflict in [decisions.md](decisions.md) before changing behavior.

## Why the project exists

SlibyChyby helps ordinary people compare what a political party promised before an election with what that party later did. It does not judge whether a policy is good or bad. It asks whether the party's conduct and results are consistent with its own attributable promises.

The public experience is intentionally simple: show the promise, its current five-state assessment, a plain Czech explanation, and the evidence. The audit trail behind that result remains detailed enough to reproduce and challenge the assessment.

The current period is the 2025 Czech Chamber of Deputies election. The confirmed initial party scope is ANO 2011, SPD, and Motoristé sobě. Collective coalition and government programmes may be later evidence, but they are not substitutes for each party's original pre-election promises.

## The complete operating model

There are two distinct collection processes. They must not be confused.

```text
PRE-ELECTION PROMISE CATALOGUE
official national party sources
  -> broad research extraction
  -> human promise-selection review
  -> reviewed matching catalogue
  -> separately approved public promise data

POST-ELECTION EVIDENCE PIPELINE
allowlisted official records and news discovery feeds
  -> one shared daily collection
  -> deterministic matching against every reviewed promise
  -> if no attributable primary candidate evidence: planned bounded official-source expansion
  -> bounded evidence packages and official-document enrichment
  -> assessor A + assessor B
  -> if both are insufficient: planned bounded official-source expansion
  -> assessment or reassessment only when assessable content changed
  -> arbiter only when they disagree
  -> unpublished human-review proposal
  -> explicit owner publication approval
  -> versioned public assessment revision
  -> derived SLAVA Index

DELIVERY
proposed repository change
  -> Verify pull request for the exact head commit
  -> first GitHub Copilot + Codex review wave
  -> one consolidated remediation commit when material findings exist
  -> final second Copilot + Codex review wave
  -> no third review wave; material final-wave findings move to a new PR
  -> owner says `schvaluji` for that exact revision
  -> merge to `main`
  -> Cloudflare Workers build and deployment
```

Collection never equals publication. A source occurrence is not automatically a promise, a matched record is not evidence direction, an AI answer is not an approved assessment, and merging an automated review proposal does not publish it.

## How promises enter the project

### 1. Capture broadly

Research searches official national party programmes, official campaign sites and publications, and other official national party channels. Archived copies and secondary discovery sources may help recover an original, but a media paraphrase is not the promise source.

Research material belongs under `research/`. It is intentionally over-inclusive and unpublished.

### 2. Admit narrowly

A statement enters the reviewed promise catalogue only when it passes every confirmed rule in [promise-selection.md](promise-selection.md). In brief, it must:

- be an official national commitment of the tracked party;
- promise a concrete future action, decision, or assessable outcome;
- contain a clear object and direction;
- support a one-sentence test for evidence that would advance it and evidence that would contradict it;
- preserve only the precision present in the source;
- contain one independently assessable commitment, or be split into atomic promises while retaining its source context.

Vague slogans, values, aspirations, personal promises, regional promises, and commitments belonging only to allied-party candidates stay outside the party's SLAVA Index. Rejected and unresolved occurrences remain in the research audit with reasons; they do not become zero-point promises.

When official pre-election wording changes, the latest official version is active. Earlier versions remain internal audit material. Exact Czech quotations, the official source URL, and a precise page, timestamp, or image locator must be preserved.

### 3. Keep review, matching, and public data separate

- `research/2025-election/` contains captured sources, candidates, review decisions, duplicates, rejections, and coverage gaps.
- `automation/matching/promises.json` contains reviewed promises used by the matcher. Inclusion here does not publish or score a promise.
- `data/` contains the smaller human-approved public dataset rendered by the website.

Do not infer public coverage from the size of the research queue or matching catalogue. The current authoritative counts are derived from those files and validation, not copied manually into this guide.

## How later conduct is collected

The complete evidence pipeline runs once daily at `09:37` in `Europe/Prague` and can also be started manually. Its GitHub Actions workflow is `.github/workflows/collect-evidence.yml`.

Collectors are source-oriented. A run downloads each enabled allowlisted source once and normalizes a shared record set before any promise-specific work. The authoritative source registry and its enabled or deferred status are documented in [evidence-pipeline.md](evidence-pipeline.md) and stored in `automation/collectors/sources.json`.

The registry currently covers:

- Chamber of Deputies votes, individual choices, parliamentary prints, print history, and historical parliamentary-group membership;
- selected official government and ministry news or press-release archives;
- technically stable official party news channels;
- iROZHLAS, ČT24, Seznam Zprávy, and Novinky.cz feeds or news indexes for discovery and context.

Official records are preferred for decisive facts. News sources help discover and explain an event, but collection from a familiar publisher does not establish that the event occurred as described or determine a score. Full news article bodies are not stored.

Collectors enforce configured hosts, media types, and size limits. They record response and record hashes, provenance, and coverage metadata for audit. A failed run does not change published assessments or advance the public last-successful-collection date.

## How evidence is matched and checked

### Deterministic matcher

The matcher compares the shared collected record set with every reviewed promise. One record may match several promises. It exposes the phrases and official identifiers that caused each candidate match. It does not decide whether the record supports or contradicts the promise.

A bounded evidence package is created only when the attribution and primary-evidence boundary is satisfied. Media-only or merely thematic matches remain visible in the audit but do not silently become assessable evidence. A run with no match creates no new automated assessment; any existing published assessment revision remains current. Absence of a match is not proof of inactivity and is never converted into zero points.

For matched parliamentary prints, deterministic enrichment retrieves the official document, records its content hash, and selects bounded numbered passages. This reveals proposal substance but does not establish party authorship, support, passage, or legal effect.

The planned deterministic evidence-gap resolver will retrieve bounded deeper records only from enabled configured official source scopes. It will start when inventory matching produces no attributable primary candidate evidence, or when both assessors identify a package as insufficient. It cannot score, publish, browse the general web, or run indefinitely; an unchanged or exhausted expansion remains an unpublished human-review case.

### Two assessors and one arbiter

Two stateless AI assessors independently receive the same bounded package. They cannot browse and may cite only source identifiers and excerpts in that package. Each produces a structured proposed state, evidence references, confidence, and plain Czech public copy.

The current pilot configuration uses two separate `gpt-5.6-terra` calls. If the assessors disagree on the state or on whether the evidence is sufficient, `gpt-5.6-sol` acts as arbiter. The arbiter may select one supplied review or return that it cannot decide; it cannot invent a third assessment or add evidence. Provider calls are behind an adapter so the second assessor can later move to another provider without changing the rest of the system.

Models, prompts, evidence-package content, hashes, timestamps, and arbitration are retained for audit. Credentials exist only in the GitHub `assessment` environment or another server-side secret store. The public browser never receives an AI key and never runs assessment.

### Human review and publication

Automated results are stored under `automation/review-proposals/` with `humanReviewRequired: true` and `publicationApproved: false`. The workflow writes new or changed proposals to the dedicated `automation/assessment-review` branch and prepares a review pull request.

The review page separates:

- `Návrh pro veřejný web` — the only candidate public wording, written in plain self-contained Czech;
- technical reviewer material — evidence, internal state names, models, hashes, and disagreements.

If assessors agree, the shared conclusion is shown once to the reviewer while both raw outputs remain in the audit. If they disagree, both opinions and the arbiter result remain visible.

Merging this review pull request preserves the unpublished audit only. Publication requires a separate unambiguous owner approval identifying the specific proposals. The resulting public `AssessmentRevision` must link to that approved proposal and retain immutable history. No AI assessment changes `data/`, the public website, or the SLAVA Index automatically.

## How scoring works

Each public promise has one current assessment:

| Score | Meaning |
| ---: | --- |
| `+2` | The whole promised result or exact promised conduct occurred. For a legislative promise, this also includes the party's strict-majority `yes` on a verified, valid, decisive substantive motion covering the full measure, even if another actor introduced it or other parties caused it to fail. |
| `+1` | A meaningful concrete step advances a real part of the promise. |
| `0` | No documented meaningful movement during the live period. |
| `-1` | Documented conduct moves against the promise, or a verified direct decisive opportunity to support the exact promise was missed under the strict vote rule. |
| `-2` | A significant direct violation, definitive contrary result, or the exact conduct that the party promised not to perform occurred. |

Negative points mean that the party acted against its own promise; they are not a general judgment of the policy. During the live period, elapsed time alone does not change `0`. At the one-time closing audit, a promise untouched for the entire period becomes `-1`. The closing audit is not implemented yet.

One promise has one score. Articles, votes, laws, decisions, and statements are evidence for that assessment, not separately scored items. Contradictory evidence is preserved and judged by significance rather than averaged.

For Chamber votes, party conduct is attributed only under the exact strict-majority and decisive-motion rules in [scoring.md](scoring.md). Bill authorship is irrelevant to the party's verified vote. Other primary acts such as regulations, executive decisions, administrative acts, and authoritative outcome data can also support decisive assessments.

The public aggregate is derived, never manually edited:

```text
SLAVA Index = sum(current published promise scores) / (2 * published promise count) * 100
```

It ranges from `-100` to `+100` and is displayed without a percent sign. A party with no published promises has no index rather than an index of zero.

## Public website rules

The website is designed for quick comprehension on mobile. It shows only reviewed production records from `data/`; research candidates and automated proposals are never rendered as public facts.

Every public state uses a symbol, text, and color rather than color alone. Public Czech explains who acted, what happened, what changed, and why it matters to the promise. A bare internal value such as `moving-towards` or an unexplained legislative identifier such as `tisk 201` must never appear as the explanation.

Assessment history is append-only. A correction creates a new revision rather than silently overwriting the old one. The site reads no database and makes no live AI call during ordinary page views. Its narrow server endpoint only exposes the last successful complete collection time, with a verified build-time fallback.

The initial implementation uses Astro, TypeScript, plain CSS, schema-validated versioned files, and Cloudflare Workers Static Assets. Invalid relationships fail validation or the build.

## Pull requests, approval, and deployment

Every pull request targeting `main` is checked by `.github/workflows/verify-pr.yml`, which runs tests, validation, the production Astro build, and a Cloudflare deployment dry run.

Every pull request has at most two advisory AI review waves. GitHub Copilot is requested as a pull-request reviewer, which is the supported code-review mechanism; a plain mention is not treated as a review request. Codex reviews pull requests automatically and can be asked to review the exact head for a review wave with `@codex review`. The first wave covers a locally validated ready head. Material valid findings are fixed together in one consolidated remediation commit, which receives the final second wave; if the first wave has no material remediation, its head is final. A material valid finding from that final wave blocks the pull request and moves to a new pull request; it does not start a third review wave. Non-applicable or non-material final-wave findings receive a concise evidence-based disposition. Addressable review threads are replied to and resolved after handling, while the disposition of summary-only or suppressed findings is recorded in the pull-request conversation.

A cloud ChatGPT approval conversation presents the pull request only after `Verify pull request` and both reviews cover the exact final review-wave head. It includes the commit, summary, and outstanding review information. The owner must reply `schvaluji` for that exact revision. A new commit invalidates the approval. AI reviews are quality advice and never substitute for this owner decision.

Cloudflare Workers Builds watches only `main`. A merge triggers `npm run build` followed by `npx wrangler deploy --config wrangler.deploy.jsonc`. Preview branch deployments are disabled so unpublished political proposals cannot receive public URLs. The current public Worker is `sliby-chyby` at `https://sliby-chyby.orik007-apps.workers.dev/`.

Cloudflare deployment itself is operational and the first repository-triggered production build succeeded. Automatic delivery of the final Cloudflare result back into the mobile approval conversation remains an open integration question.

## Repository map

| Path | Role |
| --- | --- |
| `AGENTS.md` | Mandatory project working rules for agents and contributors. |
| `docs/` | Product, methodology, decisions, data, operations, and research documentation. |
| `research/2025-election/` | Unpublished promise-source research and coverage ledger. |
| `automation/collectors/` | Allowlisted post-election evidence source registry. |
| `automation/matching/` | Reviewed matching catalogue and matcher documentation. |
| `automation/prompts/` | Immutable versioned assessor and arbiter prompts. |
| `automation/review-proposals/` | Durable unpublished AI assessment proposals and audit. |
| `automation/golden-cases/` | Reproducible assessment test cases. |
| `data/` | Human-approved public records rendered by the site. |
| `scripts/` | Validation, collection, matching, enrichment, assessment, and publishing logic. |
| `tests/` | Deterministic methodology, schema, pipeline, and deployment tests. |
| `.github/workflows/` | Pull-request verification and server-side evidence workflows. |
| `src/` | Public Astro website. |
| `wrangler.deploy.jsonc` | Production Cloudflare Worker deployment configuration. |

## Cold-start checklist for a new conversation

1. Read `AGENTS.md`, this guide, and `docs/decisions.md` completely.
2. Read the canonical methodology document for the task: promise selection, scoring, evidence pipeline, data model, or release process.
3. Inspect the current branch, `origin/main`, open pull requests, and working tree before editing. Preserve unrelated work and attachments.
4. Derive current counts and operational status from files and server-side systems. Do not trust a copied historical number in a conversation.
5. Keep research candidates, matching-catalogue promises, automated proposals, and public data visibly distinct.
6. Do not publish a political assessment without proposal-specific editorial approval from the owner. Merging an assessment-review pull request preserves an unpublished audit record and is not publication approval.
7. Do not merge any pull request without the owner's unambiguous `schvaluji` for the exact presented head revision; a new commit invalidates that merge approval.
8. Record a newly accepted product or methodology decision in `docs/decisions.md` and its canonical document in the same change.
9. Run relevant tests and `npm run build`, open a pull request, wait for Copilot and Codex review of the current revision, and use the exact-revision approval process.

## Current open questions

The complete register remains [decisions.md](decisions.md). The largest unresolved items for continued work are:

- the final public product name and custom domain;
- the exact boundary dates and nature of an electoral period;
- treatment of real blocked, compromised, materially mixed, or otherwise unscorable cases;
- implementation of the one-time period-closing audit;
- source snapshot retention, copyright, and image licensing rules;
- the coverage threshold required before describing a party's promise catalogue as substantially complete;
- automatic reporting of Cloudflare deployment success or failure in the mobile approval conversation.
