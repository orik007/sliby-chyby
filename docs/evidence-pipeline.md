# Evidence pipeline

## Status and authority

The collection, matching, and assessment separation described in this document is a **confirmed decision**.

This document is the canonical human-readable description of collection, matching, and publication boundaries. Scoring decisions belong only in [`docs/scoring.md`](scoring.md). [`automation/collectors/sources.json`](../automation/collectors/sources.json) is the machine-readable authority for enabled sources, endpoints, host allowlists, evidence roles, and deferred integrations. A source-list change must update both files in the same pull request.

The operational rule is short: **collect broadly from the allowlist, match cautiously, resolve only documented evidence gaps, assess only bounded attributable evidence, and publish only after human approval**. A collector never scores, a match never proves direction, and an assessment proposal never publishes itself.

## Role boundaries

The following names are the canonical names for pipeline roles. A role may be implemented by a script or by a human review, but its boundary must remain the same.

| Role | Owns | Must not do |
|---|---|---|
| Cataloguer | Reviews official campaign-source candidates and admits atomic promises with exact wording and assessment tests. | Score post-election conduct or publish an assessment. |
| Collector | Retrieves and versions normalized records from the enabled source registry. | Compare records with promises, fetch documents per promise, or call a model. |
| Matcher | Compares a record set with every reviewed promise and records transparent candidate links. | Retrieve upstream source data, infer support or contradiction, or assign a score. |
| Resolver | For one affected promise and a recorded evidence gap, identifies the exact permitted official record targets that could fill that gap and records their bounded recheck condition. | Browse the general web, inspect every daily record, select a score, or repeat a search before its recorded source change or bounded retry condition. |
| Enricher | Retrieves a known official document target and extracts bounded, reproducible passages with URL and content hash. | Search for additional targets, infer attribution or legal effect, or assign a score. |
| Assessor A and assessor B | Independently judge the same bounded package using only its supplied evidence. | Browse, retrieve evidence, invent sources, or publish. |
| Arbiter | Selects an existing assessor result or returns `cannot-decide` when the assessors disagree. | Invent a third assessment, fill an evidence gap, or publish. |
| Review-proposal builder | Preserves the package and model audit as an unpublished human-review proposal. | Treat a proposal as publication approval or change public data. |
| Owner | Reviews an unpublished political proposal and may explicitly approve publication only by identifying the exact proposal or proposals. | Delegate publication approval implicitly to an automated assessment or pull-request merge. |

Release-quality reviewers, the approval coordinator, CI verification, and deployment are operational roles defined in [`release-process.md`](release-process.md); they review and release repository changes, not political evidence.

## Confirmed pipeline

One pipeline execution follows this sequence:

