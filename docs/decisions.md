# Decision register

## How to read this file

- **Confirmed decision** means the owner explicitly selected or affirmed it.
- **Working proposal** means it was recommended in the imported conversations but not finally accepted.
- **Open question** means it is unresolved, contradictory, or needs a precise rule.

Dates are omitted because the imported conversations did not frame decisions as a formal dated log.

The documentation hierarchy is a **confirmed decision**: [promise-selection.md](promise-selection.md) controls admission, [evidence-pipeline.md](evidence-pipeline.md) controls collection and matching boundaries, and [scoring.md](scoring.md) contains the single assessment decision order. This register preserves accepted choices and open questions but is not a parallel checklist for assessors.

## Confirmed decisions

### Product focus

- Track pre-election promises of specific political parties and compare them with later conduct and outcomes.
- Do not limit the project to a government's collective programme.
- Start with the current period and ANO, SPD, and Motoristé.
- Optimize for a simple public overview rather than complex analysis.
- Make detailed explanations and sources available after expanding or opening a promise.
- Design mobile-first and make the first view understandable within seconds.
- In every human-review document, visibly separate the proposed public copy from technical reviewer material. Only the public-copy section can become a candidate for the website, and review or merge alone does not publish it.
- Write proposed public explanations in plain, natural Czech for ordinary readers. They must make sense without audit context and state who did what and how it affects the promise. Technical reviewer material may use internal English status values and project terms when clearly separated from public copy.
- Explain parliamentary and legal identifiers on first use in proposed public copy. State what the proposal or decision is and what it changes; never rely on a bare reference such as “tisk 201”.
- Search official national party sources broadly, but publish only clear and fully verified promises. The first real-data version may contain a smaller curated set and does not need to include every campaign statement.
- Publish the two human-approved 2026-09-03 revisions for ANO's EET 2.0 and public-media-fee promises as the first real public records. Preserve their exact programme wording, primary evidence links, and review-proposal identifiers.
- Run one complete evidence pipeline every day at 09:37 in `Europe/Prague`; keep the manual workflow trigger for recovery and backfills.
- Display the latest successful complete collection date on every public page. A failed run leaves the previous successful date visible and does not alter public assessments.
- Prefer this single daily schedule over near-real-time collection until observed missed evidence demonstrates a need for more complexity.

### Live public aggregate

- Calculate and display the SLAVA Index from every currently published promise for a party, even while the promise set is still growing.
- Recalculate the index automatically whenever another verified promise or a new current assessment is published.
- If a party has no published promises, show the index as unavailable rather than zero.
- Treat the site and its calculations as production data. Do not keep fictional demo records in the production data directories.

### Identity and scoring

- Name the aggregate **SLAVA Index**, without diacritics.
- Use per-promise values `-2`, `-1`, `0`, `+1`, and `+2`.
- Distinguish inaction (`0`) from active conduct against a promise (negative values).
- Normalize the aggregate to a range from `-100` to `+100`.
- Display the aggregate as index points without a percent sign, for example `SLAVA Index: +14`. This is a reversible presentation decision.
- Label the home-page index scale with `-100` at the left and `+100` at the right so its range is visible immediately.
- Do not include a public “not assessable” state. Every published promise starts at `0` and remains there until verified evidence establishes a meaningful directional step. `0` means no verified significant movement has been established; it does not assert that the party did nothing or that no undiscovered record exists.
- Use one current assessment per promise; do not average multiple votes.
- Preserve contradictory evidence instead of allowing positive and negative votes to cancel mechanically.
- Prefer an arrow for directional states and one check mark for fulfilled in the simple UI.
- During an active electoral period, an untouched promise remains `0`; elapsed months alone never create a penalty.
- A meaningful concrete step advancing a real part of the promise is `+1`, even when incomplete. Only the whole promised result, exact promised conduct, or the confirmed decisive-vote completion of a full legislative promise can receive `+2`.
- Do not infer that a partial step is final or negative merely because part of the old system remains or no later step has appeared. Negative treatment requires documented contrary conduct, prevention, reversal, or explicit abandonment.
- Perform one closing audit at the end of the electoral period. A promise untouched for the entire period changes from `0` to `-1`; meaningful partial progress remains `+1`.
- An earlier closing point exists only when the original promise contains an explicit deadline or one-time event. Do not invent implicit waiting periods.

