# Evidence pipeline

## Authority

This is the only rule for collecting, routing, and packaging evidence and for producing unpublished assessment proposals. What counts as attributable conduct and which score it supports is defined only in [scoring.md](scoring.md).

## Principle: official records only, verified before use

Evidence consists only of official records. A party's own website or publication, a press release, and the media are never evidence and are not collected.

A source is added only after all of these hold, and one source at a time:

1. its structure is checked against the publisher's official documentation and against downloaded real data;
2. its completeness is measured on real data (how many records resolve, link, and attribute, and how many do not);
3. its collector has tests built from the verified structure; and
4. every run reports the source's quality figures, and a failed structural check stops the affected data from being used in that run.

## Sources

| Source | Publisher and location | What it provides | Status |
| --- | --- | --- | --- |
| `psp-core-2025` | Chamber of Deputies open data for the 10th term: `hl-2025ps.zip` (votes), `poslanci.zip` (MPs, clubs), `tisky.zip` (prints, print history, proposers), `schuze.zip` (sessions, agenda items), documented at [psp.cz](https://www.psp.cz/sqw/hp.sqw?k=1300); official print texts from `www.psp.cz/sqw/text/` | Decisive Chamber votes with per-club results, the print each vote concerns, member bills and government proposals with their proposers and submission dates | **Active.** Verified against the official schema and live data on 23 September 2026. |
| Government resolutions | Government Office, [ODok zVlády](https://odok.gov.cz/portal/zvlady/jednani/) | Government resolutions | **Planned.** The portal exists; a machine-readable form has not been verified. |
| Collection of Laws | Ministry of the Interior, [e-Sbírka](https://e-sbirka.gov.cz) open data and REST API | Enacted laws, government regulations, ministerial decrees, and their effective dates | **Planned.** The publisher states that open data and a registered API exist; the data has not been inspected. |
| European Parliament, Council of the EU | — | Votes of the parties' MEPs; the government's positions | **Later**, by the owner's decision. |
| Senate | — | — | **Not now**, by the owner's decision. |

`automation/collectors/sources.json` is the collector registry and may contain only active sources. `automation/attribution/government-periods.json` records the governing parties and their dates with an official source.

## Chamber data rules

These rules were verified against the official schema documentation (psp.cz pages k=1302, k=1303, k=1308) and the live open data.

- **Agenda item.** A vote names its session number and agenda-item number. The collector resolves the item from the **approved** agenda: the proposed and approved agendas share `id_schuze` and `id_bod` and differ only in `pozvanka`. Items of type 6 (individual answers to written interpellations) are ignored. The vote record carries the agenda-item title and the print it concerns.
- **Decisive vote.** A vote is decisive only when an official print-history step names that exact vote and records one of the Chamber's final decisions: `souhlas`, `schváleno`, `neschválen`, `neschválena`, `zamítnut`, `nepřijat`, `setrváno`, `pozm. přijat`. Procedural steps such as `vrácen`, `opakovat`, `přerušeno`, or `odročeno` are not decisive. The collector never infers a decisive vote from timing or order.
- **Party vote.** The club membership of each MP on the vote date decides the party. A party direction requires a strict majority of all club members; a manual vote or a vote voided by the official record is never attributed.
- **Proposals.** Print kind 1 (government bill), 3 (state budget), and 4 (international treaty) are government proposals. Print kind 2 with proposer type 2 or 3 is a member bill; its proposers come from `tisky.id_osoba` or, for several proposers, `predkladatel.unl`. Only the submission step (`předložen`) is a proposal.
- **Amended acts.** The acts a bill amends or repeals are read from its official title (every listed “zákon č. X/RRRR Sb.” and “o změně zákona č. X/RRRR Sb.”, but not an act cited only inside another act's name or amendment history) and from the amending-article headings of its official text (“Zákon č. X/RRRR Sb., … se mění” or “V zákoně č. X/RRRR Sb.”); other references in the text are ignored. A state budget print carries the identifier `cz-print-kind-state-budget`. Bill texts are fetched once and cached on the audit branch (`automation/print-acts/`); a failed fetch leaves only the title's acts and is reported in the run.
- **Consistency check.** If the session data and the print history share no agenda-item identifier, the collector records a warning and does not use agenda items in that run.

## Daily workflow

The workflow runs at 09:37 Europe/Prague and keeps a manual trigger. The schedule stays paused until a manual `workflow_dispatch` run of the current pipeline has been verified end to end (see `.github/workflows/collect-evidence.yml`).

1. **Collect.** Every run collects every active source completely from its `bootstrapFrom` date, so each package is built from the whole record history and a new package never loses earlier conduct. There is no manual start date or source subset. If any source fails, the run fails and nothing is saved. `checkpoints.json` only records each source's last successful collection; it never limits what is collected.
2. **Filter.** Only a record that can be attributable conduct of a tracked party under [scoring.md](scoring.md) continues: a decisive vote with a club result, or the submission of a member bill or government proposal. Attribution depends only on the record itself, so no other record can ever affect a score, and none is tagged or fetched further.
3. **Read amended acts.** For each print those records concern, the acts it amends are read from its official title and text (see *Chamber data rules*).
4. **Route.** A record is routed to confirmed promises in one of two ways:
   - **Direct link.** An act amended by the concerned print, or the state budget print kind, is listed under a tag in `directLegalIdentifiers` of the taxonomy (`automation/topic-routing/taxonomy-v1.json`). The record goes to every promise with that tag, or with any of the tags when an act is listed under several, and is not sent to the taggers.
   - **Two taggers.** Otherwise two independent taggers, given the record and the official names of the acts its print amends, must agree on the same specific (`assessmentEligible`) tag with grounded excerpts. A broad parent tag alone never routes a record.

   Disagreement or weak support goes to `routing-review`; `unknown` or no promise with the tag goes to `orphan-review`. Both are for human attention and never mean no progress. Models may return only existing tag identifiers or `unknown`. A taxonomy change is a reviewed change, and its content hash recomputes every dependent classification.
5. **Package.** Each promise with at least one routed, attributable record gets one bounded evidence package. When a package must be trimmed, decisions come before proposals, then direct links, then the most recent conduct. Routing never establishes attribution or a score.
6. **Enrich.** When a package names a Chamber print, the official print document is added. A package with an enrichment warning is not assessed; the next run rebuilds and enriches it again.
7. **Persist.** Before any assessment call, the collection record (`checkpoints.json`), the tag-assignment cache, the print-text cache, and the packages are saved together to the dedicated unpublished audit pull request, and only when collection, routing, enrichment, and persistence all succeed in the same run. The queue keeps at most one current package per promise: a rebuilt package whose assessable content is unchanged keeps the current one, a promise that no longer gets a package has its current package withdrawn, and superseded and withdrawn versions stay auditable.
8. **Assess.** Each new or changed package goes independently to two assessors, who may cite only evidence IDs in that package. They first decide whether the evidence is materially relevant, then propose a score. When their valid assessments differ, or exactly one output is invalid, an arbiter selects a usable assessment or returns no conclusion. Two invalid outputs write a private failure audit and re-enter a later batch unless a newer package replaces them.
9. **Report.** The proposals and a coverage audit are written to the audit pull request. The audit covers every confirmed promise and active source and reports the run's data-quality figures: records skipped as not attributable, routed records, direct links, review queues, invalid tagger outputs, and how many bills had an official text and amended acts.

The audit pull request is never merged to `main`, and its Git history is not an audit record. The workflow never changes public data, a public score, or publication status. A failed complete run does not advance public freshness.

## Pipeline generation

`automation/pipeline-generation` names the current generation of the audit state. The workflow restores the collection record, caches, and queues from the audit branch only when that branch holds the same generation. When a rule change makes saved audit state invalid, change the generation: the next run starts from empty caches and queues, so everything is tagged and assessed again. Old audit state is never repaired or reused.

## From proposal to public score

Human review may establish that a score should change. That change is a separate scoped pull request based on current `main`, which adds an append-only assessment revision citing official sources and follows [release-process.md](release-process.md).

## Audit and cost control

The assessors' and arbiter's active prompt versions, providers, model IDs, confidence, evidence IDs, and input fingerprint remain auditable. The fingerprint covers assessable content, active prompts, providers, and models, so an unchanged package is never assessed again. The tagging, assessor, and arbiter models are set in the workflow and recorded in every run. The tag-assignment cache records each accepted assignment's input hash, taxonomy version, prompt version, provider, model, and confidence, so an unchanged record is never tagged again.
