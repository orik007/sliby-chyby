# Topic routing

This directory holds the controlled routing taxonomy, the reviewed routing tags of every promise, and, on the audit branch, the durable model caches (`tag-cache/`): law-change screening and relevance checks. The canonical rule is [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md).

## `taxonomy-v2.json`

The reviewed, versioned vocabulary used only for routing law changes to promises. It is independent of the public policy categories in [`data/promise-categories.json`](../../data/promise-categories.json).

Each tag has a stable `id`, an optional `parent`, an English `labelEn`, inclusion and exclusion examples, Czech aliases, `assessmentEligible`, and optionally `directLegalIdentifiers`. Only an `assessmentEligible` tag can route a law change; a broad parent tag alone never does.

`directLegalIdentifiers` lists the acts (`cz-act-<number>-<year>`, e.g. `cz-act-23-2017` for Act No. 23/2017 Coll.) or print kinds (`cz-print-kind-state-budget`) that link a law change amending that act directly to every promise holding the tag. Only an assessment-eligible tag may carry them. An act is mapped to a tag only when its official name clearly falls under that tag. An act whose name covers several specific topics (Act No. 23/2017 Coll. on budget responsibility rules covers deficit and debt, fiscal rules, and the debt brake) is listed under each of them; its law changes then reach the promises of every such tag, and the relevance checks and assessors decide relevance.

Models may return only an existing tag `id` or `unknown`. Adding, deleting, moving, or redefining a tag or its identifiers is a reviewed taxonomy change; the taxonomy content hash then recomputes every dependent classification.

## `promise-tags.json`

The routing tags of every promise, keyed by promise ID: one or more specific (`assessmentEligible`) tag identifiers. They are assigned once when the promise is catalogued and reviewed in the pull request that adds or changes it; no model tags promises. A statement has no entry. The file records the `taxonomyVersion` and `taxonomyContentHash` of the taxonomy the tags were reviewed against; any change to `taxonomy-v2.json` makes the pipeline refuse the tags until they are reviewed again and the hash is updated. A law change tagged with one of a promise's tags, or amending an act that one of them lists in `directLegalIdentifiers`, is routed to that promise.

## Code

- [`scripts/lib/print-parts.mjs`](../../scripts/lib/print-parts.mjs) and [`scripts/run-print-parts.mjs`](../../scripts/run-print-parts.mjs) download each print's proposal text and its later texts in every run, split them into law changes with their versions, and find the act each one amends.
- [`scripts/lib/law-change-screening.mjs`](../../scripts/lib/law-change-screening.mjs) screens law changes (`law-change-screener-v3.md`) and checks the relevance of a promise and law change (`relevance-check-v4.md`).
- [`scripts/lib/model-output.mjs`](../../scripts/lib/model-output.mjs) validates model outputs; [`scripts/lib/paired-model-calls.mjs`](../../scripts/lib/paired-model-calls.mjs) runs the two independent calls per subject and keeps the caches.
- [`scripts/lib/published-promises.mjs`](../../scripts/lib/published-promises.mjs) loads the promises with their tags; [`scripts/lib/topic-routing.mjs`](../../scripts/lib/topic-routing.mjs) builds the tag-to-promise index and routes a law change by direct legal-identifier links and the screeners' tags.
- [`scripts/lib/topic-evidence-package.mjs`](../../scripts/lib/topic-evidence-package.mjs) builds one package per promise from its kept law changes and the party's conduct attributable under [`scripts/lib/attribution.mjs`](../../scripts/lib/attribution.mjs).
- [`scripts/run-topic-routing.mjs`](../../scripts/run-topic-routing.mjs) runs screening, routing, relevance checks, and packaging in the daily workflow.
