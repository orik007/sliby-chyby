import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { categoryAuditSchema, createCategoryAudit } from "../scripts/lib/promise-category-audit.mjs";

const catalogue = JSON.parse(await readFile(new URL("../research/2025-election/promises.json", import.meta.url), "utf8"));
const audit = JSON.parse(await readFile(new URL("../research/2025-election/promise-category-audit.json", import.meta.url), "utf8"));

test("category audit covers every and only confirmed promise", () => {
  assert.deepEqual(createCategoryAudit(catalogue), categoryAuditSchema.parse(audit));
  const confirmedIds = catalogue.promises.filter(({ status }) => status === "confirmed").map(({ id }) => id).sort();
  const auditIds = audit.rows.map(({ promiseId }) => promiseId).sort();
  assert.deepEqual(auditIds, confirmedIds);
  assert.equal(new Set(auditIds).size, auditIds.length);
  assert.equal(audit.counts.confirmedPromises, confirmedIds.length);
  assert.equal(audit.counts.requiringItemReview, confirmedIds.length);
});

test("category audit records the NÚKIB heading issue without changing the promise", () => {
  const record = audit.rows.find(({ promiseId }) => promiseId === "candidate-aafc1d1e345b");
  assert.deepEqual(record, {
    promiseId: "candidate-aafc1d1e345b",
    partyId: "motoriste",
    sourceId: "motoriste-programme-2025",
    sourcePage: 31,
    programmeChapter: "Spravedlnost a bezpečnost: stát, který chrání, ne šikanuje",
    programmeChapterOrder: 14,
    programmeChapterPages: { firstPage: 30, lastPage: 31 },
    sourceSection: "Kyberbezpečnost a moderní hrozby",
    sourceSectionOrder: 6,
    sourceOrder: 1,
    proposedPolicyCategoryId: "security-defence-and-migration",
    possibleHeadingPrefix: "Kyberbezpečnost a moderní hrozby",
    requiresItemReview: true,
    sourceMetadataReview: { status: "verified", note: "Verified against the official Motoristé programme, page 31." },
    sourceReview: { status: "pending", note: null },
    originalTextCz: "Kyberbezpečnost a moderní hrozby Posílíme kapacity NÚKIB a dalších složek kybernetické bezpečnosti.",
  });
});

test("category audit records verified ANO finance source sections", () => {
  const expectedSections = {
    "candidate-ae84cf104aa1": ["VYLÉČÍME NEMOCNOU EKONOMIKU", 1, 1],
    "ano-2025-not-adopt-euro": ["ČESKÁ KORUNA, NE EURO", 2, 1],
    "ano-2025-digital-tax-cobra": ["BOJ PROTI ŠEDÉ EKONOMICE", 3, 1],
    "ano-2025-eet-2": ["EET 2.0", 4, 1],
    "ano-2025-restore-kindergarten-tax-credit": ["SNÍŽÍME DANĚ", 5, 1],
    "ano-2025-restore-working-student-tax-credit": ["SNÍŽÍME DANĚ", 5, 2],
    "ano-2025-stop-2026-self-employed-contribution-increase": ["SNÍŽÍME DANĚ", 5, 3],
    "ano-2025-remove-leisure-benefit-cap": ["SNÍŽÍME DANĚ", 5, 4],
    "ano-2025-corporate-income-tax-19": ["SNÍŽÍME DANĚ", 5, 5],
    "ano-2025-restaurant-nonalcoholic-vat-12": ["SNÍŽÍME DANĚ", 5, 6],
    "ano-2025-tax-exempt-voluntary-tips": ["OSVOBODÍME SPROPITNÉ V GASTRONOMII OD DANĚ A POJISTNÝCH", 6, 1],
    "ano-2025-online-tax-office": ["JEDNODUŠŠÍ DAŇOVÁ PŘIZNÁNÍ", 7, 1],
    "ano-2025-retail-state-bonds": ["STÁTNÍ DLUHOPISY PRO OBČANY", 8, 1],
    "ano-2025-customs-entry-salary-50000": ["OCENĚNÍ PRÁCE CELNÍKŮ", 11, 1],
  };
  for (const [promiseId, [sourceSection, sourceSectionOrder, sourceOrder]] of Object.entries(expectedSections)) {
    const record = audit.rows.find((row) => row.promiseId === promiseId);
    assert.deepEqual([record.sourceSection, record.sourceSectionOrder, record.sourceOrder], [sourceSection, sourceSectionOrder, sourceOrder], `Incorrect verified ANO source context for ${promiseId}`);
    assert.deepEqual(record.sourceMetadataReview, { status: "verified", note: `Verified against the official ANO programme, page ${record.sourcePage}.` });
  }
});

test("category audit keeps every unreviewed row open and detects the pension-heading regression", () => {
  const record = audit.rows.find(({ promiseId }) => promiseId === "candidate-815ab3193662");
  assert.equal(record.possibleHeadingPrefix, "DŮSTOJNÉ DŮCHODY A OCHRANA SENIORŮ PŘED CHUDOBOU");
  assert.equal(record.requiresItemReview, true);
  assert.deepEqual(record.sourceMetadataReview, { status: "pending", note: null });
  assert.deepEqual(record.sourceReview, { status: "pending", note: null });
});

test("category audit rejects an unknown proposed category", () => {
  const malformedAudit = structuredClone(audit);
  malformedAudit.rows[0].proposedPolicyCategoryId = "unknown-category";
  assert.throws(() => categoryAuditSchema.parse(malformedAudit));
});
