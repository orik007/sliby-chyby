# Evidence matching

The matcher receives normalized collector records and compares them with the matching configuration for confirmed public promises. It does not retrieve source data, decide political direction, assign a score, or publish data.

`promises.json` holds exact source wording, locators, matching terms, optional official identifiers, and a minimum match threshold. The scheduled workflow selects only IDs present in `data/promises`.

A match means only potentially relevant evidence. Media or unattributed records remain in the audit but do not form an attributable-primary evidence package. A missing match does not change the promise's current score.

The matcher keeps its evidence packages bounded and records omitted-match counts. The canonical process is [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md).
