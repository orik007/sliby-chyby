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
- The arbiter was not exercised by these live cases because the assessor pairs did not disagree.
- Both assessors used the same model family. A second provider and its acceptance benchmark remain open.
- The current collector coverage is not sufficient for all official acts outside the Chamber of Deputies.
- Human publication authority, review screens, and publication thresholds remain unresolved.

No missing status was manufactured merely to make the pilot cover every branch.
