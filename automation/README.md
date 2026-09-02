# Assessment automation

This directory contains the offline assessment workflow. It is deliberately separate from the public Astro runtime.

The complete canonical flow from one shared source collection through full-registry matching, changed-package assessment, arbitration, and the publication gate is documented in [`docs/evidence-pipeline.md`](../docs/evidence-pipeline.md).

Upstream evidence discovery is documented separately in [collectors/README.md](collectors/README.md). Collectors produce unpublished candidate records; they do not match evidence to promises or assign scores.

The intermediate deterministic matching stage is documented in [matching/README.md](matching/README.md). It records transparent candidate links and creates a bounded primary-evidence package only when party attribution is available.

## Pipeline

1. A reviewed promise and a bounded evidence package are prepared.
2. Two stateless assessors receive the same package independently.
3. Each assessor returns a strict structured result and may cite only supplied evidence IDs.
4. Matching sufficient results become a candidate assessment.
5. A disagreement about the status or evidence sufficiency is sent to an arbiter, which may select either review or return `cannot-decide`. Selecting an insufficient review still requires human review and never creates a score candidate.
6. Every result remains unpublished until a later publication gate approves it.

The initial runner uses the OpenAI Responses API with [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). It never gives the scoring assessors web-search tools. Source discovery, promise matching, and official-document enrichment are separate upstream stages. The active assessor prompt is versioned as `assessor-v6` and the arbiter prompt as `arbiter-v2`; their content hashes are stored in every audit record. Earlier prompt files remain immutable for audit reproduction. The active prompts require assessors to read mechanically selected official print excerpts, distinguish proposal wording from legal effect, treat meaningful partial progress as `+1` during a live period, and apply the untouched-promise penalty only in an explicit closing audit.

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

## GitHub Actions

`.github/workflows/run-assessment.yml` exposes a manual `workflow_dispatch` run. It does not run on pull requests, pushes, page loads, or a schedule. The workflow:

1. accepts only a checked-in JSON path below `automation/golden-cases` or `automation/evidence-packages`;
2. runs deterministic tests before spending API credit;
3. reads `OPENAI_API_KEY` from the GitHub `assessment` environment or repository secrets;
4. runs both assessors and the arbiter when required;
5. uploads the unpublished audit record as a private workflow artifact retained for 30 days.

Create an `assessment` environment in the GitHub repository, add the `OPENAI_API_KEY` secret, and optionally require a reviewer before that environment can be used. The workflow has read-only repository permissions and cannot commit or publish results.

A scheduled trigger should be added only after the evidence collector can identify a changed evidence package. That avoids paying to reassess unchanged inputs. Publication will remain a separate explicitly gated workflow.

`.github/workflows/run-e2e-pilot.yml` is a manual integration pilot. It collects official parliamentary records, runs the deterministic matcher for one selected reviewed promise, enriches matched prints from official PSP documents, sends the bounded enriched package to both assessors, invokes the arbiter only on disagreement, and uploads the complete unpublished audit chain. Transient official-document downloads are retried; if a required document still cannot be obtained, assessment stops and the failed enrichment audit is uploaded instead of asking models to infer substance from a title. The workflow does not commit, publish, or deploy any result.

The concurrency group includes the promise ID. Repeated runs for one promise remain serialized, while pilots for different promises do not replace one another in GitHub's single pending slot for a concurrency group.

The first five-promise integration report is recorded in [docs/pilot-evaluation.md](../docs/pilot-evaluation.md).

## Golden case

`golden-cases/ano-eet-2` contains the first fully sourced test case. Its benchmark is a working human proposal, not a published assessment and not an input to the assessors.

`matching/promises.json` contains the first reviewed 36-promise catalog, with 12 official-programme promises for each tracked party. The first successful full-registry collection-and-matching run produced three attributable primary evidence packages. A thematic match without party attribution and a promise with no match both correctly produce no assessable package.
