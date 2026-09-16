# Evidence assessment automation

The scheduled workflow runs at 09:37 Europe/Prague. It collects allowlisted source records, retrieves candidates with exact signals and semantic similarity to confirmed public promises, enriches known official documents, and prepares an unpublished assessment proposal for each new or changed bounded evidence package.

After collection, matching, and document enrichment succeed, `evidence-packages/` retains each bounded package before any model call. A current package blocked by an official-document warning returns to enrichment on later runs until it succeeds or a newer package replaces it. Two independent assessors receive the current unblocked queued package in small bounded-concurrency batches. When both valid assessments differ, or exactly one assessor output is invalid, an arbiter selects a usable assessment or returns no conclusion. Two invalid outputs write a private failure audit in `review-proposals/failures/`, re-enter a later assessment batch unless a newer current package for the same promise replaces them, and fail only that package. Models can cite only supplied evidence IDs.

`collectors/checkpoints.json` records each source's successful collection checkpoint on the durable audit branch. A source without a checkpoint starts from its registry `bootstrapFrom`; later runs start from that source's own checkpoint.

`evidence-packages/`, `review-proposals/`, collector checkpoints, and the semantic index share one durable audit pull request. They remain unpublished and never change public data or a public score. A human-approved score change is prepared separately as a normal current-`main` pull request. The workflow never starts Copilot or Codex review.

`semantic-index/` is also held on that audit branch. It stores only the versioned promise embeddings used to retrieve candidates from new primary records. The workflow retains candidates according to the canonical [evidence pipeline](../docs/evidence-pipeline.md); a semantic candidate is not a relevance or scoring conclusion, and two assessors still evaluate each bounded package independently.

The changed-input fingerprint includes assessable content, active prompt content, providers, and model IDs, so a run timestamp alone does not cause another model call. The active prompts are `assessor-v13` and `arbiter-v5`. The canonical process is [docs/evidence-pipeline.md](../docs/evidence-pipeline.md).