1. **Collect incrementally.** During the initial historical backfill, every enabled source adapter retrieves the configured historical scope once. Thereafter, the collector obtains only new or changed record versions and persists them in a durable server-side archive. Collection is source-oriented, not promise-oriented; no source is downloaded separately for each promise. A current-window feed is still read as a whole window, but only new or changed normalized records enter the archive.
2. **Normalize, version, and deduplicate.** Records receive stable provenance, timestamps, source roles, structured facts where available, and deterministic hashes. Exact duplicate versions collapse; a changed version is retained as a change. Conflicting records with one identity fail validation unless the upstream source has a documented identity exception.
3. **Match every increment against every reviewed promise.** Each new or changed record is compared with the complete reviewed promise registry and updates a durable current candidate-match index. One record may match zero, one, or several promises, including similar promises belonging to different parties. A newly admitted promise, or an existing promise whose matching-relevant fingerprint changes, receives one backfill comparison against the complete retained archive before later comparisons return to increments only. The fingerprint includes the active promise wording and matching configuration, plus the matcher rules version.
4. **Treat matches as candidates only.** A deterministic match means “potentially relevant,” never “supports,” “contradicts,” or “changes the score.” Every matched term or official external identifier remains visible in the audit.
5. **Resolve a pre-assessment evidence gap once, when needed.** When matching produced no attributable primary candidate evidence, the affected promise enters a deterministic, bounded resolver before any model call. The resolver records the trigger and missing factual category, then identifies only exact record targets within enabled configured official source scopes, such as a full official page, a parliamentary print, a linked decisive vote, a promulgated law, or an authoritative outcome record. It records searched scopes, target-selection rules, target URLs or identifiers, and unresolved gaps. An unresolved target records either an observed source revision, ETag, or cursor that can invalidate it, or a bounded next eligible retry time; an unchanged retry does not create a new assessment input. It never assigns a direction or score and never uses a model.
6. **Build bounded evidence packages from cumulative matches.** For every affected promise, build from its complete current candidate-match index, not only from the increment that triggered the run. A package is generated only when attributable primary candidate evidence exists. Relevant media records may remain as context, but media alone does not create a strict primary-evidence package.
7. **Enrich known official document targets.** For a parliamentary print already present in a package or a target identified by the resolver, the enricher retrieves the exact document once, retains its SHA-256 hash, and mechanically selects bounded passages around the promise and visible matcher terms. The current implementation is limited to official PSP proposal DOCX files. The selection assigns no direction or score. The original and enriched packages, document hashes, exact excerpts, and any warning remain auditable. Assessment workflows retry transient download failures and stop before model calls if a required document remains unavailable.
8. **Assess only new or changed packages.** Two independent assessors receive the same bounded enriched package. An unchanged package hash does not trigger repeated model calls; the full-registry workflow enforces this through the assessment fingerprint.
9. **Resolve a post-assessment evidence gap once, when needed.** When both independent assessors identify a bounded package as insufficient, the same deterministic, bounded resolver may identify further exact targets within enabled configured official source scopes. The enricher retrieves any resulting targets. The resolver records the trigger, missing factual category, searched scopes, target-selection rules, unresolved gaps, and the source-change or bounded-retry condition for unresolved targets; it never assigns a direction or score and never uses a model.
10. **Assess or reassess only materially expanded evidence.** The expanded package is assessed only when its assessable content has changed. A resolver may not loop indefinitely: an exhausted or unchanged expansion remains an unpublished human-review case.
11. **Arbitrate disagreement.** Matching sufficient assessor results become a candidate assessment. Disagreement about the status or evidence sufficiency goes to the configured arbiter. An arbiter cannot turn a selected insufficient review into a score candidate; unresolved or insufficient cases require human attention.
12. **Publish separately.** Collection, matching, assessment, and publication are distinct stages. No collector, matcher, enrichment step, resolver, or model result changes public data or the SLAVA Index automatically under the current rules.

```text
allowlisted sources
  -> durable normalized record archive
  -> new or changed records only
  -> match each increment against all reviewed promises
  -> cumulative current matches for each affected promise
  -> if no attributable primary candidate evidence: bounded resolver targets
  -> bounded evidence packages
  -> enricher fetches known official document targets
  -> changed packages only
  -> assessor A + assessor B
  -> if both are insufficient: bounded resolver targets -> enricher
  -> assessment or reassessment only when assessable content changed
  -> arbiter when needed
  -> human publication gate
  -> versioned public data
```

## Enabled source registry

The enabled list is intentionally small and explicit. “Verified” means that the endpoint, format, and expected host were checked; it does not mean that every statement from the publisher is accepted as true or decisive evidence.

### Primary and official sources

| Registry ID | Source | Machine-readable channel | Role |
|---|---|---|---|
| `psp-core-2025` | Chamber of Deputies of the Parliament of the Czech Republic | Daily open-data archives for votes, individual choices, parliamentary prints, print history, and time-bounded club membership | Primary official records |
| `government-cz-rss` | Government Office of the Czech Republic | Official RSS, including explicitly allowlisted links to the official ODok portal | Official discovery; an underlying decision or document may still be required |
| `mpsv-press-archive-2025-2026` | Ministry of Labour and Social Affairs | Complete, paginated annual press-release indexes for 2025 and 2026 | Historical official discovery; register the next annual index when the year changes |
| `mf-press-archive-2025-2026` | Ministry of Finance | Complete official annual press-release indexes for 2025 and 2026 | Historical official discovery; register the next annual index when the year changes |
| `mzd-press-wordpress` | Ministry of Health | Paginated official WordPress REST archive from the requested cutoff | Historical official discovery; all returned pages are collected |
| `mk-news-archive` | Ministry of Culture | Chronological official news archive followed past the requested cutoff | Historical official discovery; only publisher-labelled ministry items are retained |
| `msmt-news-api` | Ministry of Education, Youth and Sports | Cursor-paginated JSON archive used by the ministry's own news page | Historical official discovery; collection follows cursors past the requested cutoff |

### Official party sources

