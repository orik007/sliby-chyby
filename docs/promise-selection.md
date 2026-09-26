# Promise selection

## Authority

This is the only operational definition of the promise catalogue: what enters it, the state of each item, and how it is quoted and titled. It is a **confirmed decision**. Scoring is defined separately in [scoring.md](scoring.md); neither a score nor evidence coverage changes an item's state.

## What enters the catalogue

The catalogue covers the official national election programmes of the tracked parties. Every sentence of a programme in which the party says what it will do, what it wants, what it rejects, or how something will be is catalogued. A description of the present state, a justification, criticism of others, a heading, a slogan without such content, and a sentence describing another party's or government's actions are not catalogued; they may appear in a quote as context.

Statements by individual politicians, regional branches, coalition partners, advertisers, or media do not transfer to the party unless an official national party source explicitly adopts them.

## The three states

Every catalogued item has exactly one state:

| State | Meaning | Public? | Score |
| --- | --- | --- | --- |
| `promise` (slib) | A statement that attributable conduct can deliver or contradict. | Yes | Yes, and it counts in the SLAVA Index. |
| `statement` (výrok) | An official statement of the party that no attributable conduct can deliver or contradict. | Yes, but not yet shown on the site. | None, never even `0`, and never in the SLAVA Index. |
| `rejected` (zamítnuto) | An occurrence rejected for a technical reason only. | No | None |

There is no fourth state and no unpublished promise or statement. Every promise and statement is in `data/promises` with `kind` `promise` or `statement`; rejected occurrences are in `research/2025-election/rejected.json`.

## Promise or statement

The test is one question: **can a concrete law change, vote, or government proposal be in line with it or against it?** When it can, the item is a promise, even without a number or deadline. A clear direction in a concrete area is enough (“Podpoříme výstavbu nájemních bytů”), and so is a rejection of something concrete (“Politický dialog a obchodní výměnu … s Ruskem … vylučujeme”: a vote to end the sanctions contradicts it). When it cannot, the item is a statement: a value, a general goal, a position without a concrete object, a foreign-policy attitude that no Chamber conduct decides, or a sentence that only describes the effect of the party's other commitments.

## Splitting and duplicates

- One promise is one commitment that can be assessed independently. A sentence with commitments on different subjects is split into separate promises that share the sentence as their quote; a list of similar measures on one subject stays one promise.
- A sentence that only states the purpose or effect of the commitment before it stays in that commitment's quote.
- The same commitment repeated in one programme (in the introduction, a chapter's list of priorities, and the chapter itself) is catalogued once, where it is stated most completely; its other occurrences are rejected as duplicates of it.
- An introduction or priority line that only summarises commitments catalogued separately is rejected as such a summary.

Rejection reasons are technical only: a duplicate, a summary of commitments catalogued separately, a truncated extraction, an estimate in a list rather than a statement, or a sentence that is not the party's own statement. A vague, general, or unmeasurable statement is never rejected; it is a statement.

## Quote and title

- **Quote** (`originalText`): the exact wording of the programme, without the page footer, line-end word breaks, or other layout artefacts. It is one or more consecutive sentences. When a sentence depends on an earlier one for its meaning (“Navýšíme jim platy…”), the quote starts with the earlier sentence; when the commitment is only in a heading, the quote starts with the heading. A quote can therefore include a neighbouring sentence that is also part of another promise.
- **Title** (`title`): a short Czech name of the one commitment that is assessed, written only from facts in the quote: no added precision, number, date, or evaluation. The title decides what is assessed; the quote is its source.
- **Locator**: the PDF page where the quote begins, and the item's position in the programme (`sourceOrder`).

Every quote is checked against the text of the archived programme (`research/2025-election/programme-text/`, produced by `scripts/extract-programme-text.mjs` from the files in `archive/promise-sources/`).

## Category and routing tags

Every promise and statement has exactly one common policy category ([decisions.md](decisions.md)). Every promise also has one or more specific routing tags, assigned once when the promise is catalogued and reviewed in the pull request that adds it ([evidence-pipeline.md](evidence-pipeline.md)). A statement has no routing tags.

## Changing the catalogue

A catalogue change is a normal validated data change through the release process. Adding a promise creates its public item, its tags, and its first score revision with value `0` together; adding a statement creates only its item. When an existing promise becomes a statement, its item keeps its ID and URL and its score revisions are removed, because a statement has no score. When an existing item becomes a rejected occurrence, it leaves the site.
