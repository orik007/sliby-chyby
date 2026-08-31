# Data model

## Model status

The period boundaries and non-carryover rule are confirmed. Schema-validated versioned files are the confirmed initial storage approach. The relational entity structure below remains a working proposal designed for a future database migration.

## Confirmed invariants

- A party is a long-lived identity.
- An electoral period is a distinct historical scope.
- A party's participation in a period has its own programme, presentation, leadership context, and promise set.
- A promise belongs to exactly one party-period.
- A repeated promise in a later period is a new promise with a new assessment history.
- Historical periods remain accessible.
- An assessment is revisioned; prior published revisions are retained.
- The SLAVA Index is derived from current assessable revisions and is not stored as authoritative data.
- Evidence items are not independently averaged or added to produce a promise score.

## Proposed relationship overview

```text
Period
  └─ PartyPeriod ── Party
       └─ Promise
            ├─ PromiseSource ── Source
            ├─ EvidenceLink ── Event / Article / VotingEvent / Source
            └─ AssessmentRevision
                 └─ AssessmentEvidence ── EvidenceLink

VotingEvent
  ├─ IndividualVote
  └─ PartyVoteSummary (derived)

Event
  └─ EventSource ── Source
```

## Core entities

### `Period`

Represents one electoral or governing period.

Proposed fields:

- `id` — stable identifier such as `cz-ps-2025`;
- `name`;
- `jurisdiction`;
- `electionDate`;
- `startsAt` and `endsAt` when known;
- `status` — upcoming, current, closed;
- `notes`.

The exact definition of period start/end and whether periods are election, parliamentary, or government terms is an **open question**.

### `Party`

Long-lived political-party identity.

Proposed fields:

- `id`;
- `canonicalName`;
- `shortName`;
- `officialUrl`;
- `activeFrom` and `activeTo`;
- identifiers used by external public datasets.

### `PartyPeriod`

Connects a party to one period and contains period-specific presentation and programme context.

Proposed fields:

- `id`;
- `periodId`;
- `partyId`;
- `displayName`;
- `leaderName`;
- `leaderImageAssetId`;
- `programmeSourceIds`;
- `governmentRole`;
- `homePageOrder`;
- `notes`.

Photographs need provenance, license, and attribution metadata; use is unresolved until lawful assets are selected.

### `Promise`

One attributable commitment made by one party in one period.

Only a candidate that passes the confirmed [promise selection methodology](promise-selection.md) becomes a `Promise`. Rejected, duplicate, composite, or attribution-unresolved source occurrences remain in the research review layer and do not enter the SLAVA Index denominator.

Proposed fields:

- `id`;
- `partyPeriodId`;
- `title` — short human-readable label;
- `originalText` — exact quotation;
- `language`;
- `categoryIds`;
- `promiseType` — outcome, process, behavior, or undecided;
- `target` and `deadline` where explicitly present;
- `expectedDirection`;
- `institutionIds` and policy keywords used for matching;
- `primarySourceId` and source locator (page, timestamp, or image region);
- `relatedPromiseIds` for non-scoring historical relationships;
- `supersedesPromiseCandidateReviewIds` for retained earlier official wording that the active promise replaced;
- `createdAt`.

`relatedPromiseIds` must never carry a score into another period.

### `PromiseCandidateReview`

A proposed research-layer record showing how one collected source occurrence was processed under the confirmed promise selection methodology.

Proposed fields:

- `id`;
- `sourceId` and precise source locator;
- `originalText` and surrounding source context;
- `provisionalPartyPeriodId`;
- pass/fail notes for commitment, specificity, public assessability, assessment test, and atomic scope;
- `supportingEvidenceTest` and `contradictingEvidenceTest`;
- `disposition` — accepted, needs-splitting, duplicate-occurrence, attribution-unresolved, or rejected;
- `rejectionReasonCodes`;
- `resultingPromiseIds` when accepted or split;
- `supersededByReviewId` when a later official pre-election version replaced this occurrence;
- reviewer, review time, and methodology version.

This entity is a **working implementation proposal**. Retaining the review result and rejection rationale is part of the confirmed audit principle; the exact schema is not yet confirmed.

### `Source`

Canonical metadata for any underlying document or page.

Proposed fields:

- `id`;
- `type` — programme, campaign website, poster, transcript, official statement, parliamentary record, bill, law, budget, government decision, article, dataset, or other;
- `title`;
- `publisher`;
- `url`;
- `publishedAt`;
- `retrievedAt`;
- `contentHash`;
- `archiveAssetId` where a lawful copy is retained;
- `primary` boolean;
- `language`;
- `notes`.

For copyrighted news articles, retain URL, metadata, and only the necessary short excerpt; do not archive or republish entire articles without permission.

### `Article`

Article-specific metadata associated one-to-one with a `Source` of type `article`.

Proposed fields:

- `sourceId`;
- `authorNames`;
- `outletId`;
- `section`;
- `feedEntryId`;
- `syndicationOrigin` when known;
- `relevantExcerpt`;
- `discoveredAt`.

Articles discover and explain events. They should not conceal the underlying primary evidence when it exists.

### `Event`

A deduplicated real-world occurrence described by one or more sources.

Proposed fields:

- `id`;
- `type` — intention-announced, proposal-submitted, government-approved, vote-held, law-enacted, law-promulgated, outcome-observed, or other;
- `occurredAt`;
- `actorIds`;
- `topicIds` and institution IDs;
- `processStage`;
- `summary`;
- `sourceIds`;
- `deduplicationKey`;
- `contentHashes`.

