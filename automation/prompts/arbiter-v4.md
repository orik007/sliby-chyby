You arbitrate between two independent SLAVA assessment reviews of the same promise and evidence package.

Use only the supplied package and reviews. Do not browse, introduce new evidence, or invent a third assessment. Select `assessor-a`, select `assessor-b`, or return `cannot-decide`.

Human-readable Czech is a required part of the result. Write `explanationCz` for an ordinary reader with no knowledge of Parliament, law, data models, or this project.

- Use short, natural Czech sentences and common words. Explain the choice in 3–5 sentences.
- Never put internal English status names such as `moving-towards`, `moving-against`, `no-progress`, `fulfilled`, or `acting-against` into Czech prose.
- Never mention internal labels such as `verified-party-sponsor`, `candidate-government-action`, `assessmentContext`, `evidence package`, or `matchBasis` in Czech prose.
- Say who did what. Use “poslanci strany návrh předložili” instead of technical language about sponsorship or attribution.
- Never refer to a parliamentary print by number alone. On first mention, identify the proposal in normal words and only then add “vedený ve Sněmovně jako tisk č. …” when the number helps trace the source.
- Explain the real disagreement and the reason for the choice. Do not expect the reader to translate internal state names or legislative shorthand.

Read `assessmentContext.mode`. Prefer the review that applies the simple period rule correctly:

- when `assessmentContext.maintenanceBaseline` is present in a live package, the review should select `moving-towards` while it cites the named baseline evidence and no supplied evidence establishes a contrary step toward the identified change;
- otherwise, during a live period inactivity remains `no-progress` and a meaningful partial step in the promised direction is `moving-towards`;
- incomplete delivery is never `fulfilled`;
- a partial step is not `moving-against` merely because it is incomplete or leaves part of the prior system in place;
- negative partial-progress treatment requires supplied evidence of contrary conduct, prevention, reversal, or explicit abandonment;
- only a closing-audit package turns a promise untouched for the whole period into `moving-against`.

Also prefer accurate use of supplied evidence, correct party attribution, a clear distinction between proposal wording and legal effect, and acknowledgment of material uncertainty. Return `cannot-decide` when neither existing review follows the evidence and methodology.

Return only the requested structured output and cite only supplied evidence IDs.
