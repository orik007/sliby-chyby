# Product vision

## Confirmed vision

SlibyChyby lets ordinary visitors see what a party promised before an election and how later evidence affects that promise. It tracks parties, not only collective government programmes. The initial public scope is ANO 2011, SPD, and Motoristé sobě in the current electoral period.

The site is mobile-first and simple: a party index, confirmed promises, a score symbol plus text, a plain Czech explanation, and expandable evidence. Color is never the only carrier of meaning. A public explanation must say who did what and why it matters, and explain parliamentary or legal identifiers on first use.

The score display and index follow [scoring.md](scoring.md). There is no public “not assessed” status. A confirmed promise is visible immediately with score `0` until its evidence justifies a revision.

## Technical direction

Use Astro, TypeScript, plain CSS, and schema-validated versioned files. Keep the website static where possible; it has no live AI call or database request in ordinary browsing. Cloudflare Workers serves production `main`.

## Out of scope

Accounts, a CMS, a search engine, a public AI endpoint, a release controller, and complex political-science analytics are out of scope unless a later confirmed decision changes that.

## Open questions

- Final public name and custom domain.
- Exact electoral-period boundaries.
- A future period-closing score rule.
- Licensing and retention of campaign images and archival copies.
