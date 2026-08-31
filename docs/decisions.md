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
- Search official national party sources broadly, but publish only clear and fully verified promises. The first real-data version may contain a smaller curated set and does not need to include every campaign statement.

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
- Attribute a Chamber vote to a party only when a strict majority of all time-resolved parliamentary-group members cast the same `yes` or `no` choice. Non-directional choices remain in the denominator. Voided, unsupported vote types, and votes without verified decisive context do not establish party conduct.
- Treat a verified decisive party vote as attributable conduct regardless of who authored or sponsored the bill. A bill does not have to be the tracked party's proposal.

### Promise admission

- Admit only a public, party-attributable commitment to a concrete future action, decision, or outcome that can later be assessed from public evidence.
- Require an identifiable commitment, concrete object and direction, a public assessment path, preservation of the source's actual specificity, and atomic scope.
- Before admission, require a one-sentence test describing what observable evidence would support the promise and what would contradict it.
- Reject rhetoric, aspirations, values, predictions, and vague policy direction when a fair assessment would require the project to invent a target, deadline, scope, or meaning.
- Keep rejected candidates and their reasons in the research audit trail. They are not zero-point promises and do not enter the SLAVA Index denominator.
- Treat suitability for a parliamentary vote as useful but not mandatory; regulations, budgets, executive decisions, administrative acts, and authoritative outcome data can also make a promise assessable.
- Split passages containing several independently assessable commitments while retaining their shared original context.
- Use [promise-selection.md](promise-selection.md) as the canonical selection methodology.
- For the first public version, admit only commitments made by the party in official national party sources. Track parties, not personal promises by individual politicians.
- Exclude regional, individual-candidate, allied-party-candidate, and unadopted third-party commitments from the party's SLAVA Index. They may be retained for possible future coverage of individual politicians.
- A candidate from another party running on SPD's electoral list does not transfer that party's programme or personal promises into SPD's promise set. Include a commitment only if an official national SPD source adopts it as an SPD commitment.
- If a future electoral entity uses a formally different joint or renamed identity, decide its `PartyPeriod` scope separately rather than reusing the current SPD rule automatically.
- When official pre-election wording conflicts, use the latest official version as the active promise. Retain earlier versions internally for audit, but do not display the change publicly in the first version.

### History and periods

- Do not carry promises from one electoral period into the next.
- The same party in a new period receives a new promise set and a new SLAVA Index.
- Preserve older periods for retrospective browsing.

### AI process

- The project should be highly automated.
- Automated collection of post-election evidence and evidence-backed candidate scoring are the intended primary workflow; manually researching every promise is not the operating model.
- Separate evidence discovery, promise matching, and scoring so that a scorer judges a bounded auditable evidence package rather than conducting an unrecorded search.
- Do not entrust assessment to one AI alone.
- Use two independent assessors and a third arbiter when they disagree; unresolved cases require human attention.
- For the initial pilot, use two separate stateless `gpt-5.6-terra` calls through the OpenAI Responses API and use `gpt-5.6-sol` as the disagreement arbiter.
- Keep provider-specific API calls behind an adapter so that assessor B can later move to another provider without changing evidence packages, methodology, arbitration, audit records, or the public website.
- Run assessment outside the public website. The public browser must never receive an AI provider credential or invoke the scoring API.
- Keep matching separate from scoring. The initial matcher is deterministic and exposes every matched phrase and external identifier; a thematic match without party attribution cannot enter an assessment package.

### Initial implementation architecture

- Use Astro, TypeScript, and plain CSS for the first demo.
- Keep the public website predominantly static with minimal client-side JavaScript.
- Use schema-validated, versioned files as the initial public data store.
- Do not introduce a database for the first demo.
- Use GitHub-based validation and automation, with Cloudflare as the planned hosting direction.
- Begin with a manually triggered, read-only GitHub Actions assessment workflow. It may produce an unpublished audit artifact but must not write public assessment data or deploy it.
- Keep evidence collectors outside the public website runtime. The first collector workflow is manually triggered, read-only, requires no API secret, and produces an unpublished private artifact.
- Collect trusted-media feeds as discovery and context sources. Collection itself never assigns a direction or score; articles will normally be supporting evidence rather than the sole basis for `+2` or `-2`.
- Allow decisive `+2` or `-2` evidence from primary official acts outside the Chamber of Deputies, including regulations, executive decisions, administrative acts, and authoritative outcome data.