### Evidence

- Preserve the exact original promise and source.
- Use at least the promise source and evidence of actual conduct; intended conduct may form a third evidence layer.
- Prefer official primary records for promises, votes, laws, budgets, and decisions.
- Use major news sources for discovery, context, and cross-checking.
- Verify important claims elsewhere; do not trust one article merely because it comes from a large outlet.
- Require a strict majority of the complete time-resolved parliamentary group to establish positive or negative party voting conduct. At a verified decisive vote on a motion that directly and materially advances the party's own promise, failure to provide a strict-majority `yes` is normally `moving-against` (`-1`), not ordinary inactivity. Retain all individual choices for transparency. Voided, unsupported vote types, and votes without verified decisive context do not establish party conduct.
- Treat a verified decisive party vote as attributable conduct regardless of who authored or sponsored the bill. A bill does not have to be the tracked party's proposal.
- For a legislative promise, treat an attributable formal proposal that materially advances the promise as `+1`. Treat the party's strict-majority `yes` at a verified decisive substantive vote as `+2` when the voted measure itself would deliver the whole legislative promise, regardless of who introduced it and regardless of whether other parties provide enough votes for the motion to pass. A vote on a partial measure remains `+1`.
- Treat a verified, attributable pre-vote commitment as directional evidence: an announced intention to support the exact promise can be `+1`, and an announced intention to oppose it can be `-1`. A later roll-call vote is stronger evidence and may confirm or supersede the intention.

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
- Use a staged evidence process to control cost without sacrificing traceability: during the initial historical backfill, collect and match the complete enabled configured source inventories without model calls; during routine operation, process only new or changed records. Build each affected promise's package from its cumulative current candidate evidence, not only the latest increment. Then perform targeted official-source expansion only when inventory matching produces no attributable primary candidate evidence for a promise or when both independent assessors identify insufficient evidence. After a resolver run, assess the expanded package only if its assessable content has materially changed; changes to methodology, prompt content, providers, or model identifiers remain independent reassessment triggers through the assessment fingerprint. A capped unresolved expansion remains a human-review case; assessors and arbiters never browse independently.
- Operate routine evidence collection incrementally. After the initial historical backfill, persist a durable server-side archive of normalized record versions and process only new or changed records from each source. Match every such record against the complete reviewed promise registry. A newly admitted promise, or an existing promise whose matching-relevant fingerprint changes, receives one backfill against the complete retained archive before returning to this incremental regime. That fingerprint includes the active promise wording and matching configuration, plus the matcher rules version. The implementation must not depend on an owner's computer or an ephemeral cache.
- Keep the evidence roles separate: the collector retrieves and versions source records; the matcher creates candidate promise links; the resolver identifies the exact missing official record targets for one affected promise; the enricher retrieves known targets and extracts bounded passages; assessors and the arbiter judge only the resulting bounded package. No upstream role assigns a score or publishes a result.
- Treat assessment API credits as a constrained resource without sacrificing evidence quality. Collection, matching, resolution, and enrichment are non-model stages. Assessors and the arbiter run only for a new assessment fingerprint, which includes assessable content and methodology/model inputs but excludes volatile run metadata. A resolver cache is idempotent for its promise, evidence fingerprint, permitted source scope, resolver version, and target-source revision, ETag, or cursor; when no source revision can be observed, it instead records a bounded next eligible retry time. An unchanged recheck must not trigger assessment.
- Treat AI credits as a constrained project resource. Every pull request has at most two shared AI review waves, each covering one exact head. Run the first wave for the ready initial head. If it has no findings, present the verified head to the owner. If it has findings, evaluate and dispose of every finding, make one consolidated remediation commit for valid fixes, and run the second wave after all addressable threads are resolved; run that second wave even if the first-wave disposition did not change the head. If the second wave has no findings, present its verified head to the owner. Otherwise, resolve every second-wave finding in one final remediation commit containing only direct fixes for cited valid findings, validate that final head, and present it to the owner without a third AI review. Before owner approval, the exact current head must pass deterministic validation and have no unresolved addressable review threads. Owner feedback may return the PR to its one resolver task for an in-scope change and deterministic revalidation, but never to a third AI review. A scope expansion or newly discovered material issue moves to a new pull request. Before the release controller requests either reviewer, it confirms in durable per-PR state and the GitHub timeline that the same reviewer has not already been requested for that wave and exact head.
- Require assessors and arbiters to produce reader-facing Czech explanations without internal enum names, attribution labels, unexplained parliamentary shorthand, or unnatural translations of implementation terms.
- Remove a parliamentary print number from the public candidate when it adds only an internal identifier. Keep the number, exact source, and original assessor wording in the technical reviewer audit.
- When both independent assessors agree, show their shared result only once in `review.md`; retain both complete outputs in `assessment-run.json`. Show both opinions in `review.md` only when they disagreed and a third assessor had to arbitrate.
- Accept an unambiguous Codex message from the owner that identifies specific proposals as editorial approval. Preserve the approval in the publication change. A generic acknowledgement and a review-proposal merge are not publication approval.

