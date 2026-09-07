# Assessment automation

This directory contains the offline assessment workflow. It is deliberately separate from the public Astro runtime.

The complete canonical flow from one shared source collection through full-registry matching, changed-package assessment, arbitration, and the publication gate is documented in [`docs/evidence-pipeline.md`](../docs/evidence-pipeline.md).

Upstream evidence discovery is documented separately in [collectors/README.md](collectors/README.md). Collectors produce unpublished candidate records; they do not match evidence to promises or assign scores.

The intermediate deterministic matching stage is documented in [matching/README.md](matching/README.md). It records transparent candidate links and creates a bounded primary-evidence package only when party attribution is available.

## Assessment boundary

Two stateless assessors independently receive the same bounded package and may cite only supplied evidence IDs. Matching sufficient results become an unpublished candidate; a disagreement goes to an arbiter that may select one review or return `cannot-decide`. No result becomes public without the separate human publication gate. The complete stage sequence is maintained only in [`docs/evidence-pipeline.md`](../docs/evidence-pipeline.md).

The initial runner uses the OpenAI Responses API with [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). It never gives the scoring assessors web-search tools. Source discovery, promise matching, official-document enrichment, and evidence-gap expansion are separate upstream stages. The active assessor prompt is versioned as `assessor-v11` and the arbiter prompt as `arbiter-v3`; their content hashes are stored in every audit record. Earlier prompt files remain immutable for audit reproduction. The active prompt follows the canonical decision order in [`docs/scoring.md`](../docs/scoring.md); collection and attribution boundaries live in [`docs/evidence-pipeline.md`](../docs/evidence-pipeline.md).

The planned evidence-gap resolver is a deterministic, non-model stage. It starts only when inventory matching produced no attributable primary candidate evidence or both independent assessors identify a bounded package as insufficient. It records the missing factual category and identifies only exact permitted official document targets. The enricher retrieves and extracts those known targets. Resolver and enricher outputs are fingerprinted; assessment or reassessment is permitted only when assessable content changes. Neither role can score, publish, or run indefinitely.

Provider-specific HTTP calls are isolated in `scripts/lib/model-provider.mjs`. The rest of the pipeline consumes a normalized response. A future second provider therefore needs a new adapter and credentials, while evidence packages, scoring validation, arbitration, audit records, and the public site remain unchanged.

## Configuration

The live runner requires `OPENAI_API_KEY`. The confirmed pilot defaults are:

- assessor A: provider `openai`, model `gpt-5.6-terra`;
- assessor B: a separate stateless call to provider `openai`, model `gpt-5.6-terra`;
- disagreement arbiter: provider `openai`, model `gpt-5.6-sol`.

The provider and model environment variables may override these defaults without changing the pipeline. Two calls to one model are operationally independent but not independent model families. A second provider is planned after the pilot.

Copy `.env.example` to `.env` for local use and keep the real key out of version control. Existing process environment variables take precedence; otherwise the runner loads the local `.env` file when present.

## Commands

Validate the golden evidence package without making API calls:

```text
npm run assess:validate
```

Run both assessors and the arbiter when needed:

```text
npm run assess:golden
```

Each live run writes a new timestamped directory under `automation/runs`. The runner refuses to overwrite an existing run. Raw model metadata, the exact package hash, reviews, arbitration, and the candidate resolution are retained for audit.

The full-registry batch runner uses a separate stable assessment fingerprint. It hashes the assessable promise and evidence content together with the methodology, active prompt hashes, providers, and model identifiers. It deliberately excludes volatile collection run IDs, timestamps, and package cutoffs, because ordinary elapsed time does not change a live assessment. A changed fingerprint is assessed once and materialized under `automation/review-proposals`; a known fingerprint is skipped without an API call.

## GitHub Actions

`.github/workflows/run-assessment.yml` exposes a manual single-package `workflow_dispatch` run. It does not run on pull requests, pushes, page loads, or a schedule. The workflow:

1. accepts only a checked-in JSON path below `automation/golden-cases` or `automation/evidence-packages`;
2. runs deterministic tests before spending API credit;
3. reads `OPENAI_API_KEY` from the GitHub `assessment` environment or repository secrets;
4. runs both assessors and the arbiter when required;
5. uploads the unpublished audit record as a private workflow artifact retained for 30 days.

Create an `assessment` environment in the GitHub repository, add the `OPENAI_API_KEY` secret, and optionally require a reviewer before that environment can be used. The workflow has read-only repository permissions and cannot commit or publish results.

The full-registry workflow is scheduled once daily at 09:37 Prague time. Its changed-input gate avoids paid reassessment of unchanged packages. The confirmed target is incremental collection: after one historical backfill, only new or changed source-record versions are matched against the full promise registry; a newly admitted promise, or a promise whose active wording, matching configuration, or matcher rules version changed, receives one archive backfill. Each affected package uses the cumulative current candidate matches for its promise. Publication remains a separate explicitly gated workflow.

`.github/workflows/run-e2e-pilot.yml` is a manual integration pilot. It collects official parliamentary records, runs the deterministic matcher for one selected reviewed promise, enriches matched prints from official PSP documents, sends the bounded enriched package to both assessors, invokes the arbiter only on disagreement, and uploads the complete unpublished audit chain. Transient official-document downloads are retried; if a required document still cannot be obtained, assessment stops and the failed enrichment audit is uploaded instead of asking models to infer substance from a title. The workflow does not commit, publish, or deploy any result.

The concurrency group includes the promise ID. Repeated runs for one promise remain serialized, while pilots for different promises do not replace one another in GitHub's single pending slot for a concurrency group.

`.github/workflows/collect-evidence.yml` is the scheduled and manually triggerable full-registry workflow. It runs daily at 09:37 in `Europe/Prague`, collects once, matches all reviewed promises, enriches official print documents, blocks only packages with enrichment warnings, assesses only new fingerprints, and commits durable unpublished proposals to `automation/assessment-review`. It creates or updates a pull request against `main` when repository Actions permissions allow this. If GitHub permits the token to push the branch but forbids pull-request creation, the successful workflow emits a ready-to-open compare link instead of repeating model calls or discarding the proposals. Merging the pull request retains the review audit but cannot publish a status or update the public website.

The first five-promise integration report is recorded in [docs/pilot-evaluation.md](../docs/pilot-evaluation.md).

## Golden case

`golden-cases/ano-eet-2` contains the first fully sourced test case. Its benchmark is a working human proposal, not a published assessment and not an input to the assessors.

`automation/matching/promises.json` contains the current reviewed 46-promise catalog: 22 official-programme promises for ANO and 12 each for SPD and Motoristé. The first successful full-registry collection-and-matching run used the historical 36-promise tranche and produced three attributable primary evidence packages. A thematic match without party attribution and a promise with no match both correctly produce no assessable package.