| Registry ID | Party | Machine-readable channel | Role |
|---|---|---|---|
| `motoriste-party-news-wordpress` | Motoristé sobě | Complete official paginated WordPress REST archive from the requested cutoff | Primary evidence of what the party published; each item still requires content-level review because the archive also contains individual interviews and republished appearances |

An official party publication is attributable only to the party identified by the source registry as a publication. It may provide directional evidence only when its wording explicitly adopts a concrete party or parliamentary-group position or intention. An individual's interview or third-party wording does not become a party position merely because the party site republishes it. A party's own claim that a law, administrative act, or outcome already occurred must still be checked against the corresponding independent official record.

### Coverage semantics

Every registry entry declares one coverage mode. The requested `since` date is only a filter; it is not proof that an endpoint returned the entire requested interval.

| Mode | Meaning |
|---|---|
| `term-snapshot` | The upstream snapshot contains the complete configured parliamentary term; the collector applies the cutoff locally. |
| `since-filtered-archive` | The collector traverses an official historical archive from the requested cutoff. |
| `current-window` | The publisher controls a limited recent window. Older items may be absent even when the requested cutoff is older. |
| `deferred` | No operational coverage exists. |

Each run records the mode, limitation note, record count, and earliest and latest observed timestamps. An empty or short current-window feed can never establish that no political action occurred.

### Allowed news sources

| Registry ID | Publisher | Channel | Permitted use |
|---|---|---|---|
| `irozhlas-domestic-rss` | iROZHLAS | Publisher-provided domestic-news RSS | Discovery and context only |
| `ct24-rss` | ČT24 | Publisher-provided RSS | Discovery and context only |
| `seznam-zpravy-rss` | Seznam Zprávy | Publisher-provided RSS | Discovery and context only |
| `novinky-news-sitemap` | Novinky.cz | Google News sitemap advertised by the publisher | Discovery and context only |

The current news-source list is exactly these four publishers. A new publisher is not implicitly allowed because it is large, familiar, or linked by an existing article. Adding or removing a publisher requires an explicit registry and documentation change with endpoint, host, format, content-size, and provenance validation.

News collection retains metadata, URL, publication time, supplied authors, and at most a short publisher-provided excerpt. It does not download or store full article bodies. A news item may help discover a vote, bill, regulation, decision, or measurable outcome, but a strong `+2` or `-2` assessment should normally cite the underlying primary source.

### Deferred official sources

| Registry ID | Source | Current state |
|---|---|---|
| `odok-veklep` | ODok/eKLEP public interface | Registered but disabled as a standalone collector until a stable documented machine-readable endpoint is verified. ODok links supplied by the Government Office RSS remain allowed as official discovery records. |
| `e-sbirka-open-data` | e-Sbírka open data and public API | Registered but disabled under the current integration warning and registration requirements. |
| `ano-party-news` | ANO 2011 official news archive | Registered but disabled because automated requests receive a Cloudflare browser challenge and no stable machine-readable archive has been verified. Search-engine excerpts are not accepted as complete coverage. |
| `spd-party-news` | SPD official news archive | Registered but disabled because RSS, sitemap, and WordPress requests receive a WEDOS security challenge and no stable machine-readable archive has been verified. Search-engine excerpts are not accepted as complete coverage. |

## Matching and attribution boundary

- A media article that mentions a promise may appear in the match audit but cannot by itself establish party conduct.
- A parliamentary vote enters a party's package only when party membership at the vote date and the configured party-attribution rule are resolved.
- Bill authorship is not required. A party's verified vote can be relevant regardless of who introduced the bill.
- A government act is an attribution candidate until the assessor can fairly connect it to the tracked party.
- An official party publication is directly attributable to that party as a publication, not automatically as an adopted position and not as proof that the underlying act or outcome occurred.
- Official print-document excerpts establish proposal substance, not party attribution, adoption, or legal effect. Paragraphs are selected mechanically and may support, contradict, or merely contextualize the promise.
- Insufficient evidence is an internal research outcome, not a final political assessment. It must retain the supplied evidence and name the missing factual category, such as proposal content, decisive vote, legal effect, observed outcome, or attribution.
- An evidence-gap resolver may use only enabled configured official source scopes and deterministic target-selection rules. It may not use general web search, media as decisive evidence, an assessor's memory, or an unrecorded human inference.
- The resolver is targeted rather than exhaustive: it identifies deeper pages or documents only for the affected promise and documented gap. The enricher, not the resolver, downloads and extracts a known target document.
- An exhausted resolver does not manufacture a score. It creates or preserves an unpublished human-review proposal.
- A promise with no primary match receives no package. It does not receive `no-progress`, zero points, or any other assessment merely because collection found nothing.
- Contradictory evidence is retained. Evidence items are not scored independently and are not averaged.
- Every package declares whether it is a `live` assessment or the one-time `closing-audit`; assessors never infer this from elapsed time. Current matching emits only `live` packages.