### Release approval and delivery

- Run the review, approval, merge, and deployment process on server-side services. It must not depend on the owner's computer or an active local or Remote session.
- Use the GitHub pull request itself as the mobile approval conversation. When a PR is ready, the release controller posts one ready-for-owner-approval comment mentioning `@orik007`; GitHub Mobile delivers that mention and opens the individual PR rather than a shared inbox.
- Use one independently acting GitHub App, `slibychyby-release-control[bot]`, for release state transitions. It is a coordinator only: it records state, requests permitted reviewer waves, recognizes owner approval or feedback, verifies gates, and performs the permitted merge. It never edits the change or evaluates the substance of a finding or owner feedback.
- Treat the owner's exact standalone `schvaluji` comment in a pull request with an active ready-for-owner-approval notice as approval for the pull request and the exact head revision stored with that notice. Ordinary pull-request conversation comments do not expose a reliable parent-comment reference, so the controller binds the short approval to that one active notice. The owner does not type a commit hash. Before merge, the release controller must verify that this stored head is still current and that all required gates still pass.
- Treat any other owner comment as feedback. The controller must return the PR to one server-side feedback-resolver task for that PR, without merging. The resolver reads and addresses the comment, then the controller revalidates and posts a new ready-for-owner-approval comment. Owner feedback never creates a third AI review wave.
- Invalidate approval when the pull request head changes. A new ready-for-owner-approval comment is required after deterministic verification, but no third AI review is allowed.
- Merge only after the project's explicitly defined server-side verification succeeds for the approved revision.
- Treat a successful merge into `main` as the release boundary and follow it with deployment.
- Report merge and deployment success or failure in the same pull-request conversation.
- Request both GitHub Copilot code review and Codex review in at most two review waves for every pull request. Each review wave covers its exact head commit. If the first wave has no findings, present that verified head to the owner. Otherwise, evaluate every finding, record concise evidence-based dispositions for non-applicable findings, resolve all addressable threads, and make one consolidated first-wave remediation commit for valid fixes before the second wave. Run the second wave even if the first-wave disposition did not change the head. If the second wave has no findings, present its verified head to the owner. Otherwise, resolve every second-wave finding in one final remediation commit without starting a third review wave; that commit may contain only direct fixes for cited valid findings. Before owner approval, the exact current head must pass the verification workflow and have no unresolved addressable review threads. Any scope expansion or newly discovered material issue moves to a new pull request.
- A review wave is shared across Copilot and Codex, not a separate two-wave allowance for each reviewer. Automatic Codex review is disabled. The release controller alone creates each permitted Copilot request and `@codex review` request after checking durable per-PR state and the GitHub timeline. The PR author and feedback resolver never request reviewers. The controller must not treat pull-request opening, ready-for-review changes, later commits, or owner feedback as review triggers.
- Keep release responsibilities separate: the PR author delivers a scoped validated head; the release controller owns state transitions, the two-wave counter, reviewer requests, and gate verification; one feedback-resolver task evaluates findings and owner feedback and makes only permitted remediation commits; CI verifies; and Cloudflare deploys `main`. The release controller never edits or interprets feedback, and the resolver never requests reviewers or merges. No role may silently take over another role's authority.
- Permit the one cloud feedback resolver to send the exact pull-request diff and `docs/release-process.md` to the project's OpenAI API project only after a reviewer finding or owner feedback. It may return an explanation or a minimal unified patch. Before it can commit, the patch must be limited to files already changed by the pull request, exclude workflows, secrets, and release-policy files, pass `git apply --check`, the complete test suite, and the production build. The resolver runs at most once at a time for each pull request and commits only to that same non-fork branch under its bot identity.
- Treat both AI reviews as advisory quality gates. Neither one substitutes for the owner's exact-revision approval.
- Use Cloudflare Workers as the production deployment target before the final domain is selected; this preserves the site's server-rendered collection-status endpoint.
- Deploy only the `main` branch to production. Do not configure a non-production build trigger, so unpublished review proposals do not receive public preview URLs.
- The ChatGPT Sites address was kept as a temporary demo during the hosting transition. That transition is now complete; this historical decision does not set a future retention deadline.

