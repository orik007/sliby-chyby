# Promise selection

## Authority

This is the only operational definition of a promise's lifecycle. It is a **confirmed decision**. Scoring is defined separately in [scoring.md](scoring.md); neither a score nor evidence coverage changes a promise's lifecycle state.

## The three states

Every source occurrence has exactly one state:

| State | Meaning | Public? |
| --- | --- | --- |
| `candidate` | A possible promise found during research. It has not yet passed the rules below. | No |
| `confirmed` | A verified promise of one tracked party in one electoral period. Confirmation publishes it immediately. | Yes |
| `rejected` | The occurrence is not a promise for this catalogue. Its rejection reason is retained. | No |

There is no `confirmed-but-unpublished` state. “Published promise” always means `confirmed` promise. A candidate or rejected occurrence may have a stored default score of `0` for technical consistency, but it is not public and never enters the SLAVA Index.

## Confirming a candidate

Confirm a candidate only when all of these are true:

1. Its wording comes from an official national source of the tracked party.
2. It is a commitment to a future action, decision, conduct, or assessable outcome.
3. It identifies a sufficiently clear object and direction without adding precision absent from the source.
4. It can be checked later against both supporting and contradicting evidence.
5. It is one independently assessable commitment. Split a composite statement into separate candidates before confirmation.

The confirmed promise preserves the exact Czech wording, the official URL, and a precise locator such as a page, timestamp, or image region. If official pre-election wording changes, the latest official wording is the active promise; earlier wording remains in the research audit.

## Rejecting a candidate

Reject a candidate with a short reason when it is, for example:

- a slogan, value, aspiration, or vague intention rather than a commitment;
- a personal, regional, allied-party, or third-party statement not clearly adopted by the tracked national party;
- a duplicate source occurrence;
- an unresolvable attribution problem; or
- an unusable, non-atomic statement that cannot be split faithfully.

These are rejection reasons, not additional lifecycle states. A later source can create a new candidate; it does not retroactively change a rejected occurrence without a recorded correction.

## First-version attribution boundary

Only clear commitments from official national party sources may be confirmed for the initial public catalogue. Statements by individual politicians, regional branches, coalition partners, advertisers, or media do not transfer to the party unless an official national party source explicitly adopts them.

## Publication boundary

Confirmation is a normal validated data change: create the public promise, its primary source, and its first score revision with value `0` together. Confirmation does not require later conduct evidence or an AI assessment. Rejection and candidates remain under `research/` with their audit trail.

## Open question

The eventual closing state after an electoral period ends is not defined or implemented. Do not add one before a separate confirmed decision.
