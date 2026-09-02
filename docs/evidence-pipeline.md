# Evidence pipeline

## Status and authority

The collection, matching, and assessment separation described in this document is a **confirmed decision**.

This document is the canonical human-readable description of the evidence pipeline. [`automation/collectors/sources.json`](../automation/collectors/sources.json) is the machine-readable authority for enabled sources, endpoints, host allowlists, evidence roles, and deferred integrations. A source-list change must update both files in the same pull request.

## Confirmed pipeline

One pipeline execution follows this sequence:

1. **Collect once.** Every enabled source adapter retrieves its source once. Collection is source-oriented, not promise-oriented; no source is downloaded separately for each promise.
2. **Normalize and deduplicate.** Records receive stable provenance, timestamps, source roles, structured facts where available, and deterministic hashes. Exact duplicate records collapse; conflicting records with one identity fail validation unless the upstream source has a documented identity exception.
3. **Match against every reviewed promise.** The shared record set is compared with the complete reviewed promise registry. One record may match zero, one, or several promises, including similar promises belonging to different parties.
4. **Treat matches as candidates only.** A deterministic match means “potentially relevant,” never “supports,” “contradicts,” or “changes the score.” Every matched term or official external identifier remains visible in the audit.
5. **Build bounded evidence packages.** A package is generated only when attributable primary candidate evidence exists. Relevant media records may remain as context, but media alone does not create a strict primary-evidence package.
6. **Enrich matched parliamentary prints.** For prints already present in a package, retrieve the official PSP DOCX once per print, retain its SHA-256 hash, and mechanically select bounded, numbered paragraphs around the promise and matcher terms. The selection assigns no direction or score. The original package, enriched package, document hashes, exact excerpts, and any warning remain auditable. Assessment workflows retry transient download failures and stop before model calls if a required document remains unavailable.
7. **Assess only new or changed packages.** Two independent assessors receive the same bounded enriched package. An unchanged package hash must not trigger repeated model calls. This change-detection gate is confirmed but not yet implemented in the full-registry workflow.
8. **Arbitrate disagreement.** Matching sufficient assessor results become a candidate assessment. Disagreement about the status or evidence sufficiency goes to the configured arbiter. An arbiter cannot turn a selected insufficient review into a score candidate; unresolved or insufficient cases require human attention.
9. **Publish separately.** Collection, matching, assessment, and publication are distinct stages. No collector, matcher, enrichment step, or model result changes public data or the SLAVA Index automatically under the current rules.

```text
allowlisted sources
  -> one shared collection run
  -> normalized and deduplicated records
  -> match against all reviewed promises
  -> bounded evidence packages
  -> official documents for matched parliamentary prints
  -> changed packages only
  -> assessor A + assessor B
  -> arbiter when needed
  -> human publication gate
  -> versioned public data
```

## Enabled source registry

The enabled list is intentionally small and explicit. “Verified” means that the endpoint, format, and expected host were checked; it does not mean that every statement from the publisher is accepted as true or decisive evidence.

### Primary and official sources

| Registry ID | Source | Machine-readable channel | Role |
|---|---|---|---|
| `psp-core-2025` | Chamber of Deputies of the Parliament of the Czech Republic | Daily open-data archives for votes, individual choices, parliamentary prints, print history, and time-bounded club membership | Primary official records |
| `government-cz-rss` | Government Office of the Czech Republic | Official RSS, including explicitly allowlisted links to the official ODok portal | Official discovery; an underlying decision or document may still be required |
| `mpsv-press-rss` | Ministry of Labour and Social Affairs | Official press-release feed | Official discovery; authoritative acts and outcome data remain preferable |

### Allowed news sources

| Registry ID | Publisher | Channel | Permitted use |
|---|---|---|---|
| `irozhlas-domestic-rss` | iROZHLAS | Publisher-provided domestic-news RSS | Discovery and context only |
| `ct24-rss` | ČT24 | Publisher-provided RSS | Discovery and context only |
| `seznam-zpravy-rss` | Seznam Zprávy | Publisher-provided RSS | Discovery and context only |
| `novinky-news-sitemap` | Novinky.cz | Google News sitemap advertised by the publisher | Discovery and context only |

The current news-source list is exactly these four publishers. A new publisher is not implicitly allowed because it is large, familiar, or linked by an existing article. Adding or removing a publisher requires an explicit registry and documentation change with endpoint, host, format, content-size, and provenance validation.

News collection retains metadata, URL, publication time, supplied authors, and at most a short publisher-provided excerpt. It does not download or store full article bodies. A news item may help discover a vote, bill, regulation, decision, or measurable outcome, but a strong `+2` or `-2` assessment should normally cite the underlying primary source.

### Deferred official sources

| Registry ID | Source | Current state |
|---|---|---|
| `odok-veklep` | ODok/eKLEP public interface | Registered but disabled as a standalone collector until a stable documented machine-readable endpoint is verified. ODok links supplied by the Government Office RSS remain allowed as official discovery records. |
| `e-sbirka-open-data` | e-Sbírka open data and public API | Registered but disabled under the current integration warning and registration requirements. |

## Matching and attribution boundary

- A media article that mentions a promise may appear in the match audit but cannot by itself establish party conduct.
- A parliamentary vote enters a party's package only when party membership at the vote date and the configured party-attribution rule are resolved.
- Bill authorship is not required. A party's verified vote can be relevant regardless of who introduced the bill.
- A government act is an attribution candidate until the assessor can fairly connect it to the tracked party.
- Official print-document excerpts establish proposal substance, not party attribution, adoption, or legal effect. Paragraphs are selected mechanically and may support, contradict, or merely contextualize the promise.
- A promise with no primary match receives no package. It does not receive `no-progress`, zero points, or any other assessment merely because collection found nothing.
- Contradictory evidence is retained. Evidence items are not scored independently and are not averaged.

## Current automation state

The manual GitHub Actions workflow `Collect and match evidence candidates` implements stages 1 through 6 for the full reviewed registry and uploads one unpublished audit artifact. The first successful full-registry run checked all 36 catalog promises against one shared collection of all enabled sources. The document-enrichment extension retrieves official DOCX files only for parliamentary prints already selected into evidence packages and reuses a fetched print across packages during the same run.

The [first full-registry document-enrichment run](https://github.com/orik007/sliby-chyby/actions/runs/33601733992) processed 3,984 shared records, 36 reviewed promises, and 141 candidate matches. It generated three evidence packages and added four official print documents across them with zero warnings. Original and enriched package hashes differ and are retained separately in the uploaded audit.

The single-promise end-to-end pilot implements the assessor and arbiter calls. The remaining automation work is to connect the full-registry workflow to assessment only for package hashes that are new or changed.

## Scheduling and persistence

Daily collection is the current **working proposal**, because RSS and news-sitemap windows can be short. Before enabling a schedule, the project needs a durable audit-history design and the changed-package gate. GitHub artifacts currently expire and therefore are suitable for pilot audits, not permanent evidence history.

The durable location for unpublished candidate records and assessments remains an **open question**. Options include versioned repository data through review pull requests or a later private queue. This does not change the confirmed separation of collection, matching, assessment, and publication.
