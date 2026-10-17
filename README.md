# Sliboměr

Sliboměr is a public tracker of Czech parties' election promises and their later, officially recorded conduct. Its public canonical origin is `https://slibomer.cz`.

## Core model

- A **source** is one verifiable item: one PDF, page, post, video, article, vote, or official record.
- The catalogue holds every statement of the parties' official programmes, quoted exactly, with its source and a precise locator.
- An item is a **promise** (public, scored), a **statement** (public, no score), or a **rejected** occurrence (technical reason, not public) ([docs/promise-selection.md](docs/promise-selection.md)).
- A promise is public immediately and starts with score `0`.
- A score changes only on attributable conduct documented by an official record, as defined in [docs/scoring.md](docs/scoring.md).
- The SLAVA Index is the normalized `-100` to `+100` aggregate of a party's promises ([docs/slava-index.md](docs/slava-index.md)).

Public promises, statements, sources, and score revisions are in `data/`; the programme texts and rejected occurrences are in `research/2025-election/`.

The daily 09:37 Prague workflow collects official records, routes them to promises, keeps only attributable conduct, and prepares unpublished AI assessment proposals for human review. It never changes a public score or publishes data.

Read [docs/project-guide.md](docs/project-guide.md) for the current rules. Use `npm test` for tests and `npm run build` for the local validation and build.
