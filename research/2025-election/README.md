# 2025 election research

This directory holds the non-public part of the promise catalogue for ANO 2011, SPD, and Motoristé sobě in the 2025 Czech Chamber of Deputies election. The catalogue rule is [promise-selection.md](../../docs/promise-selection.md).

- `programme-text/` holds the text of each archived official programme (`archive/promise-sources/`), page by page, as extracted by `scripts/extract-programme-text.mjs`. Every quote of a promise, statement, or rejected occurrence is checked against it.
- `rejected.json` lists every rejected occurrence with its source, page, exact wording, and technical reason; a duplicate names the published promise or statement it repeats (`duplicateOf`). Rejected occurrences are never public.
- `not-catalogued.json` lists every other passage of the programmes (headings, layout text, descriptions, justifications, criticism, appeals) with its reason, so that a test can check that no sentence was overlooked. It is not a catalogue state.

Promises and statements themselves are public data in `data/promises`.
