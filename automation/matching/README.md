# Evidence matching

The matcher receives normalized collector records and compares them with the matching configuration for confirmed public promises. It does not retrieve source data, decide political direction, assign a score, or publish data.

`promises.json` holds exact source wording, locators, matching terms, optional official identifiers, and a minimum match threshold. Those fields provide precise candidate signals and the semantic promise profile; the versioned embedding index is stored separately in `automation/semantic-index/`. The scheduled workflow selects only IDs present in `data/promises`.

A match means only potentially relevant evidence. Exact signals and ranked semantic retrieval are both candidate paths, not conclusions about relevance. Media or unattributed records remain in the audit but do not form an attributable-primary evidence package. A missing match does not change the promise's current score.

The matcher keeps its evidence packages bounded and records omitted-match counts. The canonical process is [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md).
