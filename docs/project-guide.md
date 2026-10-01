# Project guide

## Purpose

Sliboměr shows political parties' election promises from their official programmes, their current score, a plain Czech explanation, and traceable sources. Its public canonical origin is `https://slibomer.cz`. The current period is the 2025 Czech Chamber of Deputies election; the initial parties are ANO 2011, SPD, and Motoristé sobě.

## Canonical rules

| Area | Document |
| --- | --- |
| Current project rules | [decisions.md](decisions.md) |
| Promise catalogue | [promise-selection.md](promise-selection.md) |
| Scoring a promise | [scoring.md](scoring.md) |
| SLAVA Index | [slava-index.md](slava-index.md) |
| Evidence automation | [evidence-pipeline.md](evidence-pipeline.md) |
| Storage and validation | [data-model.md](data-model.md) |
| Release | [release-process.md](release-process.md) |

## Current operating model

```text
official party source (election programme, archived with its extracted text)
  -> every statement of what the party will do, wants, or rejects, quoted exactly and titled
  -> promise (public, scored, reviewed routing tags), statement (public, no score), or rejected occurrence (technical reason, not public)

official records only (active: Chamber of Deputies open data)
  -> complete collection of every source at 09:37 Europe/Prague
  -> only records that can be attributable conduct continue
  -> each concerned print split into law changes (one part of its official text each)
  -> context of each law change: the wording of the provisions it amends on the conduct date (e-Sbírka REST API, at most 5 requests per second, cached permanently)
  -> two screeners read every law change with its context: substantive or technical, and topic tags
  -> routing of substantive changes to promises: direct legal-identifier links or the specific tags of either screener, matched to the promises' reviewed tags
  -> attribution: decisive club vote, member bill, or government proposal on the change's print (scoring.md)
  -> two relevance checks per promise and law change
  -> evidence package per promise: every kept law change in full with the party's conduct
  -> two independent assessments with a relevance verdict per law change; an invalid output asked for again at most twice; arbiter only on different scores or one output still invalid
  -> unpublished audit pull request with packages, proposals, coverage, and caches
  -> separate approved public-assessment pull request when a score changes
```

Party websites, press releases, and the media are not evidence. The public site makes no live AI call.

## Repository map

| Path | Purpose |
| --- | --- |
| `research/2025-election/` | Extracted text of the archived programmes, the non-public rejected occurrences, and the record of passages that are not catalogued. |
| `data/` | Public promises and statements, policy categories, sources, current-score revisions, and system status. |
| `archive/promise-sources/` | Original promise-source files and their verified retrieval manifest; storage format is defined in `data-model.md`. |
| `automation/pipeline-generation` | Audit-state generation; changing it makes the next run start from empty audit state. |
| `automation/collectors/` | Registry of active evidence sources. |
| `automation/attribution/` | Governing parties and their dates, with an official source. |
| `automation/topic-routing/` | Controlled routing taxonomy, the reviewed routing tags of every promise, and the durable model caches (law-change screening, relevance checks). |
| `automation/law-context/` | Durable cache of law-change context read from e-Sbírka, one file per act (audit state only). |
| `automation/evidence-packages/` | Durable unpublished queue of evidence packages (one per promise) awaiting assessment. |
| `automation/prompts/` | Active law-change screener, relevance-check, assessor, and arbiter prompts. |
| `scripts/` | Validation, collection, print splitting, routing, packaging, assessment, and coverage-audit scripts. |
| `.github/workflows/` | Verification and the daily evidence-assessment workflow. |

## Before changing the project

1. Read `AGENTS.md`, this guide, and [decisions.md](decisions.md).
2. Read the canonical document for the affected area.
3. Inspect the current branch, `origin/main`, and relevant server-side state.
4. Replace or remove rules and implementation that a confirmed rule invalidates; never preserve a previous model beside the current one.
5. Do not start Copilot or Codex review unless the owner explicitly asks for that exact pull request and head.
