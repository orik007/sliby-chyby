# Promise semantic index

`promise-index.json` is the versioned operational index for semantic candidate retrieval. It holds an embedding for every published promise profile, derived from the exact promise text, fulfillment and contradiction tests, and precise matching signals. It removes entries for promises no longer published.

The first pipeline run creates missing embeddings. Later runs reuse unchanged promise profiles and embed only newly collected primary records. The index retrieves candidate relationships only; it does not establish relevance, attribution, a score, or publication.
