# Topic routing taxonomy

This directory holds the controlled routing taxonomy and the durable tag-assignment cache (`tag-cache/`, restored from and persisted to the `automation/assessment-review` audit branch) for topic routing, the live mechanism that routes collected source records to confirmed promises. The canonical rule is [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md).

## `taxonomy-v1.json`

The reviewed, versioned controlled vocabulary used for topic routing. It is a separate taxonomy from the public policy categories in [`data/promise-categories.json`](../../data/promise-categories.json); the public categories remain the site's navigation taxonomy and are not changed by this design.

Each tag has a stable `id`, an optional `parent`, an English `labelEn`, inclusion and exclusion examples, centrally managed Czech aliases, an optional `directLegalIdentifiers` list, and `assessmentEligible`. `assessmentEligible: true` marks a tag as "sufficiently specific" for routing purposes — a broad parent tag alone (`assessmentEligible: false`) never creates an assessment candidate by itself, per the design doc.

It now has one broad, `assessmentEligible: false` top-level tag for each of the 14 public policy areas (mirroring the areas in [`data/promise-categories.json`](../../data/promise-categories.json), though the two files remain independent and are never cross-referenced by code), and every area now also has two or three finer, `assessmentEligible: true` child tags. Only a child tag can ever drive an auto-created relationship or count toward `routing-review` for a source record: a broad parent tag alone is intentionally never enough (per the design doc's routing table, "no matching promise after a safe assignment" is `orphan-review`, not `routing-review`), so the broad tags exist for a promise's own topic classification and audit trail, not to widen record routing by themselves. Building out this first pass of child tags for all 14 areas (rather than only the original 2) follows the owner's explicit preference for broad, permissive tag coverage over narrow tags that miss real matches; it is still a first pass, not a claim of complete or maximally precise coverage, and further child tags can be added under any area as a later reviewed taxonomy change once real routing-review volume shows where more precision would help.

Models may only return an existing tag `id` from this file or the literal `unknown`. They may never invent a tag. Adding, deleting, moving, or redefining a tag is a reviewed taxonomy change that must record which subtree is affected so every dependent promise and source classification can be recomputed consistently — never patched promise-by-promise.

## Code

- [`scripts/lib/topic-taxonomy.mjs`](../../scripts/lib/topic-taxonomy.mjs) — loads and validates this file; resolves ancestors, aliases, and direct legal identifiers.
- [`scripts/lib/topic-tagger.mjs`](../../scripts/lib/topic-tagger.mjs) — builds bounded tagging briefs and calls the tagging AI (`automation/prompts/tagger-v1.md`) through the shared `model-provider.mjs` boundary.
- [`scripts/lib/topic-routing.mjs`](../../scripts/lib/topic-routing.mjs) — combines two independent tagger results into a routing state (`auto-candidate` / `routing-review` / `orphan-review`) and a routing disposition, and builds the tag-and-direct-link inverted index.
- [`scripts/lib/topic-evidence-package.mjs`](../../scripts/lib/topic-evidence-package.mjs) — builds real, bounded evidence packages from routing decisions, applying the same attribution rule (`attributionStatusForRecord` in `scripts/lib/evidence-matcher.mjs`) and bounding rule every evidence package uses, within an explicit evidence/token budget.
- [`scripts/run-topic-routing.mjs`](../../scripts/run-topic-routing.mjs) — the live CLI. It tags promises and sources, computes routing decisions, writes real evidence packages ready for `scripts/queue-evidence-packages.mjs`, and writes an unpublished topic-routing report. It never sends a package to an assessor or arbiter itself, and it never writes to `data/` directly.

Run it with `npm run topic-routing` (requires `OPENAI_API_KEY`; `.github/workflows/collect-evidence.yml` runs the same script as part of the daily pipeline). Its fixtures live in `tests/topic-routing.test.mjs` and `tests/topic-evidence-package.test.mjs`.
