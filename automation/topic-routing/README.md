# Topic routing taxonomy and pilot

This directory holds the controlled routing taxonomy and the operational output of the topic-routing **pilot** described in [`docs/topic-routing-design.md`](../../docs/topic-routing-design.md). It is not yet the live evidence-pipeline rule — the canonical, currently governing rule remains [`docs/evidence-pipeline.md`](../../docs/evidence-pipeline.md) until the design doc's migration gate is satisfied.

## `taxonomy-v1.json`

The reviewed, versioned controlled vocabulary used for topic routing. It is a separate taxonomy from the public policy categories in [`data/promise-categories.json`](../../data/promise-categories.json); the public categories remain the site's navigation taxonomy and are not changed by this design.

Each tag has a stable `id`, an optional `parent`, an English `labelEn`, inclusion and exclusion examples, centrally managed Czech aliases, an optional `directLegalIdentifiers` list, and `assessmentEligible`. `assessmentEligible: true` marks a tag as "sufficiently specific" for routing purposes — a broad parent tag alone (`assessmentEligible: false`) never creates an assessment candidate by itself, per the design doc.

This starter version covers only the two branches needed to prove the routing mechanism (`public-finance` → `fiscal-responsibility` / `taxation`, and `health-and-care`) plus their required children. It is **not** a full-catalogue taxonomy: covering every confirmed promise is its own reviewed, budgeted drafting pass (see the design doc's token-budget table) and is deliberately left for a follow-up change once the pilot itself is accepted.

Models may only return an existing tag `id` from this file or the literal `unknown`. They may never invent a tag. Adding, deleting, moving, or redefining a tag is a reviewed taxonomy change that must record which subtree is affected so every dependent promise and source classification can be recomputed consistently — never patched promise-by-promise.

## Pilot code

- [`scripts/lib/topic-taxonomy.mjs`](../../scripts/lib/topic-taxonomy.mjs) — loads and validates this file; resolves ancestors, aliases, and direct legal identifiers.
- [`scripts/lib/topic-tagger.mjs`](../../scripts/lib/topic-tagger.mjs) — builds bounded tagging briefs and calls the tagging AI (`automation/prompts/tagger-v1.md`) through the shared `model-provider.mjs` boundary.
- [`scripts/lib/topic-routing.mjs`](../../scripts/lib/topic-routing.mjs) — combines two independent tagger results into a routing state (`auto-candidate` / `routing-review` / `orphan-review`) and a routing disposition, and builds the tag-and-direct-link inverted index. Semantic-discovery candidates are unioned in but can never suppress a tag- or direct-routed relationship.
- [`scripts/lib/topic-evidence-package.mjs`](../../scripts/lib/topic-evidence-package.mjs) — predicts bounded evidence packages from routing decisions, within an explicit evidence/token budget.
- [`scripts/run-topic-routing-pilot.mjs`](../../scripts/run-topic-routing-pilot.mjs) — the pilot CLI. It tags promises and sources, computes routing decisions, and writes an unpublished report under `automation/runs/pipeline/topic-routing-pilot/`. It never sends a package to an assessor or arbiter, and it never writes to `data/` or the live automation audit branch.

Run it with `npm run topic-routing:pilot` (requires `OPENAI_API_KEY`; the `.github/workflows/topic-routing-pilot.yml` manual workflow runs the same script using the repository's existing secret). The pilot is accepted only once its fixtures pass (see `tests/topic-routing.test.mjs`) and the owner has reviewed a real routing report and the resulting assessor-budget estimate.
