# Release process

## Authority

This is the only release rule. Evidence and political scoring are governed by [evidence-pipeline.md](evidence-pipeline.md) and [scoring.md](scoring.md).

## Confirmed process

1. The author opens a scoped pull request for a change intended for `main`.
2. `Verify pull request` succeeds for its exact current head.
3. The owner reviews that head and either leaves feedback or replies `schvaluji`.
4. Any new commit invalidates the approval and returns the PR to verification.
5. The owner merges the approved verified head manually.
6. Cloudflare Workers Builds deploys `main`; the owner checks the result manually.

## Review feedback

For every addressed review item, the author posts or updates one visible Markdown response in the pull request. The response quotes the feedback title in a blockquote and immediately follows it with `Resolution:` explaining either the concrete change or the specific reason no change is made. It uses real Markdown paragraphs, not literal `\\n` text.

Resolve a line-review thread only after its response is present. When GitHub supports it, mark an addressed aggregate review comment as outdated.

## Optional AI code reviews

GitHub Copilot and Codex reviews are never initiated, requested, repeated, or awaited automatically. No pull-request event, workflow, agent, commit, draft-state change, or feedback event may trigger them. The owner may explicitly request one review for one identified pull request and exact head; it is advisory and never a release gate or owner approval.

## Boundaries

- Only `main` is deployed. Do not manually deploy an unmerged branch or enable public branch previews.
- CI verifies repository changes; it does not approve or merge them.
- The daily evidence workflow is operational automation, not a code-review trigger.
