# Sliboměr

Sliboměr is a public tracker of Czech parties' election promises and their later, officially recorded conduct. Its public canonical origin is `https://slibomer.cz`.

## Core model

- A **source** is one verifiable item: one PDF, page, post, video, article, vote, or official record.
- A **promise** cites one source and a precise locator in it.
- A promise has exactly one status: `candidate`, `rejected`, or `confirmed`.
- A confirmed promise is public immediately and starts with score `0`.
- A score changes only on attributable conduct documented by an official record: a decisive Chamber vote, a member bill, or a government proposal ([docs/scoring.md](docs/scoring.md)).
- The SLAVA Index is the normalized `-100` to `+100` aggregate of confirmed promises ([docs/slava-index.md](docs/slava-index.md)).

Campaign sources and non-public promises are in `research/2025-election/promises.json`. Public promises, sources, and score revisions are in `data/`.

The daily 09:37 Prague workflow collects official records, routes them to confirmed promises, keeps only attributable conduct, and prepares unpublished AI assessment proposals for human review. It never changes a public score or publishes data.

Read [docs/project-guide.md](docs/project-guide.md) for the current rules. Use `npm test` for tests and `npm run build` for the local validation and build.
