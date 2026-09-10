# Project guide

## Purpose

SlibyChyby tracks what political parties promised before an election and compares those promises with later, traceable evidence. The public experience stays simple: show the original promise, its current numerical score, a plain Czech explanation, and the sources.

The current period is the 2025 Czech Chamber of Deputies election. The initial party scope is ANO 2011, SPD, and Motoristé sobě.

## Where rules live

Read the one document that owns the work being changed:

| Area | Canonical document |
| --- | --- |
| Decisions and their history | [decisions.md](decisions.md) |
| Promise lifecycle and selection | [promise-selection.md](promise-selection.md) |
| Scores and SLAVA Index | [scoring.md](scoring.md) |
| Evidence collection and assessment | [evidence-pipeline.md](evidence-pipeline.md) |
| Storage entities and validation | [data-model.md](data-model.md) |
| Product presentation | [product.md](product.md) |
| Pull requests and deployment | [release-process.md](release-process.md) |

This guide only routes a reader. It does not define a second version of those rules.

## Operating model

```text
official campaign material
  -> research candidate
  -> confirmed public promise or rejected occurrence

allowlisted evidence sources
  -> daily collection at 09:37 Europe/Prague
  -> deterministic matching to confirmed promises
  -> bounded evidence package
  -> independent assessment and arbitration when needed
  -> append-only current-score revision when justified
  -> derived SLAVA Index
```

The evidence workflow also has a manual trigger. A failed complete run never advances the public freshness date. The public browser has no AI key and makes no live AI assessment.

## Repository map

| Path | Purpose |
| --- | --- |
| `research/2025-election/` | Unpublished campaign-source research, candidates, and rejections. |
| `data/` | Confirmed public promises, sources, score revisions, and system status. |
| `automation/collectors/` | Allowlisted evidence source registry. |
| `automation/matching/` | Matching configuration for confirmed promises. |
| `automation/prompts/` | Versioned assessment prompts. |
| `automation/review-proposals/` | Historical unpublished assessment-proposal audit; not an active lifecycle or score state. |
| `scripts/` | Validation, collection, matching, enrichment, and assessment scripts. |
| `.github/workflows/` | Server-side verification and daily evidence workflow. |

## Cold-start checklist

1. Read `AGENTS.md`, this guide, and [decisions.md](decisions.md).
2. Read the one canonical document for the requested change.
3. Inspect `origin/main`, the current working tree, and relevant server-side state.
4. Keep promise lifecycle, score, evidence, and release concerns separate.
5. Do not start a Copilot or Codex review unless the owner explicitly asks for that exact PR and head.
