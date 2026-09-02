# Unpublished end-to-end pilot

## Status and purpose

**Confirmed decision**

AI assessments are unpublished proposals. A successful workflow run does not authorize publication and does not change public SLAVA Index data.

This report records the first end-to-end integration pilot run on 2026-08-31. It tests collection, deterministic matching, party attribution, bounded evidence packages, two independent stateless assessor calls, arbitration routing, and the publication gate. It is not a political assessment release.

## Fixed pilot configuration

The pilot used the then-current `party-vote-strict-majority-v1` attribution rule. A short-lived `party-vote-directional-majority-v2` rule was then tested and superseded. The current confirmed rule is `party-vote-strict-majority-v3`, which additionally sends a verified decisive no-majority vote for review as a possible `-1` failure to support the party's own promise. This historical report is not retroactively rewritten; the pilot should be rerun before its candidate results are considered under the current methodology.

An [EET 2.0 smoke rerun](https://github.com/orik007/sliby-chyby/actions/runs/33443286313) verified the now-superseded `deterministic-matcher-v2`, `slava-v2`, and `party-vote-directional-majority-v2` chain. The official party summary contained `68 yes` and `0 no`; both assessors again proposed `moving-towards`, and `publicationApproved` remained `false`.

The [current-methodology EET 2.0 smoke run](https://github.com/orik007/sliby-chyby/actions/runs/33447542557) verified `deterministic-matcher-v3`, `slava-v3`, `party-vote-strict-majority-v3`, and `assessor-v4`. ANO recorded `68 yes`, `0 no`, against a strict-majority threshold of `41`; both assessors proposed `moving-towards`, and `publicationApproved` remained `false`.

- Evidence cutoff: `2026-08-31`
- Parliamentary collection start: `2025-10-01`
- Source dataset: official Chamber of Deputies records
- Matcher: `deterministic-matcher-v1`
- Methodology: `slava-v1`
- Assessors: two separate `gpt-5.6-terra` Responses API calls
- Arbiter on assessor disagreement: `gpt-5.6-sol`
- Assessor prompt: `assessor-v2`, with its content hash retained in each audit
- Publication approval on every run: `false`

## Results

| Promise | Match result | Assessment routing | Unpublished result |
| --- | --- | --- | --- |
| ANO: introduce EET 2.0 | 108 thematic candidates; 17 attributable primary candidates; bounded package created | Both assessors ran and agreed; arbiter was not called | Candidate `moving-towards` (`+1`) |
| ANO: abolish public-media fees and fund public media from the state budget | 9 thematic candidates; 9 attributable primary candidates; bounded package created | Both assessors ran and agreed; arbiter was not called | Candidate `moving-towards` (`+1`) |
| ANO: return the retirement age to 65 | 3 thematic candidates; 3 government-action candidates; bounded package created | Both assessors found the supplied evidence insufficient; arbiter was not called | `human-review-required`; no candidate status |
| SPD: submit a constitutional act on a binding referendum | No candidate match; no package created | Assessors were not called | No assessment |
| Motoristé sobě: abolish the ban on sales on selected public holidays | 12 thematic candidates, but no collected decisive vote attributable to Motoristé; no package created | Assessors were not called | No assessment |

The workflow runs are retained in GitHub Actions:

- [ANO — EET 2.0](https://github.com/orik007/sliby-chyby/actions/runs/33436567715)
- [ANO — public-media fees](https://github.com/orik007/sliby-chyby/actions/runs/33437057034)
- [ANO — retirement age 65](https://github.com/orik007/sliby-chyby/actions/runs/33437244031)
- [SPD — binding referendum](https://github.com/orik007/sliby-chyby/actions/runs/33437352652)
- [Motoristé sobě — holiday sales ban](https://github.com/orik007/sliby-chyby/actions/runs/33437085059)

Private workflow artifacts contain the collector run, the complete match audit, any generated evidence package, and any assessment audit. GitHub retains these pilot artifacts for 30 days.

## 2026-09-02 repeatability check

**Pilot observation**

Two current-methodology reruns tested the remaining assessable packages from the first full-registry collection:

- [ANO — public-media fees, disagreement run](https://github.com/orik007/sliby-chyby/actions/runs/33566736553): the assessors proposed `no-progress` and `moving-towards`, while both marked the evidence insufficient. The old resolver stopped at human review before invoking the arbiter. This exposed a routing defect: a status or evidence-sufficiency disagreement must reach arbitration even when the final result may still require human review.
- [ANO — retirement age 65](https://github.com/orik007/sliby-chyby/actions/runs/33566750392): both assessors proposed `no-progress`, marked the evidence insufficient, and the case correctly remained `human-review-required` without a score candidate.
- [ANO — public-media fees after the routing fix](https://github.com/orik007/sliby-chyby/actions/runs/33567166092): both assessors independently proposed `no-progress` and marked the evidence insufficient. Because the reviews agreed, no arbitration was necessary and the case remained `human-review-required`.

Commit `e1a5cbc` changed the resolver so that disagreement about either status or evidence sufficiency requires arbitration. The arbiter may select an existing sufficient review, select an insufficient review that still routes to human review, or return `cannot-decide`. Deterministic tests cover these paths. No rerun in this repeatability check produced a live arbiter call after the fix because the repeated assessor pair agreed.

The repeatability check also identified a collection gap. Parliamentary print history supplied titles, procedural steps, sponsors, and linked votes, but the generated package did not contain the substantive text or a verified factual extract from the proposal. A title saying that an act is amended does not reveal whether the proposal fulfils or contradicts the precise promise. The subsequent `psp-print-document-v1` enrichment stage addresses this gap by hashing the official proposal DOCX and supplying bounded, mechanically selected, numbered excerpts. The affected pilots still require a new end-to-end run before any candidate result can be considered.

## 2026-09-02 official-document reruns

**Pilot observation**

- [ANO — public-media fees with official documents](https://github.com/orik007/sliby-chyby/actions/runs/33601067475) added the official proposal documents for prints 201 and 231 with no enrichment warning. Both assessors proposed `moving-against`: they treated ANO-linked print 201, which preserves the general fee system while widening exemptions, as a concrete step against categorical abolition. They did not attribute government print 231, which proposes full abolition and state-budget financing, to ANO. This consensus is an unpublished model candidate, not an accepted assessment. The case exposed the unresolved treatment of a partial reduction that coexists with a categorical promise and a separate unattributed full-repeal proposal.
- [ANO — retirement age 65 with official document](https://github.com/orik007/sliby-chyby/actions/runs/33601443481) added the official document for print 270 with no warning. Both assessors found that the explanatory text mentions a 65-year cap only as another planned change and that the supplied proposal excerpts do not enact that cap. Because the print is also only a `candidate-government-action`, both marked the evidence insufficient. The result remained `human-review-required` with no score candidate.

An earlier retirement-age attempt encountered one transient PSP download failure and continued without document evidence. Commits `0c2924d` and `a255757` added bounded official-document enrichment, transient retry, and a hard assessment gate: when a required print document remains unavailable, model calls do not run and the failed enrichment audit is uploaded. The clean retirement-age rerun above verified that corrected path.

## 2026-09-02 partial-progress rule regression

**Pilot observation**

The owner resolved the partial-measure question with the simple period rule recorded in [scoring.md](scoring.md): during a live electoral period, a meaningful concrete step advancing a real part of a promise is `moving-towards` (`+1`); incompleteness alone is not contrary conduct, and only the whole promised result can receive `fulfilled` (`+2`). Untouched promises remain `0` until the one-time closing audit, when an untouched full-period promise becomes `-1`.

The [public-media-fees regression run](https://github.com/orik007/sliby-chyby/actions/runs/33611903239) verified `slava-v4`, `assessor-v6`, `arbiter-v2`, and an explicit `live` assessment context. Both independent assessors proposed `moving-towards` with high confidence. They found that ANO-linked print 201 concretely narrows the groups required to pay public-media fees, while retaining the fee system and therefore falling short of complete fulfillment. Neither assessor attributed the separate government print 231 to ANO. The assessors agreed, no arbiter call was needed, and `publicationApproved` remained `false`.

This rerun supersedes the earlier model interpretation of the same supplied evidence as `moving-against`. It validates prompt compliance with the confirmed rule; it still does not publish the political assessment or bypass human review.

## 2026-09-02 full-registry assessment review run

**Pilot observation**

The [first full-registry assessment run](https://github.com/orik007/sliby-chyby/actions/runs/33615104174) collected every enabled source once, checked all 36 reviewed promises, enriched three assessable packages with official documents, and evaluated all three previously unseen assessment fingerprints. It produced no enrichment warning and retained three unpublished proposals on the dedicated review branch:

- ANO public-media fees: assessor A proposed `moving-against`; assessor B proposed `moving-towards`; the arbiter selected assessor B because incomplete partial progress is not contrary conduct under the confirmed live-period rule. The review candidate is `moving-towards`.
- ANO EET 2.0: both assessors proposed `moving-towards` with sufficient evidence. No arbiter was needed.
- ANO retirement age 65: both assessors proposed `no-progress` but marked the evidence insufficient for fair party attribution. The case remains `human-review-required` without a candidate status.

All three records have `humanReviewRequired: true` and `publicationApproved: false`. They are presented in [review pull request 1](https://github.com/orik007/sliby-chyby/pull/1). The workflow successfully pushed the review branch, but GitHub's repository setting initially prevented the Actions token from creating the pull request; the owner-authenticated CLI created this first PR without rerunning any model. The workflow now treats this permission boundary as a successful ready-to-review branch and emits a compare link when automatic PR creation is unavailable.

The immediate [unchanged-input rerun](https://github.com/orik007/sliby-chyby/actions/runs/33615561334) repeated collection, matching, and document enrichment but recognized all three assessment fingerprints as unchanged. It created zero new proposals and no assessment audit files, demonstrating that no assessor or arbiter API call was made. The workflow completed successfully without modifying the existing review branch or pull request.

## 2026-09-02 plain-Czech review rerun

**Pilot observation**

Owner review found that technically literal phrases such as “verified sponsorship link”, bare parliamentary-print numbers, and internal state values made the first audit difficult to read. The confirmed product rule now requires plain Czech for both public explanations and human-review summaries. Internal enum values remain only in machine-readable JSON fields, and legislative identifiers must be introduced together with a normal explanation of the proposal and its effect.

The [plain-Czech full-registry rerun](https://github.com/orik007/sliby-chyby/actions/runs/33617692052) used `assessor-v7` and `arbiter-v3`. Deterministic validation rejected internal status names, a bare form such as “tisk 201”, and the observed unnatural sponsorship phrase. All three replacement assessments passed. Each now includes a Czech `review.md` entry point with the proposed score in ordinary words, both independent explanations, any arbitration explanation, uncertainty, and clickable primary sources. The manifest marks the first proposal for each promise as superseded while retaining its immutable audit files.

The owner then clarified the audience boundary: reviewer material may be technical, but the exact candidate for the public website must be clearly isolated and understandable without audit context. The review renderer now labels that public candidate explicitly, adds a concrete reviewer checklist, and moves internal status values and audit paths into a separate technical section. The deterministic plain-Czech validation continues to apply to the model-written public explanation.

## Verified pipeline behavior

**Pilot observation**

- The matcher did not turn thematic similarity into party attribution. The Motoristé promise matched bills introduced by other parties, but the collected records contained no decisive strict-majority Motoristé vote. Authorship by another party was not the reason for exclusion; the missing Motoristé vote was.
- Absence of relevant evidence did not become `no-progress`. The SPD promise stopped before any model call.
- A government bill was not silently attributed to ANO. For the retirement-age promise, the assessors identified both missing party attribution and missing bill substance and routed the case to human review without a score.
- Verified party sponsorship or a strict-majority party vote supplied the attribution needed for the two `+1` candidates.
- The two successful candidate assessments remained unpublished and retained model, prompt, evidence, confidence, and uncertainty metadata.

## What this pilot does not prove

**Open validation work**

- No verified real pilot case produced `moving-against`, `acting-against`, or `fulfilled`. Those paths have deterministic tests but still need honest real-source benchmarks.
- A live disagreement exposed and led to a fix of the arbitration-routing defect, but a post-fix live run has not yet exercised the arbiter because its assessor pair agreed.
- Both assessors used the same model family. A second provider and its acceptance benchmark remain open.
- The current collector coverage is not sufficient for all official acts outside the Chamber of Deputies.
- Human publication authority, review screens, and publication thresholds remain unresolved.

No missing status was manufactured merely to make the pilot cover every branch.
