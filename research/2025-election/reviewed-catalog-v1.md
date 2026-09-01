# Reviewed promise catalog v1

## Status

**Working proposal.** This is the first bounded real-data catalog for matching and assessment-pipeline evaluation. It is not an exhaustive inventory of the parties' programmes or campaigns, and it does not authorize automatic public assessment publication.

## Review result

| Party | Accepted | Source |
|---|---:|---|
| ANO 2011 | 12 | Final official 2025 national election programme |
| SPD | 12 | Final official 2025 national election programme |
| Motoristé sobě | 12 | Final official 2025 national election programme |
| **Total** | **36** | |

All 36 accepted entries are stored in [`automation/matching/promises.json`](../../automation/matching/promises.json). Each entry links to one source candidate in [`candidate-promises.json`](candidate-promises.json), where it is marked `accepted-first-release-catalog-v1`.

The remaining 919 extraction candidates are still unreviewed. They have not been rejected, admitted, assessed, or counted as zero-point promises.

## Acceptance checks applied

Every accepted entry passed these checks:

1. The wording appears in the party's final official national election programme.
2. The wording is attributable to the tracked party, not merely to an individual, region, or allied party.
3. The tracked claim is atomic even when its retained source sentence contains additional commitments.
4. The atomic claim does not add specificity absent from the source.
5. A concrete fulfillment test and contradiction test can be written from the source wording.
6. The original Czech wording, exact quoted fragment, source URL, and page or section locator are retained.
7. Matching terms narrow evidence discovery but do not determine direction or score.

ANO and Motoristé programme passages were checked against extracted text and rendered source pages. SPD passages were checked against the text and page locations served from the official SPD PDF. A second-person review remains advisable before the catalog is presented as public production data.

## Accepted ANO 2011 promises

| Registry ID | Tracked commitment |
|---|---|
| `ano-2025-eet-2` | Introduce EET 2.0 |
| `ano-2025-abolish-public-media-fees` | Abolish Czech Television and Czech Radio fees |
| `ano-2025-retirement-age-65` | Return the standard retirement age to 65 |
| `ano-2025-corporate-income-tax-19` | Lower corporate income tax from 21% to 19% |
| `ano-2025-restore-kindergarten-tax-credit` | Restore the preschool tax credit |
| `ano-2025-age-based-pension-increases` | Introduce the four stated age-based pension increases |
| `ano-2025-prevention-centres-every-region` | Operate a prevention centre in every region |
| `ano-2025-constitutional-nationwide-referendum` | Establish a nationwide referendum constitutionally |
| `ano-2025-eight-billion-culture-investment` | Invest at least CZK 8 billion in the stated cultural purposes over four years |
| `ano-2025-free-state-museums-selected-groups` | Provide free state-museum and gallery entry to the three stated groups |
| `ano-2025-abolish-science-minister-post` | Abolish the standalone science-minister post |
| `ano-2025-three-month-fintech-licensing` | Set a three-month decision deadline for fintech and crypto licences |

## Accepted SPD promises

| Registry ID | Tracked commitment |
|---|---|
| `spd-2025-binding-referendum-law` | Pursue a general binding referendum law |
| `spd-2025-reject-eu-migration-pact` | Reject Czech implementation of the EU Migration and Asylum Pact |
| `spd-2025-retirement-age-65` | Restore the standard retirement age of 65 |
| `spd-2025-birth-grant-tiers` | Establish the stated CZK 30,000, 40,000, and 50,000 birth-grant tiers |
| `spd-2025-parental-allowance-direct-relatives` | Extend parental allowance eligibility to grandparents and adult siblings |
| `spd-2025-restore-kindergarten-tax-credit` | Restore the preschool tax credit for working families with children |
| `spd-2025-state-medicine-manufacturer` | Establish a state medicine manufacturer |
| `spd-2025-leave-who` | End Czech membership in the WHO |
| `spd-2025-ban-public-propagation-islamic-ideology` | Enact the stated ban on public propagation of Islamic ideology |
| `spd-2025-negotiate-euro-opt-out` | Obtain an opt-out from the obligation to adopt the euro |
| `spd-2025-vat-paid-invoices-only` | Make VAT payable only on paid invoices |
| `spd-2025-abolish-public-media-fees` | Abolish Czech Radio and Czech Television fees |

## Accepted Motoristé sobě promises

| Registry ID | Tracked commitment |
|---|---|
| `motoriste-2025-abolish-holiday-sales-ban` | Abolish the retail-sales ban on selected holidays |
| `motoriste-2025-zero-vat-prescription-medicines` | Apply zero VAT to prescription medicines |
| `motoriste-2025-vat-paid-invoices-only` | Within the stated legal limits, remit VAT only after invoice payment |
| `motoriste-2025-abolish-minimum-self-employed-contributions` | Abolish minimum mandatory self-employed contributions |
| `motoriste-2025-abolish-mandatory-data-box-self-employed` | Remove the mandatory data-box obligation for self-employed people |
| `motoriste-2025-balanced-budget-four-years` | Reach a balanced or surplus state budget within four years |
| `motoriste-2025-abolish-cermat` | Abolish CERMAT and replace its stated assessment roles |
| `motoriste-2025-halve-multiyear-grammar-school-capacity` | Halve multiyear grammar-school capacity |
| `motoriste-2025-national-specialised-building-office` | Establish the stated nationwide specialised building authority |
| `motoriste-2025-cut-industrial-admin-burden-30-by-2028` | Cut industrial administrative burden by at least 30% by 2028 |
| `motoriste-2025-prevent-ets2-introduction` | Prevent EU ETS 2 charges on household heating and road fuels |
| `motoriste-2025-online-company-formation-24-hours` | Enable online company formation within 24 hours |

## Deliberate limitations

- Equal party counts make the first pipeline comparison readable, but they do not define future coverage or index weighting.
- Similar commitments by different parties remain separate promises because each belongs to one party and one electoral period.
- Combined source passages are not split into every possible promise in this tranche. Only the explicitly tracked atomic claim enters the registry; the full retained wording preserves context.
- No score or current status was assigned during catalog review.
- Programme review is not a substitute for the still-incomplete campaign-site, social, print, billboard, interview, and audiovisual inventory.