### Verified collector registry

- Enable the Czech Chamber of Deputies daily open-data archives for votes, individual choices, parliamentary prints, print history, and time-bounded club membership.
- Enable official Government Office RSS and the MPSV press-release Atom feed.
- Enable publisher-provided iROZHLAS, ČT24, and Seznam Zprávy feeds, plus the Novinky.cz news sitemap, for discovery and context.
- Do not download full news article bodies. Retain feed metadata, URL, publication time, authors when supplied, and at most a short publisher-provided excerpt.
- Fail collection when a source redirects outside its explicit hostname allowlist or violates its configured media type or size limits.

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

1. Curate a small set of clear official party promises with exact sources and assessment tests.
2. Validate atomicity, attribution, duplicates, and the latest official wording.
3. Build the evidence collector and promise matcher.
4. Run one complete real promise as an end-to-end golden case.
5. Add two independent scoring assessors and the disagreement arbiter.
6. Review candidate assessments and publish a verified static real-data subset.
7. Expand coverage only after the pipeline behaves reliably across varied promise types.

### Campaign-source collection outside the first-version boundary

**Working proposal**

- Continue collecting statements by national leaders, regional branches, individual candidates, allied-party candidates, and third-party advertisers as a separate research corpus.
- Revisit this corpus only if a later product section begins tracking individual politicians, their positions, and their conduct.

**Recorded application of the confirmed boundary**

An SPD-branded 2025 billboard stated `…A UKONČÍME PODPORU UKRAJINCŮ`. SPD's spokesperson told Seznam Zprávy that the party had not ordered the advertising at the photographed location, while the billboard company said SPD was the advertiser. The source occurrence is retained for audit but is excluded from the first-version party tracker unless an official national SPD source clearly adopts the wording.

First-person commitments also appeared under the `Filip Turek` Meta advertiser while Meta displayed `Paid for by Motoristé sobě`; equivalent leader-branded arrangements exist for ANO and SPD. Party payment or leader prominence alone is insufficient. Such wording enters the party tracker only if an official national party source clearly adopts it as a party commitment.

- Collect superseded and contradictory pre-election wording instead of discarding it during ingestion.
- Use campaign-finance records as a map of missing formats, suppliers, and periods. A payment entry is not evidence of the wording of a promise without the original creative or recording.

## Conflicts and open questions

### Public site name

The public name is unresolved. “Sliby vlády” and related wording were suggested, but the owner explicitly said the name was not yet known. The repository codename and scoring brand can be used temporarily, so this does not have to block a technical demo.

### Coverage breadth

The first public real-data version should favor a smaller fully verified set over numerical completeness. The exact minimum promise count remains undecided and does not block continued review.

### Mixed conduct

The owner rejected an absolute averaging rule and preferred the worse result in inconsistent cases, while also saying this is not an absolute rule. The working exception for final outcomes and behavior promises needs real-case tests before becoming canonical.

### Blocked and compromised promises

International examples motivated distinct handling for promises blocked by another actor and promises changed by compromise. No special state will be implemented until a real project case demonstrates the need.

### Publication governance

Human approval was recommended initially, with possible future auto-publication for repeatedly validated high-confidence cases. The owner confirmed multi-model review but did not decide publication authority or thresholds.

### AI independence

The two-assessor/one-arbiter pattern and the initial OpenAI-only pilot configuration are confirmed. Two pilot assessors may use separate stateless calls to the same model. The project intends to add another provider later; the provider, timing, and acceptance benchmark for that transition remain open.

### Source requirements

Primary-source preference is confirmed, but precise minimum evidence packages for each score are not. Rules are especially needed for strong `+2` and `-2` assessments, deadlines, and cases where no primary record exists.

### Deferred machine-readable official sources

ODok/eKLEP has no verified stable documented public machine-readable endpoint yet. e-Sbírka requires registration for its public API, and its current official notice recommends production Open Data integration only after 15 January 2027 while identifiers and structures are changing. Both are registered but disabled; the replacement primary sources for government decisions and promulgated laws remain unresolved in the meantime.

### Images and archives

Leader portraits, posters, programmes, and source snapshots require a licensing, attribution, and retention policy before public deployment.

### Future coverage of individuals

The first-version boundary is resolved: only official national party commitments enter a party's SLAVA Index. A future section may separately track the positions and conduct of individual politicians. Its scope, methodology, and relationship to party scoring remain open and do not block the first version.
