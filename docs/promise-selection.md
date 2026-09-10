# Promise selection methodology

## Status and purpose

The rules in this document are a **confirmed decision**. They determine which campaign statements become confirmed public promises and are applied before SLAVA scoring.

The project collects campaign material broadly but confirms promises narrowly. A source occurrence is either an internal candidate or a confirmed public promise; confirmation publishes the promise immediately with score `0`. A statement is not confirmed merely because it appeared during a campaign, was said by a politician, or describes a desirable policy.

## Definition

A tracked political promise is a public commitment attributable to a party to pursue a concrete future action, decision, or outcome that can later be assessed from public evidence.

## Mandatory confirmation criteria

A candidate statement must satisfy every criterion below before confirmation:

1. **Official party source** — the original wording appears in an official national party source and speaks as a commitment of the party. The publisher, source location, and publication date or campaign period must be identifiable.
2. **Commitment** — the wording commits to future conduct or an outcome. A greeting, value, aspiration, prediction, criticism, or description of the present is not enough.
3. **Concrete object and direction** — it is clear what the party says it will do, support, oppose, change, preserve, introduce, abolish, increase, reduce, or achieve.
4. **Public assessability** — later evidence can show meaningful movement towards or against the commitment. Suitable evidence may include a vote, bill, amendment, law, regulation, budget, official decision, administrative act, or authoritative outcome data.
5. **Assessment test** — before confirmation, a reviewer can describe in one sentence the observable evidence that would support the promise and the evidence that would contradict it.
6. **No invented precision** — assessment uses only the specificity present in the source. The project must not add a target, deadline, scope, causal claim, or condition that the party did not state.
7. **Atomic scope** — one tracked promise contains one independently assessable commitment. A passage containing several commitments is split while retaining the complete original passage and source context.

Being suitable for a parliamentary vote is useful but not mandatory. Some promises concern regulations, executive acts, budgets, or measurable outcomes instead.

## Confirmed attribution boundary for the first version

The first public version tracks parties, not individual politicians. Eligible sources are official national party materials, including:

- the final national election programme;
- an official national campaign website;
- an official national party campaign publication;
- an official national party account or recording when the wording clearly commits the party rather than only the individual speaker.

The following do not enter the party's SLAVA Index in the first version:

- a politician's personal commitment that the party has not explicitly adopted;
- regional or local branch commitments;
- individual-candidate commitments;
- commitments by candidates from an allied party running on another party's list;
- third-party, supporter, or candidate advertising whose wording is not also established as an official party commitment;
- a media paraphrase without a recoverable official original.

These materials may remain in the research corpus and could support a future product section about individual politicians, their positions, and their conduct. They are not party promises under the current scope.

Party payment, branding, or republication may help recover and authenticate a source, but does not by itself convert a first-person personal commitment into a party promise. The wording must clearly commit the party.

### Electoral alliances and allied candidates

The tracker follows the official party identity whose SLAVA Index is being calculated. A candidate from another party running on that party's electoral list does not bring the candidate's own party programme or personal commitments into the tracked party's promise set.

For the 2025 SPD tracker, promises belonging only to Svobodní, Trikolora, PRO, or their individual candidates are therefore excluded. A commitment is included only when SPD adopts it in an eligible official national SPD source as an SPD commitment.

A future election contested under a formally different joint or renamed electoral identity would require a separate documented `PartyPeriod` decision. It must not be assumed to be equivalent to the current SPD case.

## Confirmation test

For every candidate, ask:

> Can we state in one sentence what concrete public event or evidence would allow us to assess whether the party acted consistently with this commitment?

If the answer is no, the statement remains an internal candidate. Record the reason so that the decision is auditable.

## Examples

| Candidate statement | Decision | Reason |
|---|---|---|
| `Těšíme se, že pro Vás můžeme pracovat. To je naše poslání.` | Reject | General campaign rhetoric; it identifies no concrete assessable commitment. |
| “We will vote against bill X.” | Confirm if attributable and sourced | The promised party conduct and the decisive evidence are explicit. |
| “We will submit legislation abolishing fee X.” | Confirm if attributable and sourced | Submission of the defined legislation is observable. |
| “We will reduce the rate of tax X from 15% to 12%.” | Confirm if attributable and sourced | The baseline, target, and relevant legal result are explicit. |
| “We will reduce energy prices.” | Reject as written | Direction is stated, but no baseline, target, scope, deadline, or defined party act makes a fair assessment possible without adding our own meaning. |
| “We will govern responsibly.” | Reject | “Responsibly” has no source-defined public assessment test. |

The English paraphrases above illustrate the rule. Production records must preserve the exact original Czech quotation.

## Promise forms

The following classification remains a **working proposal** used to help reviewers formulate the assessment test:

- **Behavior promise** — the party commits to perform or avoid a defined action, such as a vote.
- **Process promise** — the party commits to introduce or complete a defined legislative or administrative step.
- **Outcome promise** — the party commits to a defined measurable result.

Classification does not relax the confirmation criteria and does not itself determine a score.

## Review record

There are only two catalog states: an internal candidate and a confirmed public promise. The research audit may record why a candidate remains internal:

- `needs-splitting` — the source contains multiple potentially valid commitments;
- `duplicate-occurrence` — the same promise appears in another source; retain the occurrence but do not create another public promise;
- `attribution-unresolved` — the wording may be a promise, but it is not yet safely attributable to the party;
- `rejected` — it fails one or more confirmation criteria.

When all criteria pass and party attribution is settled, confirm the candidate and publish the resulting promise with its initial `0` revision in the same validated change. Do not create a confirmed-but-unpublished catalog state.

Recommended rejection reasons are:

- `not-a-commitment`;
- `too-vague`;
- `not-publicly-assessable`;
- `missing-original-source`;
- `superseded-or-conflicting-wording-unresolved`.

These codes are a **working implementation proposal**; the selection rule itself is confirmed.

## Changed official wording

When official pre-election versions conflict, the latest official version before the election is the active promise. Earlier wording is retained internally with its source and relationship to the later version, but it does not create a second active scored promise.

The first public version will not display a change notice or earlier wording. Internal preservation remains necessary for auditability and allows that presentation choice to be revisited later.

If it is unclear whether the later wording actually replaces the earlier commitment, do not guess. Keep the candidate internal until the relationship is verified.

## First-release quality threshold

The first real-data release may contain fewer promises. Every published promise must be clear, attributable, source-verifiable, atomic, and assessable under this methodology. Coverage must not be padded with vague statements or unresolved candidates merely to increase the count.

## Relationship to SLAVA scoring

Only confirmed public promises enter the five-state scale in [scoring.md](scoring.md). A candidate is not a zero-point promise. Zero is the initial and continuing score of a confirmed promise until evidence establishes a meaningful directional change.

If a confirmed promise later exposes an edge case that cannot be scored fairly, retain the evidence and keep its current score. Do not silently remove it or invent a public status; revise the methodology using the concrete case.

## Still unresolved

These selection rules do not decide:

- how duplicate wording with materially different conditions should be related;
- the minimum number of confirmed public promises required for the first public real-data release.
