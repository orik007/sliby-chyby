# Topic routing

This directory holds the controlled routing taxonomy and, on the audit branch, the durable tag-assignment cache (`tag-cache/`). The canonical rule is [docs/evidence-pipeline.md](../../docs/evidence-pipeline.md).

## `taxonomy-v1.json`

The reviewed, versioned vocabulary used only for routing records to confirmed promises. It is independent of the public policy categories in [`data/promise-categories.json`](../../data/promise-categories.json).

Each tag has a stable `id`, an optional `parent`, an English `labelEn`, inclusion and exclusion examples, Czech aliases, `assessmentEligible`, and optionally `directLegalIdentifiers`. Only an `assessmentEligible` tag can create a candidate relationship; a broad parent tag alone never does.

`directLegalIdentifiers` lists the acts (`cz-act-<number>-<year>`, e.g. `cz-act-23-2017` for Act No. 23/2017 Coll.) or print kinds (`cz-print-kind-state-budget`) whose presence in an official print creates a direct link to every promise holding the tag. Only an assessment-eligible tag may carry them. An act is mapped only when its official name, as recorded in the Chamber's print titles, falls clearly under one tag.

Models may return only an existing tag `id` or `unknown`. Adding, deleting, moving, or redefining a tag or its identifiers is a reviewed taxonomy change; the taxonomy content hash then recomputes every dependent classification.

## Code

- [`scripts/lib/print-acts.mjs`](../../scripts/lib/print-acts.mjs) and [`scripts/run-print-acts.mjs`](../../scripts/run-print-acts.mjs) derive the acts each collected print amends from its official title and bill text, cached on the audit branch in `automation/print-acts/`.
- [`scripts/lib/topic-routing.mjs`](../../scripts/lib/topic-routing.mjs) derives direct legal-identifier links, combines two independent tagger results into `auto-candidate`, `routing-review`, or `orphan-review`, and builds the tag-to-promise index.
- [`scripts/lib/topic-tagger.mjs`](../../scripts/lib/topic-tagger.mjs) builds bounded tagging briefs and calls the tagging model (`automation/prompts/tagger-v1.md`).
- [`scripts/lib/topic-evidence-package.mjs`](../../scripts/lib/topic-evidence-package.mjs) builds bounded packages, keeping only conduct attributable under [`scripts/lib/attribution.mjs`](../../scripts/lib/attribution.mjs).
- [`scripts/run-topic-routing.mjs`](../../scripts/run-topic-routing.mjs) runs routing in the daily workflow. A record with a direct link is not sent to the taggers.
