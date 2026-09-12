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
    reviewerDecision: { status: "pending", note: null },
    originalTextCz: "Kyberbezpečnost a moderní hrozby Posílíme kapacity NÚKIB a dalších složek kybernetické bezpečnosti.",
  });
});

test("category audit keeps every unreviewed row open and detects the pension-heading regression", () => {
  const record = audit.rows.find(({ promiseId }) => promiseId === "candidate-815ab3193662");
  assert.equal(record.possibleHeadingPrefix, "DŮSTOJNÉ DŮCHODY A OCHRANA SENIORŮ PŘED CHUDOBOU");
  assert.equal(record.requiresItemReview, true);
  assert.deepEqual(record.sourceMetadataReview, { status: "pending", note: null });
  assert.deepEqual(record.reviewerDecision, { status: "pending", note: null });
});

test("category audit rejects an unknown proposed category", () => {
  const malformedAudit = structuredClone(audit);
  malformedAudit.rows[0].proposedPolicyCategoryId = "unknown-category";
  assert.throws(() => categoryAuditSchema.parse(malformedAudit));
});
