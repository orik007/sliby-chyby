# Evidence assessment automation

The workflow and its rules are defined only in [docs/evidence-pipeline.md](../docs/evidence-pipeline.md); attributable conduct and scores only in [docs/scoring.md](../docs/scoring.md).

| Directory | Contents |
| --- | --- |
| `pipeline-generation` | Audit-state generation; see [Pipeline generation](../docs/evidence-pipeline.md#pipeline-generation). |
| `collectors/` | Active source registry; per-source checkpoints live on the audit branch. |
| `attribution/` | Governing parties and their dates. |
| `promise-registry/` | Registry of confirmed promises used by the pipeline. |
| `topic-routing/` | Routing taxonomy; the tag-assignment cache lives on the audit branch. |
| `print-acts/` | Cache of acts amended by each Chamber print, read from its official text (audit branch only). |
| `evidence-packages/` | Unpublished queue of bounded evidence packages (audit branch). |
| `review-proposals/` | Unpublished assessment proposals for human review (audit branch). |
| `prompts/` | Active tagger, assessor, and arbiter prompts. |

Everything on the audit branch is unpublished and never changes public data or a public score. The workflow never starts Copilot or Codex review.
