# Reviewed promise catalog v2

## Status

**Working proposal.** This is the current bounded registry for deterministic evidence matching. It contains the original balanced v1 tranche plus the first and second incremental ANO finance batches. It is not an exhaustive promise inventory, a public-data release, or authority to publish an assessment.

## Current review result

| Party | Reviewed matching promises | Change from v1 |
| --- | ---: | ---: |
| ANO 2011 | 22 | +10 |
| SPD | 12 | 0 |
| Motoristé sobě | 12 | 0 |
| **Total** | **46** | **+10** |

The first six added promises come from printed page 4 and the next four from printed page 5 of ANO's final official national election programme. Selected related passages in the earlier August/September *Lepší Česko* campaign newspaper were also visually checked and retained as Tier B occurrences; the later final programme remains the active source. The source occurrences, wording differences, rejected candidates, split decisions, and reasons are retained in [`reviewed-batches/ano-finance-1.json`](reviewed-batches/ano-finance-1.json) and [`reviewed-batches/ano-finance-2.json`](reviewed-batches/ano-finance-2.json).

## Added ANO promises

| Registry ID | Tracked commitment |
| --- | --- |
| `ano-2025-not-adopt-euro` | Do not adopt the euro under an ANO-led government |
| `ano-2025-digital-tax-cobra` | Introduce the Digital Tax Cobra with the stated analytical function |
| `ano-2025-restore-working-student-tax-credit` | Restore the tax credit for working students |
| `ano-2025-stop-2026-self-employed-contribution-increase` | Stop the self-employed contribution increase scheduled for 2026 |
| `ano-2025-remove-leisure-benefit-cap` | Remove the cap on employee leisure benefits |
| `ano-2025-restaurant-nonalcoholic-vat-12` | Apply 12% VAT to the two stated supplies |
| `ano-2025-tax-exempt-voluntary-tips` | Exempt voluntary hospitality tips from the stated tax and insurance payments |
| `ano-2025-online-tax-office` | Complete the online tax-office project with mobile availability |
| `ano-2025-retail-state-bonds` | Offer state bonds to retail savers |
| `ano-2025-customs-entry-salary-50000` | Establish the stated CZK 50,000 customs-officer entry salary |

Each entry preserves the complete source passage, an exact Czech quote, a page locator, an atomic tracked claim, fulfillment and contradiction tests, and deterministic matching terms in [`automation/matching/promises.json`](../../automation/matching/promises.json).

## Publication boundary

The ten entries are reviewed promises only for collection and matching. They remain outside `data/promises/` because they do not yet have owner-approved assessment revisions. The live website therefore continues to publish only the two previously approved ANO promises. Evidence collection, two-assessor review, possible arbitration, owner approval, and a separate publication change remain mandatory.
