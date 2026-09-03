# SlibyChyby

SlibyChyby is a public tracker of Czech political parties' pre-election promises and their subsequent actions. It is intended to let a visitor understand within seconds what a party promised, how it is currently acting, and which evidence supports that assessment.

The core measure is the **SLAVA Index**, a normalized point score from `-100` to `+100` derived from tracked promises. It is displayed without a percent sign. Each promise is assessed on a five-point scale from acting against the promise (`-2`) to fulfilled (`+2`).

The initial concept focuses on the current electoral period and the governing parties ANO, SPD, and Motoristé. Promises remain scoped to their electoral period; later periods receive new promise sets and historical periods remain available.

The public site now contains its first two verified, human-approved assessments. Fictional fixtures are kept outside the production data directories.

Real-source collection for the 2025 election is staged under `research/2025-election`. Nothing in that directory is automatically published or scored: it separates captured sources, exact source occurrences, over-inclusive extraction queues, attribution questions, and coverage gaps. Only reviewed public records under `data` are rendered by the site.

The confirmed initial implementation uses Astro, TypeScript, plain CSS, and schema-validated versioned data files. A database is not needed for the first public release.

The canonical collection, matching, source-list, and assessment flow is documented in [`docs/evidence-pipeline.md`](docs/evidence-pipeline.md).

For a complete cold-start explanation of why the project exists and how promise research, evidence collection, AI assessment, human approval, publication, and deployment fit together, start with [`docs/project-guide.md`](docs/project-guide.md).

The complete unpublished evidence pipeline runs daily at 09:37 Prague time and can also be started manually. Public pages show the date of its latest successful run. A failed run does not advance that date and never changes a published assessment.

## Local development

```sh
npm install
npm run dev
```

Use `npm test` for SLAVA Index unit tests and `npm run build` for the complete validation and production build.

## Documentation

- [Start here: complete project guide](docs/project-guide.md)
- [Product vision and interface](docs/product.md)
- [Promise selection methodology](docs/promise-selection.md)
- [SLAVA Index methodology](docs/scoring.md)
- [Data model](docs/data-model.md)
- [Decision register](docs/decisions.md)
- [Cloudflare infrastructure](docs/cloudflare.md)
- [Release and approval process](docs/release-process.md)
- [Unpublished end-to-end pilot](docs/pilot-evaluation.md)
- [Project working rules](AGENTS.md)
- [2025 promise-source research](research/2025-election/README.md)
- [2025 campaign coverage ledger](research/2025-election/source-inventory.md)

## Status vocabulary

Documentation distinguishes:

- **Confirmed decision** — explicitly accepted by the project owner.
- **Working proposal** — a concrete recommendation that still needs validation or approval.
- **Open question** — unresolved, contradictory, or insufficiently specified.