### Initial implementation architecture

- Use Astro, TypeScript, and plain CSS for the initial production site.
- Keep the public website predominantly static with minimal client-side JavaScript.
- Use schema-validated, versioned files as the initial public data store.
- Do not introduce a database for the initial production site.
- Use GitHub-based validation and automation, with Cloudflare Workers Builds as the confirmed production deployment target.
- Keep the single-package assessment pilot read-only. The full-registry workflow may write only versioned unpublished review proposals to its dedicated branch; it must never write public assessment data or deploy it.
- Keep evidence collectors outside the public website runtime. Collection remains source-oriented and non-scoring even when later stages of the same scheduled or manually triggered workflow use the assessment API.
- Collect trusted-media feeds as discovery and context sources. Collection itself never assigns a direction or score; articles will normally be supporting evidence rather than the sole basis for `+2` or `-2`.
- Allow decisive `+2` or `-2` evidence from primary official acts outside the Chamber of Deputies, including regulations, executive decisions, administrative acts, and authoritative outcome data.
- Run collection once per pipeline execution and match the resulting shared record set against every reviewed promise. Do not repeat source downloads separately for each promise.
- Keep the full-registry collection and matching stages deterministic, non-AI, and unpublished. Send only generated assessable evidence packages to the later assessor stage.
- Allow one collected record to become a candidate match for zero, one, or several promises. Matching establishes possible relevance only; it never determines direction or score.
- Reassess only evidence packages whose deterministic content hash is new or changed. Do not spend model calls on unchanged packages.
- Persist automated assessment proposals as versioned files on a dedicated GitHub review branch and present them through a pull request. Every proposal remains unpublished and requires human review.
- Merging an assessment-proposal pull request preserves the audit history only. It does not publish a score, update the SLAVA Index, or deploy political assessment data.
- Include assessable evidence, methodology, active prompt content, providers, and model identifiers in the assessment fingerprint. Exclude volatile collection timestamps and run identifiers so they do not trigger paid reassessment.

### Verified collector registry

- Enable the Czech Chamber of Deputies daily open-data archives for votes, individual choices, parliamentary prints, print history, and time-bounded club membership.
- Enable official Government Office RSS as a current-window official discovery source.
- Enable publisher-provided iROZHLAS, ČT24, and Seznam Zprávy feeds, plus the Novinky.cz news sitemap, for discovery and context.
- Do not download full news article bodies. Retain feed metadata, URL, publication time, authors when supplied, and at most a short publisher-provided excerpt.
- Fail collection when a source redirects outside its explicit hostname allowlist or violates its configured media type or size limits.
- Record the historical coverage semantics of every source. A requested cutoff is not evidence of historical completeness when an RSS or news-sitemap endpoint exposes only a current window.
- Generate an unpublished coverage audit for every reviewed promise after matching. `No candidate match` is a pipeline result, not proof of inactivity or a directional assessment; it leaves a published promise's default `0` unchanged under [`scoring.md`](scoring.md).
- Enable the complete official Ministry of Finance annual press-release indexes for 2025 and 2026 and the official paginated Ministry of Health press-release REST archive as historical discovery sources.
- Replace the limited MPSV current feed with its complete paginated annual press-release indexes for 2025 and 2026.
- Enable the Ministry of Culture chronological news archive and retain only entries labelled by the publisher as ministry items; exclude subordinate-organization items and event previews from this source.
- Enable the cursor-paginated JSON archive used by the Ministry of Education's own news page.
- Collect technically stable official national party news channels as primary evidence of what the party published. Count wording as a party or parliamentary-group position only when the content explicitly adopts it; an individual's interview or third-party wording is not automatically a party position. An asserted law, decision, vote, or outcome still requires the corresponding independent official record.
- Enable the official paginated Motoristé sobě WordPress news archive. Keep the ANO and SPD news archives registered but disabled while their browser security challenges prevent reliable unattended collection.

