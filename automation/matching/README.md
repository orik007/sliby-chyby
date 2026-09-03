# Evidence matching

The matcher is an auditable narrowing stage between collectors and assessors. It never determines whether evidence supports or contradicts a promise and never assigns a SLAVA status.

The canonical end-to-end pipeline and source policy are in [`docs/evidence-pipeline.md`](../../docs/evidence-pipeline.md). This file documents matcher-specific behavior.

## Reviewed promise catalog

`promises.json` contains the current reviewed matching catalog: 43 atomic promises from the final official national party programmes, with 19 for ANO 2011 and 12 each for SPD and Motoristé sobě. The original balanced 36-promise tranche and each later bounded batch remain auditable; the current count is not a quota or a claim of complete programme or campaign coverage.

Every catalog entry links back to its source record in `research/2025-election/candidate-promises.json`. The source record must have an `accepted-*` review status. Bounded batch decisions are retained under `research/2025-election/reviewed-batches/`; the remaining extraction candidates are not promises, index inputs, or zero-point items until reviewed.

Each promise defines:

- the exact source wording and locator;
- a fulfillment and contradiction test;
- explicit matching phrases and optional official external identifiers;
- a minimum candidate score.

External identifiers receive a deliberately strong score because they refer to a manually verified parliamentary print. Text phrases remain visible in each match result. There is no opaque embedding or model decision in this first matcher.

## Safety boundary

- A match means only “potentially relevant.”
- Media candidates remain visible in the match audit but are not put into the strict primary-evidence package.
- A thematic match without party attribution remains visible in the audit but is excluded from the assessment package.
- Bill authorship is not required for vote evidence. A verified decisive vote can enter the package even when another party introduced the bill.
- A decisive `no-strict-majority` party summary enters the package as `verified-party-no-majority`. It becomes a `-1` candidate only if assessment verifies that the exact motion directly and materially advanced the party's own promise.
- A government action is explicitly marked as an attribution candidate, not silently converted into party conduct.
- A promise with no primary match does not receive `no-progress`; it receives no assessable package.
- Evidence packages are bounded and retain omitted-match counts.
- Every generated package and match run remains unpublished.

## Full-registry workflow

The `Collect and match evidence candidates` GitHub Actions workflow collects each enabled source once and then runs this matcher across the entire reviewed promise registry. It uploads the complete unpublished audit, including promises with no match, rather than running a separate collector for every promise.

After deterministic matching, `scripts/run-print-enrichment.mjs` follows only the official parliamentary prints already present in generated packages. It downloads the first official proposal DOCX, records the content hash, extracts readable paragraphs, and mechanically selects a bounded set around the exact promise and visible matcher terms. Original and enriched packages remain separate. Document excerpts reveal proposal substance but do not establish party attribution, passage, effectiveness, or scoring direction.
