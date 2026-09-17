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

The agreed migration design for topic-based evidence routing is recorded in [topic-routing-design.md](topic-routing-design.md). It is not an active canonical rule until its implementation replaces the current evidence pipeline.

## Current operating model

```text
official party source
  -> promise
  -> candidate, confirmed public promise, or rejected promise

allowlisted evidence sources
  -> per-source bootstrap or incremental collection at 09:37 Europe/Prague
  -> exact signals plus semantic candidate retrieval across confirmed promises
  -> official-document enrichment when a known target exists
  -> two independent assessments; arbiter on disagreement or one invalid assessor output
  -> unpublished audit pull request with queued evidence packages, proposals, coverage, and checkpoints
  -> separate approved public-assessment pull request when a score changes
```

The daily workflow uses embeddings only to retrieve a bounded set of candidate promise relationships. Two independent assessors determine relevance and propose a score from bounded evidence; it never assigns a public score or publishes data. The public site makes no live AI call.

## Repository map

| Path | Purpose |
| --- | --- |
| `research/2025-election/promises.json` | Campaign sources and non-public candidate or rejected promises. |
| `data/` | Public confirmed promises, common policy-category mappings, sources, current-score revisions, and system status. |
| `archive/promise-sources/` | Original promise-source files and their verified retrieval manifest; storage format is defined in `data-model.md`. |
| `automation/collectors/` | Allowlisted evidence-source registry. |
| `automation/matching/` | Exact-signal configuration and semantic promise profiles for public promises. |
| `automation/semantic-index/` | Versioned embedding index used only to retrieve candidate promise relationships. |
| `automation/evidence-packages/` | Durable unpublished queue of enriched evidence packages awaiting assessment. |
| `scripts/` | Validation, collection, matching, enrichment, assessment, and coverage-audit scripts. |
| `.github/workflows/` | Verification and the daily evidence-assessment workflow. |

## Before changing the project

1. Read `AGENTS.md`, this guide, and [decisions.md](decisions.md).
2. Read the canonical document for the affected area.
3. Inspect the current branch, `origin/main`, and relevant server-side state.
4. Replace or remove rules and implementation that a confirmed rule invalidates; never preserve a previous model beside the current one.
5. Do not start Copilot or Codex review unless the owner explicitly asks for that exact pull request and head.
