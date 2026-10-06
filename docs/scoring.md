# Scoring

## Authority

This is the only operational definition of how one promise is scored: score values, attributable conduct, and the current score. It is a **confirmed decision**. The assessors and the arbiter receive this document unchanged, so it holds only what scoring a promise needs. The promise catalogue is defined only in [promise-selection.md](promise-selection.md), how evidence is collected only in [evidence-pipeline.md](evidence-pipeline.md), and the party aggregate only in [slava-index.md](slava-index.md).

## Score values

Every promise has one current numerical score. The default is `0`, except for a documented maintenance baseline as defined below. A score is not a catalogue state and never decides whether a promise is public. A statement ([promise-selection.md](promise-selection.md)) has no score.

A promise is its title and its exact wording. The title names the one commitment that is assessed; the wording is what the party wrote and can include a neighbouring sentence for context, which is not part of the commitment. The title never adds anything the wording does not say.

| Score | Public label | Meaning |
| ---: | --- | --- |
| `+2` | Splněno | A decision attributable to the party delivers the whole promise. |
| `+1` | Směřuje ke splnění | A proposal attributable to the party advances the promise, a decision delivers only a part of it, the party voted down a measure contradicting it, or a documented maintenance baseline remains in force. |
| `0` | Zatím bez ověřeného podstatného posunu | No attributable conduct on the promise has been documented. |
| `-1` | Směřuje proti slibu | A proposal attributable to the party contradicts the promise, a decision contradicts only a part of it, the party voted down a measure delivering only a part, or the party did not support a decisive measure delivering the promise. |
| `-2` | Jedná proti slibu | A decision attributable to the party contradicts the whole promise, or the party voted down a measure delivering the whole promise. |

During a live electoral period, elapsed time alone does not change `0`.

## Attributable conduct

Only the conduct in this table can change a score. Each row names the only official source that documents it. A party's own website or publication, a press release, and the media never document conduct.

| Conduct | Official source | What it means | Attributed to | In line with the promise | Against the promise |
| --- | --- | --- | --- | --- | --- |
| **Decisive Chamber vote** | Chamber of Deputies open data, [psp.cz](https://www.psp.cz/sqw/hp.sqw?k=1300): a roll-call vote that the official print history names as the Chamber's final decision (approved, rejected, insisted on the bill after a Senate or presidential return, accepted Senate amendments) | How the party's MPs decided a bill, the state budget, or a treaty | The party whose parliamentary club voted that way by strict majority of all its members on the vote date | `+2` if the measure delivers the whole promise; `+1` if only a part, or if the party voted down a contradicting measure | `-2` if the party adopted a measure contradicting the whole promise or voted down a measure delivering the whole promise; `-1` if either concerns only a part, or if the club gave no strict majority for a measure delivering the promise |
| **Member bill** | Chamber print of kind “Návrh zákona” submitted by one MP or a group of MPs (print history step “předložen”) | The party's MPs formally proposed a law | Every tracked party with at least one proposing MP in its club on the submission date | `+1` | `-1` |
| **Government proposal** | Chamber print of kind “Vládní návrh zákona”, “Státní rozpočet”, or “Mezinárodní smlouva” (step “předložen”) | The government formally proposed a law, the budget, or a treaty | Every governing party on the submission date | `+1` | `-1` |

A measure that applies generally, for example to all constructions or all public expenditure, is conduct on a promise naming a specific project, place, or group only when its text or the supplied evidence connects it to that commitment; otherwise it is not conduct on that promise.

A vote is scored by the party's own choice on the vote date. The later fate of the measure (a Senate or presidential return, entry into force) does not change that score; only a later attributable conduct can.

Each conduct is judged against the text it concerned. A bill's text can change while the Chamber debates it, so a submission concerns the proposed text, a vote approving a bill in the third reading concerns the text the Chamber approved, and a vote on a bill returned by the Senate or the President concerns the text it decided on. When a later decision on the same bill concerns a text that no longer delivers what the proposal delivered, that decision is scored by its own text, even if the earlier proposal was in line with the promise.

A vote in which the club has no strict majority is attributed to the party only as the missed opportunity in the vote row.

The governing parties and their dates are recorded in `automation/attribution/government-periods.json` with an official source. The current government of ANO 2011, SPD, and Motoristé sobě was appointed on 15 December 2025; a proposal or decision of an earlier government is not conduct of these parties.

## Current score

The current score reflects the party's most significant attributable conduct on the promise so far. A decision (a decisive vote) outweighs a proposal; among conduct of the same weight, the most recent one decides. When conduct of the same weight and the same date, or one decision on a measure with parts both delivering and contradicting the promise, points in both directions, the lower score applies, and the explanation names both. A part of a measure points against the promise only when it works against the commitment itself: what the promise commits to deliver, prevent, or preserve. A part that concerns another matter, even a related one, is named in the explanation but does not lower the score. When a promise names a measurable target, such as an amount, a rate, or a figure for a given year, conduct that directly concerns that target (for a deficit target, the state budget for that year) decides the score before conduct that concerns only another part of the promise, whatever their weight; among conduct concerning the target, the order above applies. Earlier conduct remains visible in the append-only revision history.

For each changed evidence package, apply this order:

1. Establish the relevant facts from the supplied official evidence.
2. Establish whether the conduct is attributable to the party under the table above.
3. Compare the conduct with the commitment named by the promise title, read with its exact wording, without making the promise more specific.
4. Choose the single score that best describes the current position.

Contradictory evidence stays in the audit. Evidence items are not separately scored and never averaged. If the package cannot support a fair conclusion, the current score stays unchanged; that lack of conclusion is not a score status.

## Maintenance commitments

A maintenance commitment is a promise that the party or its government will not itself make one clearly identified change. Its fulfillment consists of preserving an already observable state.

Classify a promise as a maintenance commitment only when all of these are true:

1. the exact wording is a commitment to refrain from a specific change, not a commitment to stop, abolish, prevent, or otherwise actively change something;
2. the state to be preserved exists when the party or its government assumes responsibility; and
3. the responsible party or government has the power to make the identified change.

A documented maintenance baseline is `+1` when the preserved state holds at the point of responsibility. Its public explanation states that the state promised to be preserved currently remains in force. It is not `+2`: full fulfillment requires the end of the relevant electoral period with that state preserved. Conduct in the table above that makes the identified change replaces the baseline.

Do not infer a maintenance commitment merely from a negative word, and do not award `+1` for elapsed time alone. Commitments such as “we will stop”, “we will abolish”, or “we will prevent” require attributable conduct and otherwise remain at `0`.

Example: “Zavazujeme se, že naše vláda nepřijme euro ani nepodnikne žádné kroky směrem k jeho zavedení.” is a maintenance commitment. If the Czech Republic has not adopted the euro when the responsible government takes office, the current state may be recorded as `+1` with the explanation: “Stav, který slib zachovává, zatím trvá.”
