# Decision register

## How to read this file

- **Confirmed decision** means the owner explicitly selected or affirmed it.
- **Working proposal** means it was recommended in the imported conversations but not finally accepted.
- **Open question** means it is unresolved, contradictory, or needs a precise rule.

Dates are omitted because the imported conversations did not frame decisions as a formal dated log.

## Confirmed decisions

### Product focus

- Track pre-election promises of specific political parties and compare them with later conduct and outcomes.
- Do not limit the project to a government's collective programme.
- Start with the current period and ANO, SPD, and Motoristé.
- Optimize for a simple public overview rather than complex analysis.
- Make detailed explanations and sources available after expanding or opening a promise.
- Design mobile-first and make the first view understandable within seconds.

### Identity and scoring

- Name the aggregate **SLAVA Index**, without diacritics.
- Use per-promise values `-2`, `-1`, `0`, `+1`, and `+2`.
- Distinguish inaction (`0`) from active conduct against a promise (negative values).
- Normalize the aggregate to a range from `-100` to `+100`.
- Display the aggregate as index points without a percent sign, for example `SLAVA Index: +14`. This is a reversible presentation decision.
- Do not include a public “not assessable” state yet. Add special handling only after a real promise demonstrates the need.
- Use one current assessment per promise; do not average multiple votes.
- Preserve contradictory evidence instead of allowing positive and negative votes to cancel mechanically.
- Prefer an arrow for directional states and one check mark for fulfilled in the simple UI.

### Evidence

- Preserve the exact original promise and source.
- Use at least the promise source and evidence of actual conduct; intended conduct may form a third evidence layer.
- Prefer official primary records for promises, votes, laws, budgets, and decisions.
- Use major news sources for discovery, context, and cross-checking.
- Verify important claims elsewhere; do not trust one article merely because it comes from a large outlet.

### History and periods

- Do not carry promises from one electoral period into the next.
- The same party in a new period receives a new promise set and a new SLAVA Index.
- Preserve older periods for retrospective browsing.

### AI process

- The project should be highly automated.
- Do not entrust assessment to one AI alone.
- Use two independent assessors and a third arbiter when they disagree; unresolved cases require human attention.

### Initial implementation architecture

- Use Astro, TypeScript, and plain CSS for the first demo.
- Keep the public website predominantly static with minimal client-side JavaScript.
- Use schema-validated, versioned files as the initial public data store.
- Do not introduce a database for the first demo.
- Use GitHub-based validation and automation, with Cloudflare as the planned hosting direction.

## Working proposals

### Public interface

- Home page: site title, period selector, three large circular party portraits, and a red-to-green index scale.
- Party page: index, distribution, simple promise rows, symbol plus label, expandable evidence.
- Promise page: original wording, plain-language explanation, decisive primary evidence, articles, update date, and revision timeline.
- Candidate symbol set: `✓`, `↗`, `—`, `↘`, `×`, and `?`.
- Give each party and promise a permanent, shareable route.

### Methodology

- Classify promises as outcome, process, or behavior promises.
- Articles normally identify direction (`+1`/`-1`); completed outcomes can reach `+2`/`-2` only after primary-source verification.
- While an outcome remains unresolved, meaningful contradictory actions generally use the worse applicable interim assessment.
- A definitive outcome can supersede prior directional steps for an outcome promise, while an already broken one-time behavior promise may remain broken.
- Keep blocked-by-another-actor and materially compromised promises outside the main five-point scale until a precise rule is chosen.

### Delivery sequence

1. Agree documentation and unresolved implementation choices.
2. Create a clearly labeled local demo using fabricated data.
3. Encode and test scoring invariants.
4. Research one complete real promise as a golden case.
5. Expand to a varied small set before automating at scale.
6. Build controlled ingestion and multi-model assessment.
7. Add a private preview deployment before any public launch.

## Conflicts and open questions

### Public site name

The public name is unresolved. “Sliby vlády” and related wording were suggested, but the owner explicitly said the name was not yet known. The repository codename and scoring brand can be used temporarily, so this does not have to block a technical demo.

### Coverage breadth

The vision mentioned all concrete promises, while the implementation discussion recommended one golden case and then approximately ten varied promises before large-scale ingestion. Decide the first public release threshold later; it does not block a demo.

### Party vote attribution

No rule yet determines when individual votes represent a party position. Store the complete vote distribution and membership at the vote date. A threshold or classification rule is needed before real automated scoring, but not before a UI demo.

### Mixed conduct

The owner rejected an absolute averaging rule and preferred the worse result in inconsistent cases, while also saying this is not an absolute rule. The working exception for final outcomes and behavior promises needs real-case tests before becoming canonical.

### Blocked and compromised promises

International examples motivated distinct handling for promises blocked by another actor and promises changed by compromise. No special state will be implemented until a real project case demonstrates the need.

### Publication governance

Human approval was recommended initially, with possible future auto-publication for repeatedly validated high-confidence cases. The owner confirmed multi-model review but did not decide publication authority or thresholds.

### AI independence

The two-assessor/one-arbiter pattern is confirmed. Whether independence requires two model families or two providers, and which models are acceptable, remains open.

### Source requirements

Primary-source preference is confirmed, but precise minimum evidence packages for each score are not. Rules are especially needed for strong `+2` and `-2` assessments, deadlines, and cases where no primary record exists.

### Images and archives

Leader portraits, posters, programmes, and source snapshots require a licensing, attribution, and retention policy before public deployment.
