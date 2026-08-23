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
- `createdAt`.

`relatedPromiseIds` must never carry a score into another period.

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

The rule that classifies these counts as party support or opposition is unresolved. Raw individual votes remain authoritative.

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

## Proposed ingestion sources

The conversations identified these categories for future connectors:

- Czech Chamber of Deputies structured datasets for people, time-bounded memberships, votes, parliamentary prints, and proceedings;
- ODok/VeKLEP for government proposals, comments, agendas, resolutions, and meeting records;
- e-Sbírka for final promulgated law text;
- party and ministry websites for statements and intentions;
- a managed list of major-news RSS feeds, sections, and sitemaps for discovery and context.

These integrations are research proposals and must be reverified against current APIs and terms before implementation.

## Open data questions

- Exact period definition and boundary dates.
- Party-vote aggregation rule.
- Whether a real unscorable, blocked, or compromised promise eventually requires a new status or a different publication rule.
- Required source snapshot policy and retention period.
- Image licensing and attribution model.
- Whether candidate AI assessments live in repository files, issues, pull requests, or a later queue database.
- When the file model should migrate to PostgreSQL or another operational database.
