# SlibyChyby

SlibyChyby is a public tracker of Czech parties' election promises and later, traceable evidence.

## Core model

- A **source** is one verifiable item: one PDF, page, post, video, article, vote, or official record.
- A **promise** cites one source and a precise locator in it.
- A promise has exactly one status: `candidate`, `rejected`, or `confirmed`.
- A confirmed promise is public immediately and starts with score `0`.
- The SLAVA Index is the normalized `-100` to `+100` aggregate of confirmed promises.

Campaign sources and non-public promises are in `research/2025-election/promises.json`. Public promises, sources, and score revisions are in `data/`.

The daily 09:37 Prague workflow collects evidence, matches it to confirmed promises, enriches known official documents, and prepares unpublished AI assessment proposals for human review. It never changes a public score or publishes data.

Read [docs/project-guide.md](docs/project-guide.md) for the current rules. Use `npm test` for tests and `npm run build` for the local validation and build.
