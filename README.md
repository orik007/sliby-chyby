# SlibyChyby

SlibyChyby is a planned public tracker of Czech political parties' pre-election promises and their subsequent actions. It is intended to let a visitor understand within seconds what a party promised, how it is currently acting, and which evidence supports that assessment.

The core measure is the **SLAVA Index**, a normalized point score from `-100` to `+100` derived from tracked promises. It is displayed without a percent sign. Each promise is assessed on a five-point scale from acting against the promise (`-2`) to fulfilled (`+2`).

The initial concept focuses on the current electoral period and the governing parties ANO, SPD, and Motoristé. Promises remain scoped to their electoral period; later periods receive new promise sets and historical periods remain available.

This repository contains the first local product demo. All displayed promises, assessments, sources, and portraits are explicitly fictional test data.

The confirmed initial implementation plan uses Astro, TypeScript, plain CSS, and schema-validated versioned data files. A database is not needed for the first demo.

## Local development

```sh
npm install
npm run dev
```

Use `npm test` for SLAVA Index unit tests and `npm run build` for the complete validation and production build.

## Documentation

- [Product vision and interface](docs/product.md)
- [SLAVA Index methodology](docs/scoring.md)
- [Data model](docs/data-model.md)
- [Decision register](docs/decisions.md)
- [Project working rules](AGENTS.md)

## Status vocabulary

Documentation distinguishes:

- **Confirmed decision** — explicitly accepted by the project owner.
- **Working proposal** — a concrete recommendation that still needs validation or approval.
- **Open question** — unresolved, contradictory, or insufficiently specified.
