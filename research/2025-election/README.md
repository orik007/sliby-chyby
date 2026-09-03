# 2025 government-party promise research

## Status

**Working proposal.** This directory is primarily a research staging area. Only source candidates explicitly marked `accepted-first-release-catalog-v1` have been promoted into the reviewed matching registry. Every other record remains unpublished research material and is not a promise, assessment, or SLAVA Index input.

The confirmed party scope for the current period is ANO 2011, Svoboda a přímá demokracie (SPD), and Motoristé sobě. The election scope is the 2025 Czech Chamber of Deputies election. Collective post-election coalition and government programmes are evidence of later conduct, not sources of pre-election promises.

## Confirmed first-version attribution boundary

The first public version tracks official commitments of national parties, not promises of individual politicians. Collection retains three research tiers:

1. **Tier A:** the party's national election programme, official campaign site, national campaign publication, or national party account;
2. **Tier B:** an explicit commitment made on behalf of the party by its chair, election leader, or authorised national policy spokesperson;
3. **Tier C:** a regional branch, individual candidate, allied-party candidate, or local campaign commitment that has not been adopted nationally.

All tiers may be collected for completeness. Only Tier A is eligible for conversion into a first-version production promise, and its wording must clearly commit the party. Tier B and Tier C remain outside the party's SLAVA Index. They may support a future section about individual politicians but require a separate confirmed methodology.

For SPD, candidacy of members of Svobodní, Trikolora, or PRO on the SPD electoral list does not transfer those parties' programmes or their candidates' personal commitments into SPD's promise set. Only wording adopted as an SPD commitment in an official national SPD source is eligible.

## Collection principle

Collect broadly, publish narrowly. A research candidate may be:

- a concrete promise;
- several promises combined in one source passage;
- a policy preference without a promised act;
- a slogan too vague to assess;
- duplicated wording from another campaign source;
- a statement superseded or contradicted before the election.

Human review must split atomic promises, retain the exact Czech wording, classify attribution, record conflicts, and reject vague or non-promissory material. No candidate receives a score merely because it was extracted.

Every occurrence must pass the confirmed [promise selection methodology](../../docs/promise-selection.md). In particular, a reviewer must be able to state what concrete public evidence would support the commitment and what would contradict it without adding precision absent from the source. Rejected candidates remain in the audit trail and do not count as zero-point promises.

## Captured primary sources

| Party | Source | Date/status | Local processing | URL |
|---|---|---|---|---|
| ANO | *Program pro váš lepší život* | final 2025 election programme, 38 PDF pages | text extracted with page locators | https://www.anobudelip.cz/file/edee/ke-stazeni/volebni-program-2025.pdf |
| ANO | programme web rendering | current official rendering of the same programme | indexed as a duplicate presentation, not a second promise source | https://www.anobudelip.cz/program/ |
| ANO | *Lepší Česko* campaign newspapers | January, February, March, April, and August/September 2025 | all 23 image-only pages visually inspected; 26 exact promise-candidate occurrences transcribed with issue and page locators; selected August/September pages received a second visual check | https://www.anobudelip.cz/cs/ke-stazeni |
| ANO | letter to Czech citizens abroad | August 2025 | text extracted; attribution and promise review pending | https://www.anobudelip.cz/file/edee/2025/08/dopis-krajane-20250827-141653.pdf |
| ANO | official campaign-period news index | 1 January through 4 October 2025 | all 405 indexed items captured: 381 external-media links, 17 embedded social posts, 6 press releases, and 1 blog post | https://www.anobudelip.cz/cs/aktuality |
| SPD | *Česko, jaké chcete* | final 2025 election programme, 28 PDF pages | text extracted with page locators | https://spd.cz/wp-content/uploads/2025/09/Program-SPD-pro-volby-do-Poslanecke-snemovny-2025.pdf |
| SPD | election programme theses | adopted earlier for preparation of the 2025 programme | acquired; exact URL contains legacy mojibake; comparison with the final programme remains pending | https://www.spd.cz/wp-content/uploads/2022/12/Programov%C3%83%C2%A9-teze-IX.-celost%C3%83%C2%A1tn%C3%83%C2%AD-konference-hnut%C3%83%C2%AD-SPD.pdf |
| SPD | 2025 election hub and official campaign articles | 2025 campaign | 115 official-site posts captured for the period from 1 January through election day; 254 over-inclusive candidate passages extracted | https://old.spd.cz/volby2025/ |
| SPD | official ten-priority explanation | 26 August 2025 | discovered; appears to restate the final programme | https://spd.cz/vstupujeme-do-voleb-s-jasnymi-prioritami-vychazejicimi-z-potreb-nasich-obcanu/ |
| SPD | *Naše volební desatero* | 26 August 2025 | official single-page PDF leaflet captured, text-extracted, rendered, and visually checked; ten grouped candidate passages retained | https://spd.cz/wp-content/uploads/2025/08/Letak_A5_148x210_desatero.pdf |
| Motoristé | *Umíme vyřešit i složité věci* | final 2025 election programme, 38 PDF pages | text extracted with page locators | https://motoristesobe.cz/wp-content/uploads/Volebni_program-2025_MOTORISTE-SOBE.pdf |
| Motoristé | programme web rendering | official HTML presentation | discovered; duplicate comparison pending | https://motoristesobe.cz/program2025 |
| Motoristé | *Opravíme stát* campaign launch | 15 May 2025 | discovered; contains commitments outside or preceding the final programme | https://motoristesobe.cz/opravime-stat-2246 |
| Motoristé | official campaign articles | 1 January through 4 October 2025 | 127 official-site posts captured; 133 over-inclusive candidate passages extracted | https://motoristesobe.cz/aktuality |
| Motoristé | official media archive and national campaign slogan | June through September 2025 | all 368 campaign-period file/image uploads indexed; the exact creative `MY VÁM ŽIVOT NEZDRAŽÍME` and an excise-tax petition leaflet transcribed as candidates | https://motoristesobe.cz/wp-json/wp/v2/media |

