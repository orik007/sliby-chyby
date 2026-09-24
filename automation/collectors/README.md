# Evidence collectors

[`sources.json`](sources.json) lists the active evidence sources; only primary official records are allowed. Each source has its own `bootstrapFrom` date, and `checkpoints.json` on the audit branch records its last successful collection.

Collectors only collect and normalize official records. They never decide relevance, a score, or publication. The source list, the verification rule for adding a source, and the Chamber data rules are in [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md).
