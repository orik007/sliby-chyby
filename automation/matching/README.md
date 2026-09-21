# Promise matching and attribution configuration

Candidate discovery (which source records are worth considering for a promise) is topic-routing's job — see [`automation/topic-routing/`](../topic-routing/) and [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md). This directory's `promises.json` now serves a narrower, still load-bearing role: it is the source of the promise's exact wording, source locator, `maintenanceBaseline`, and the deterministic **attribution** rules (`matching.externalReferences`, decisive-vote context) that decide whether a topic-routed candidate record is actually attributable party conduct at all — `scripts/lib/evidence-matcher.mjs`'s `attributionStatusForRecord`. The scheduled workflow selects only IDs present in `data/promises`.

A topic-routed candidate relationship means only potentially relevant evidence. Attribution status decides whether it becomes usable evidence; media or unattributed records remain in the audit but do not form an attributable-primary evidence package. A missing match does not change the promise's current score.

The evidence-package builder keeps packages bounded and records omitted-match counts. The canonical process is [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md).