## Discovery and recovery sources

These sources help locate missing originals but are not substitutes for primary evidence:

- Programy do voleb: programme copies, party priorities, candidate materials, and questionnaire answers;
- Czech Television, Czech Radio, and other debate hosts: recordings, transcripts, and programme specials;
- Demagog.cz: discovery of attributable pre-election statements and their original recordings;
- Czech National Library Webarchiv and the Internet Archive: removed campaign pages and historical snapshots;
- Meta Ad Library and Google Ads Transparency Center: paid online campaign creatives where available;
- Office for the Supervision of the Management of Political Parties and Political Movements: campaign-finance reports that identify advertising formats, vendors, and periods;
- media photo reports and campaign reviews: recovery leads for billboard and poster wording when the party no longer hosts the creative.

Secondary material must point back to a party publication, recording, photograph, or archived page before a quotation is treated as authoritative.

## Current extraction queue

`candidate-promises.json` is an intentionally over-inclusive machine-assisted queue generated from the three final official programmes. It currently contains 955 candidates:

- ANO: 473;
- SPD: 247;
- Motoristé: 235.

These are extraction candidates, not 955 distinct promises. The first human-reviewed tranche accepted 36 source occurrences, evenly split across the three parties. The first incremental ANO finance batch reviewed another 11 occurrences: five produced new promises, five were rejected with reasons, and one still needs splitting. Two already accepted composite occurrences produced two additional atomic promises. The matching registry therefore contains 43 promises linked to 41 accepted source occurrences; 908 extraction candidates remain unreviewed.

The original tranche and current expanded set are recorded in [`reviewed-catalog-v1.md`](reviewed-catalog-v1.md) and [`reviewed-catalog-v2.md`](reviewed-catalog-v2.md). Acceptance means the source wording passed the current attribution, atomicity, and assessability checks. It does not mean that the promise has been assessed or approved for automatic public publication.

The queue is reproducible with:

```text
scripts/extract_pdf_pages.py
scripts/build_promise_candidate_catalog.py
```

`official-web-candidates.json` is a second over-inclusive queue built from 647 indexed source items: 405 ANO archive items, 115 SPD posts, and 127 Motoristé posts between 1 January and election day. It contains 409 passages requiring attribution and promise review:

- ANO: 22;
- SPD: 254;
- Motoristé: 133.

Most ANO archive items point to external media and are discovery records, not party-authored statements. An official host also does not prove that every sentence is a party commitment: some posts republish interviews or media reports. The queue therefore retains source provenance, title, date, URL, exact excerpt, and provisional attribution without assigning a production promise.

