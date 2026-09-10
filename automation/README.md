# Evidence assessment automation

The scheduled workflow runs at 09:37 Europe/Prague. It collects allowlisted source records, deterministically matches them to confirmed public promises, enriches known official documents, and prepares an unpublished assessment proposal for each new or changed bounded evidence package.

Two independent assessors receive the same package. When they disagree, an arbiter selects one assessment or returns no conclusion. Models can cite only supplied evidence IDs.

`review-proposals/` is the human-review queue. Its proposals remain unpublished and never change public data or a public score. The workflow may update its dedicated proposal pull request; it never starts Copilot or Codex review.

The changed-input fingerprint includes assessable content, active prompt content, providers, and model IDs, so a run timestamp alone does not cause another model call. The active prompts are `assessor-v11` and `arbiter-v3`. The canonical process is [docs/evidence-pipeline.md](../docs/evidence-pipeline.md).