## Working proposals

### Public interface

- Home page: site title, period selector, three large circular party portraits, and a red-to-green index scale. The endpoint labels are a separately confirmed decision recorded above.
- Party page: index, distribution, simple promise rows, symbol plus label, expandable evidence.
- Promise page: original wording, plain-language explanation, decisive primary evidence, articles, update date, and revision timeline.
- Candidate symbol set: `✓`, `↗`, `—`, `↘`, and `×`.
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

### First reviewed real-data catalog

**Working proposal**

- Catalog v1 contains 36 promises from the final official national election programmes: 12 each for ANO 2011, SPD, and Motoristé sobě.
- The balanced count is a review tranche, not a quota that forces weak promises into the product and not a claim of exhaustive coverage.
- Each accepted promise preserves exact Czech source wording, a PDF locator, an atomic tracked claim, fulfillment and contradiction tests, deterministic matching terms, and a link to its extraction candidate.
- At the time catalog v1 was recorded, the other 919 final-programme extraction candidates remained unreviewed rather than rejected or counted as zero.

**Working proposal — incremental catalog v2:** The first ANO finance batch adds six atomic promises from printed page 4 of the final programme to the matching registry, bringing the current registry to 42 promises (ANO 18, SPD 12, Motoristé 12). The batch is not public production data and does not authorize assessment publication. Its accepted, rejected, and split dispositions are retained in `research/2025-election/reviewed-batches/ano-finance-1.json`.
- **Working proposal — incremental catalog v2:** The second ANO finance batch adds four atomic promises from printed page 5 of the same final programme, bringing the current registry to 46 promises (ANO 22, SPD 12, Motoristé 12). The official PDF downloaded on 2026-09-06 matched the retained SHA-256. Its accepted, duplicate, and rejected source occurrences are retained in `research/2025-election/reviewed-batches/ano-finance-2.json`; the batch is not public production data and does not authorize assessment publication.
- Catalog inclusion does not publish an assessment. Candidate matches and AI assessments remain unpublished until the owner explicitly approves identified proposals and a separate validated publication change is made.

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

The public name is unresolved. “Sliby vlády” and related wording were suggested, but the owner explicitly said the name was not yet known. The repository name and scoring brand can be used temporarily, so this does not block the production rollout.

### Temporary demo removal

Keeping the ChatGPT Sites address as a temporary demo during the hosting transition is confirmed. The exact point at which it should be removed was not decided; successful Cloudflare deployment alone does not resolve that timing.

### Mixed conduct

The owner rejected an absolute averaging rule and preferred the worse result in inconsistent cases, while also saying this is not an absolute rule. The working exception for final outcomes and behavior promises needs real-case tests before becoming canonical.

### Blocked and compromised promises

International examples motivated distinct handling for promises blocked by another actor and promises changed by compromise. No special state will be implemented until a real project case demonstrates the need.

### Publication governance

Human review of every automated proposal is confirmed. The project owner authorizes publication through an unambiguous Codex message that identifies the approved proposals. That approval must be preserved in the publication change; a generic acknowledgement or review-proposal merge is insufficient. The exact machine-readable approval fields and implementation of the separate publication workflow remain unresolved. Automatic publication is outside the current rules.

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

### Future opposition-party coverage

The owner raised extending the tracker to opposition parties represented in the Chamber because they also vote and may introduce legislation. No expansion order, completeness threshold, or relationship to the current governing-party presentation was confirmed. The initial scope therefore remains ANO, SPD, and Motoristé until a later explicit decision.