`ano-newspaper-candidates.json` contains 26 exact Czech source occurrences manually transcribed from all 23 pages of five official national ANO campaign newspapers. Selected August/September occurrences now have a recorded second visual check and final-programme relationship; the rest still require a second visual check, atomic splitting, final-programme comparison, and attribution review.

`ano-official-news-index.json` preserves the complete 405-item ANO campaign-period archive index for discovery and later source recovery.

`ano-meta-ad-leads.json` contains 46 policy-ad discovery leads selected from 363 ANO sponsored advertisements in a public Charles University research appendix. Its descriptions are the researcher's coding notes, never verbatim ad copy; an original creative must be recovered before quoting or admitting a promise.

All 46 of those ANO leads were subsequently opened by their public Meta Ad Library IDs and their original archived text was recovered. `meta-ad-candidates.json` retains eight representative ANO commitment-bearing occurrences, twelve SPD occurrences, and three Motoriste occurrences with exact Czech excerpts. The SPD pass searched the national leader advertiser archive for thirteen explicit commitment verbs and reviewed 32 unique returned ad groups. The Motoriste pass reviewed every one of the 32 creative/text groups returned for the Filip Turek advertiser in the election window. These remain research occurrences. Party payment does not convert a leader's or candidate's first-person promise into a national party promise; an official national party source must clearly adopt the wording for first-version eligibility.

`paid-advertiser-map.json` is a reproducible coverage map built from the public Who Targets Me Trends election report. It identifies 10 ANO advertiser pages, 10 SPD advertiser pages, and one Motoriste advertiser page in the 3 September–2 October window. The map supplies Facebook Page IDs and aggregate spending only; it is a discovery ledger, not a promise source. It exposes an important remaining gap: regional and candidate advertisers require separate Tier C collection and attribution review.

`official-media-index.json` preserves 586 campaign-period uploads from the public SPD and Motoristé WordPress media APIs: 218 SPD records and 368 Motoristé records. It is a recovery ledger, not a promise list. Selected non-HTML creative text is manually retained in `campaign-creative-candidates.json`.

The official campaign-finance records establish that Motoristé printed and distributed election newspapers and 330,000 A5 leaflets. The original election-newspaper issues have not yet been recovered, so this channel is proven to exist but not textually covered. Raw finance exports are kept out of the repository because they include personal data.

`audiovisual-sources.md` indexes the final Czech Television and Czech Radio debates, the three Czech Radio leader interviews, and further public-service election series. Czech Television's official caption file has been captured for discovery; captions are not treated as exact quotations until checked against audio.

`official-youtube-index.json` currently resolves 10 YouTube videos embedded by the official Motoriste site. A metadata scan of the official ANO and SPD channels was stopped after YouTube rate-limited the research session, so their zero counts mean **not yet indexed**, not that those channels contain no campaign videos.

## Coverage still required

- review the remaining 908 final-programme extraction candidates and record explicit rejection or deduplication reasons;
- perform a second visual verification of the ANO newspaper transcriptions;
- review the captured official-site queues and recover the original content behind ANO external-media and embedded-social records;
- inventory official Facebook, Instagram, X, YouTube, and TikTok posts and recover the original creatives behind paid-ad leads;
- finish the rate-limited official ANO and SPD YouTube channel pass and transcribe only videos that survive promise and attribution review;
- capture launch speeches, official videos, televised debates, interviews, and questionnaire answers;
- recover billboard, poster, leaflet, direct-mail, and newspaper wording;
- compare live campaign pages with archived versions and record removed or changed promises;
- identify regional and candidate-only commitments without silently attributing them to the national party;
- deduplicate restatements while retaining every source occurrence;
- record contradictions between earlier theses, the final programme, and later campaign statements.

See `source-inventory.md` for a channel-by-channel coverage ledger. "Captured" in that ledger means that a source or discovery index is locally represented; it does not mean that every occurrence has passed promise review.

## Open questions exposed by collection

- How should materially different conditions in otherwise duplicate official wording be related?
- What minimum reviewed coverage and approved-assessment coverage should be required before the site describes a party catalog as substantially complete?
- What source-retention and copyright policy applies to programme PDFs, campaign newspapers, social posts, and billboard photographs?
