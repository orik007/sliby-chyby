# Evidence collectors

Collectors retrieve records from the enabled sources in [`sources.json`](sources.json). Each source has its own `bootstrapFrom` date. [`checkpoints.json`](checkpoints.json) records the successful collection point per source; a newly added source has no checkpoint and receives a fresh bootstrap. Each collected record keeps its source, URL, time, and content hash.

Collectors only collect and normalize evidence. They do not decide whether a campaign statement is a promise, change a promise status, assign a score, or publish data.

The daily workflow runs the collectors at 09:37 Prague time, then matches records to confirmed public promises and writes a coverage audit. Its complete current definition is [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md).