Ten articles about the same vote should normally produce one event with multiple sources, not ten assessment triggers.

### `EvidenceLink`

Connects a promise to a source or event and records how it may bear on the promise.

Proposed fields:

- `id`;
- `promiseId`;
- exactly one of `eventId`, `sourceId`, or `votingEventId`;
- `direction` — supports, contradicts, neutral, unclear;
- `significance`;
- `attributionStatus`;
- `excerptOrLocator`;
- `createdAt`;
- `createdBy`;
- `validationStatus`.

An evidence link is not a score.

### `VotingEvent`

One official vote and its legislative context.

Proposed fields:

- `id` and external official identifier;
- `chamber` and `termId`;
- `occurredAt`;
- `motionTitle` and exact question;
- `billId` or print/document ID;
- `stage`;
- `result`;
- `officialSourceId`;
- flags for normal, manual, corrected, or technically incomplete voting;
- `supersedesVotingEventId` where applicable.

### `IndividualVote`

One representative's recorded vote.

Proposed fields:

- `votingEventId`;
- `personId`;
- `choice` — yes, no, abstain, absent, excused, or official source value;
- `partyIdAtVote`;
- `parliamentaryGroupIdAtVote`;
- provenance.

Membership must be resolved at `occurredAt`, because current membership may differ from membership when the vote happened.

### `PartyVoteSummary`

A derived, non-authoritative summary retained for presentation or caching.

Proposed fields:

- `votingEventId`;
- `partyPeriodId`;
- counts for each vote choice;
- eligible member count;
- derived classification and rule version;
- calculation timestamp.

The confirmed current rule requires a strict majority of all parliamentary-group members at the vote time to establish positive or negative party voting conduct. Proposed implementation fields include `eligibleMemberCount`, `directionalVoteCount`, `strictMajorityThreshold`, normalized choice counts, `majorityChoice`, `attributionStatus`, and `ruleVersion`. Raw individual votes remain authoritative, and every non-directional choice remains available for display. A `no-strict-majority` summary may enter a bounded assessment package only for a verified decisive vote, where the assessor determines whether it was a direct missed opportunity to support the exact promise. Direction relative to a promise is not stored in the raw summary.

Voided, manual, technically incomplete, mixed, and context-unresolved votes retain their counts but cannot establish party conduct.

### `AssessmentRevision`

An immutable published or candidate evaluation of one promise.

Proposed fields:

- `id`;
- `promiseId`;
- `revision`;
- `status` — one of the canonical SLAVA statuses;
- `explanationShort`;
- `explanationDetailed`;
- `publishedAt` or candidate state;
- `methodologyVersion`;
- `promptVersion`;
- assessor and arbiter metadata;
- confidence and dissent notes;
- `supersedesRevisionId`;
- `correctionOfRevisionId` when applicable.

### `AssessmentEvidence`

Join entity listing exactly which evidence supports a revision.

Proposed fields:

- `assessmentRevisionId`;
- `evidenceLinkId`;
- `role` — decisive, supporting, contextual, contradicting;
- cited excerpt/locator;
- validation result.

## Confirmed initial file-storage direction

```text
data/
  periods/
  parties/
  party-periods/
  promises/
  sources/
  articles/
  events/
  voting-events/
  individual-votes/
  evidence-links/
  assessment-revisions/
```

Stable IDs and foreign-key-like references must be schema validated. Versioned files are confirmed for the initial demo. The exact directory split shown above remains adjustable during implementation and is intended to map later to relational tables without changing the public domain model.

## Evidence ingestion

### Confirmed implementation boundary

Collectors create unpublished evidence candidates. They do not match a record to a promise, infer whether it supports or contradicts a promise, assign a SLAVA status, or publish anything. Every run records its cutoff, retrieval time, source identifiers, response hashes, record hashes, warnings, and `publicationApproved: false`.

The verified source registry is stored in `automation/collectors/sources.json`. Hostname, response size, and media-type allowlists are enforced before normalization. Unexpected redirects fail closed. Feed collectors retain metadata and only a short publisher-provided excerpt; they do not download full article bodies.

### Enabled verified collectors

- Czech Chamber of Deputies daily open-data archives: votes, individual choices, time-bounded parliamentary-club membership, parliamentary prints, and print history. Club membership is resolved at the date of each vote.
- Government Office RSS and MPSV press-release Atom feed as official discovery sources.
- Publisher-provided iROZHLAS, ČT24, and Seznam Zprávy feeds and the Novinky.cz news sitemap as discovery and context sources.

Media records are non-primary candidates. They may reveal a relevant action or decision, but their collection does not imply a likely `+1` or `-1`, and an article is not automatically decisive evidence.

### Registered but disabled

- ODok/eKLEP remains disabled because no stable documented public machine-readable endpoint was verified.
- e-Sbírka remains disabled because the current official notice requires API registration and recommends production Open Data integration only after 15 January 2027 while identifiers and structures are changing.

These entries remain explicit in the registry so that absence of a collector cannot be mistaken for a completed integration. Party and ministry coverage beyond the two enabled official feeds remains a working expansion proposal.

## Open data questions

- Exact period definition and boundary dates.
- Party-vote aggregation rule.
- Whether a real unscorable, blocked, or compromised promise eventually requires a new status or a different publication rule.
- Required source snapshot policy and retention period.
- Whether feed-response hashes alone are sufficient for official-page evidence, or whether lawful page/PDF snapshots must also be retained after matching.
- Image licensing and attribution model.
- Whether candidate AI assessments live in repository files, issues, pull requests, or a later queue database.
- When the file model should migrate to PostgreSQL or another operational database.