## Current automation state

The GitHub Actions workflow `Collect, match, and assess evidence candidates` currently implements collection, matching, matched-print enrichment, assessment, and arbitration for the full reviewed registry. It does not yet implement incremental persistent collection or either evidence-gap resolver stage. It currently re-collects the configured historical scope, checks all 46 current catalog promises against one shared collection, enriches only matched parliamentary prints, and sends only new or changed assessable packages to the two assessors and possible arbiter. This full replay is a transitional implementation, not the confirmed target operating model.

The [first full-registry document-enrichment run](https://github.com/orik007/sliby-chyby/actions/runs/33601733992) processed 3,984 shared records, 36 reviewed promises, and 141 candidate matches. It generated three evidence packages and added four official print documents across them with zero warnings. Original and enriched package hashes differ and are retained separately in the uploaded audit.

The changed-input gate uses `assessment-fingerprint-v1`. Its content identity includes the evidence and promise seen by assessors, the methodology and period mode, active assessor and arbiter prompt hashes, providers, and model identifiers. It excludes the package cutoff, collection run ID, and other volatile generation metadata. Under the confirmed live-period rule, elapsed time without new evidence does not change a score. A later explicit-deadline workflow must record the deadline closure as assessable content before it can trigger a new assessment.

New assessments are written under `automation/review-proposals/<promise-id>/<assessment-fingerprint>/` on the dedicated `automation/assessment-review` branch. Each directory retains the exact enriched evidence package, complete model audit, and concise proposal record. The workflow creates or updates a human-review pull request when repository Actions permissions allow it. If the token may push but not create pull requests, the workflow succeeds with a compare link for a reviewer instead. Every proposal remains `publicationApproved: false`; merging the pull request makes the audit durable but does not change public assessment data.

An official-document enrichment warning blocks assessment only for the affected promise. Other valid changed packages continue through the batch. The full transient run remains available as a private GitHub artifact for 30 days.

Every full-registry run also creates `coverage-audit.json` and `coverage-audit.md`. The audit has one row per reviewed promise and distinguishes an assessment candidate, a case requiring human review, an assessable package, candidate matches without attributable primary evidence, and no candidate match. These are internal pipeline states, not public SLAVA statuses. The audit always records that it inferred no score and approved no publication.

The period-closing audit is not implemented yet. It must be a separate deterministic run over every reviewed promise, including promises for which normal collection never produced a primary-evidence package. During ordinary live collection, absence of a package must not be converted into a score.

## Scheduling and persistence

The scheduling policy is a **confirmed decision**:

- run one complete pipeline every day at `09:37` in the `Europe/Prague` time zone;
- retain the manual trigger for recovery and deliberate backfills;
- use the latest successful complete workflow run as the public source-freshness date;
- do not advance that date after a failed run;
- do not publish assessment proposals or public data automatically.

Once-daily collection deliberately favors a simple, understandable operating model over near-real-time updates. Short RSS and news-sitemap windows remain a known coverage limitation, while official primary sources remain the decisive evidence layer. Revisit frequency only after observed missed evidence demonstrates a need.

The target daily run retrieves and processes only new or changed record versions after the historical backfill. Its durable archive, incremental cursor or overlap rule, current candidate-match index, and resolver cache must live on server-side infrastructure. Re-reading a publisher-controlled current window is allowed when necessary to discover changes, but unchanged normalized content must not cause resolver work or assessment API calls. Resolver cache entries must record either a target-source revision, ETag, or cursor, or a bounded next eligible retry time, so an exhausted target is not cached forever; an unchanged recheck still cannot create a new assessment input. The exact storage technology remains an implementation decision and must preserve the project's no-local-dependency and auditability requirements.

The versioned review-proposal directory and pull request are the confirmed initial durable queue. A later private queue or database remains an optional migration, not a prerequisite for the first reviewed real-data release.
