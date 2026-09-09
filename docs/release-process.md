# Release process

This document is the canonical operational policy for repository pull requests, approval, merge, and deployment.

## Confirmed decisions

- GitHub is the durable pull-request system of record. Codex and GitHub Copilot provide advisory code review through GitHub; Cloudflare has no pull-request, review, approval, webhook, or feedback-resolver role.
- A review request identifies one pull request and its exact current head. A pull request may be merged only after `Verify pull request` succeeds for that same head.
- Automatic Codex review is disabled. The PR coordinator requests GitHub Copilot as a reviewer and posts `@codex review` only for each of the at most two permitted shared review waves. A plain `@copilot` mention is not a Copilot review request.
- Review credits are a constrained resource. Each PR has at most two shared AI review waves, never two waves per reviewer. Gather findings for one head and resolve valid findings in one consolidated remediation commit. Do not request either reviewer twice for one wave and head, and do not request a third wave.
- Every AI finding is evaluated against code and canonical documentation. Fix valid findings; add a concise evidence-based disposition for non-applicable ones; reply to and resolve every addressable thread. Summary-only or suppressed feedback receives a disposition in the pull-request conversation.
- The Codex PR coordinator applies the `sliby-ready-for-owner-approval` label only after it has disposed of every AI finding for the applicable review path. The GitHub Actions ready notifier then posts one owner notice only after a reviewed head, or the single permitted final remediation commit after the second reviewed head, has a successful verification run and no unresolved review threads. Its hidden marker binds the notice to that head without asking the owner to type a hash. A new commit removes the label.
- The repository owner approves only by posting a new standalone `schvaluji` comment after that ready notice. The GitHub Actions merge gate verifies the marker, current head, successful verification, and resolved threads again before merging. A changed head invalidates the notice and cannot merge from an older approval.
- Any other owner comment is feedback. A narrow GitHub Action asks Codex to address it in the PR; Codex may make an in-scope change, but it never approves or merges. Owner feedback after wave two does not create a third review wave.
- GitHub Actions uses the `github-actions[bot]` identity only for mechanical ready notices and merges. Codex and Copilot retain their own GitHub identities; neither is owner approval.
- A successful merge into `main` is the production release boundary. Cloudflare Workers Builds deploys the public Worker from `main` only; unmerged branches and review proposals have no public deployment.

## Operational role boundaries

These roles handle repository quality and release only. They do not collect evidence, assess a political promise, or approve publication of a political assessment.

| Role | Owns | Must not do |
|---|---|---|
| PR author | Delivers one scoped change, runs local validation, and asks the coordinator to start review for the ready head. | Approve, merge, or treat an AI review as an approval. |
| Codex PR coordinator | Requests the two permitted shared review waves, evaluates findings and owner feedback, makes in-scope fixes, and records thread dispositions. | Approve, merge, publish political assessments, request a reviewer twice for one head, or start a third wave. |
| GitHub Copilot and Codex reviewers | Independently review the requested exact head and report advisory findings. | Edit the branch, resolve an owner decision, approve, or merge. |
| Ready notifier | A deterministic GitHub Action that, after the coordinator applies the ready label, checks a reviewed head or the one permitted post-wave-two remediation head, verification, and thread resolution, then posts a signed ready notice. | Interpret feedback, request reviews, edit code, or merge. |
| Approval gate | A deterministic GitHub Action that accepts only the owner's exact `schvaluji` after a matching ready notice and rechecks gates before merge. | Interpret feedback, edit code, score political claims, or override a changed head. |
| Owner | Posts `schvaluji` in the individual ready PR or writes feedback. | Delegate approval implicitly to a reviewer. |
| Cloudflare Workers Builds | Builds and deploys successful `main` to the public Worker. | Coordinate a pull request, receive GitHub webhooks, inspect feedback, or deploy a review branch. |

## Required approval flow

1. The PR author runs relevant validation and asks the Codex PR coordinator to start review for the current ready head.
2. The coordinator requests GitHub Copilot through GitHub's reviewer request and posts one `@codex review`. It records that both requests apply to this head. Automatic review remains disabled, so opening a PR, changing draft status, and pushing a commit do not create duplicate requests.
3. If wave one finds issues, the coordinator evaluates every finding, makes one consolidated remediation commit for valid fixes, explains non-applicable findings, and resolves addressable threads. It then requests wave two for the resulting exact head, even if no fix changed that head. If wave one has no findings, step 4 applies directly.
4. If wave two finds issues, the coordinator handles and resolves them in one final remediation commit containing only direct fixes for cited valid findings; it does not request a third wave. Once the applicable reviewed head, or this one permitted final remediation head, has a successful `Verify pull request` run and every review thread is resolved, the coordinator applies the `sliby-ready-for-owner-approval` label. `present-ready-pr.yml` independently rechecks those gates and posts a single `@orik007` ready notice bound to that head. GitHub Mobile opens this individual PR from the mention.
5. The owner replies exactly `schvaluji` as a new PR comment. `merge-approved-pr.yml` accepts it only if the matching signed ready notice predates it and all deterministic gates still apply to the unchanged head. It then performs the repository's normal merge method.
6. Any other owner comment triggers `route-owner-feedback.yml`, which asks Codex to handle the feedback in the PR. Before wave two, an in-scope correction returns the process to step 3; after wave two, it receives deterministic revalidation but never a third AI review. This route never requests an AI review by itself.
7. The merge into `main` starts the existing Cloudflare Workers Builds deployment of the public web. A failed validation, merge gate, or deployment keeps the previously deployed public version live.

## Implementation boundaries

- `present-ready-pr.yml`, `merge-approved-pr.yml`, and `route-owner-feedback.yml` contain only deterministic GitHub API operations and an explicit Codex mention. They make no OpenAI API call, receive no AI credential, store no pull-request state outside GitHub, and run no untrusted branch code.
- The required reviewer identities are `copilot-pull-request-reviewer` and `chatgpt-codex-connector`, as verified from the repository's actual PR review records. GitHub may append `[bot]` to its REST API login values; the notifier normalizes only that suffix before matching. It accepts a head reviewed by both identities, or exactly one commit following the second shared reviewed head.
- Create the repository label `sliby-ready-for-owner-approval` once, with any clearly distinct color. It is an operational handoff marker, not an owner approval. The notifier removes it when the PR head changes, so Codex must deliberately apply it again after completing the applicable two-wave path.
- GitHub's `issue_comment` workflows run from the default branch. The repository must allow **Read and write permissions** for GitHub Actions so the approval gate can merge. The workflows do not act on forks.
- This process is separate from assessment automation. A merged assessment-review proposal remains unpublished until the owner separately approves identified political proposals.

## Current operational state

The public Worker `sliby-chyby` is deployed from `main` and serves the public site. The former Cloudflare release-controller Worker, custom GitHub App webhook receiver, Durable Object state, direct OpenAI feedback resolver, and their deployment configuration were never deployed and are removed from this design.

## Open questions

- Which public product name and custom domain will replace the temporary hosting addresses.
- When the earlier ChatGPT Sites demo should be removed.
