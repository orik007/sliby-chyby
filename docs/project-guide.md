# Project guide

## Purpose

Sliboměr shows political parties' confirmed election promises, their current score, a plain Czech explanation, and traceable sources. Its public canonical origin is `https://slibomer.cz`. The current period is the 2025 Czech Chamber of Deputies election; the initial parties are ANO 2011, SPD, and Motoristé sobě.

## Canonical rules

| Area | Document |
| --- | --- |
| Current project rules | [decisions.md](decisions.md) |
| Promise lifecycle | [promise-selection.md](promise-selection.md) |
| Scores and SLAVA Index | [scoring.md](scoring.md) |
| Evidence automation | [evidence-pipeline.md](evidence-pipeline.md) |
| Storage and validation | [data-model.md](data-model.md) |
| Release | [release-process.md](release-process.md) |

## Current operating model

```text
official party source (election programme)
  -> promise
  -> candidate, confirmed public promise, or rejected promise

official records only (active: Chamber of Deputies open data)
  -> per-source collection at 09:37 Europe/Prague
  -> routing to confirmed promises: direct legal-identifier links or two agreeing topic taggers
  -> attribution: decisive club vote, member bill, or government proposal (scoring.md)
  -> official print document enrichment
  -> two independent assessments; arbiter on disagreement or one invalid output
  -> unpublished audit pull request with packages, proposals, coverage, and checkpoints
  -> separate approved public-assessment pull request when a score changes
```

Party websites, press releases, and the media are not evidence. Government resolutions and the Collection of Laws are the next planned sources and are added only after their data is verified. The public site makes no live AI call.

## Repository map

| Path | Purpose |
| --- | --- |
| `research/2025-election/promises.json` | Campaign sources and non-public candidate or rejected promises. |
| `data/` | Public confirmed promises, common policy-category mappings, sources, current-score revisions, and system status. |
| `archive/promise-sources/` | Original promise-source files and their verified retrieval manifest; storage format is defined in `data-model.md`. |
| `automation/collectors/` | Registry of active evidence sources. |
| `automation/attribution/` | Governing parties and their dates, with an official source. |
| `automation/promise-registry/` | Registry of confirmed promises used by the pipeline (exact wording, source, tests, maintenance baseline). |
| `automation/topic-routing/` | Controlled routing taxonomy and the durable tag-assignment cache. |
| `automation/evidence-packages/` | Durable unpublished queue of enriched evidence packages awaiting assessment. |
| `automation/prompts/` | Active tagger, assessor, and arbiter prompts. |
| `scripts/` | Validation, collection, routing, enrichment, assessment, and coverage-audit scripts. |
| `.github/workflows/` | Verification and the daily evidence-assessment workflow. |

## Before changing the project

1. Read `AGENTS.md`, this guide, and [decisions.md](decisions.md).
2. Read the canonical document for the affected area.
3. Inspect the current branch, `origin/main`, and relevant server-side state.
4. Replace or remove rules and implementation that a confirmed rule invalidates; never preserve a previous model beside the current one.
5. Do not start Copilot or Codex review unless the owner explicitly asks for that exact pull request and head.
