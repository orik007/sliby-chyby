# Evidence matching

The matcher is an auditable narrowing stage between collectors and assessors. It never determines whether evidence supports or contradicts a promise and never assigns a SLAVA status.

## Pilot promise set

`promises.json` contains five manually reviewed, atomic promises from final official national party programmes. This is an evaluation set, not a claim of complete programme coverage.

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
- Bill authorship is not required for vote evidence. A verified decisive vote attributed by the directional-vote rule can enter the package even when another party introduced the bill.
- A government action is explicitly marked as an attribution candidate, not silently converted into party conduct.
- A promise with no primary match does not receive `no-progress`; it receives no assessable package.
- Evidence packages are bounded and retain omitted-match counts.
- Every generated package and match run remains unpublished.
