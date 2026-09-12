import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogue = JSON.parse(await readFile(new URL("../research/2025-election/promises.json", import.meta.url), "utf8"));
const audit = JSON.parse(await readFile(new URL("../research/2025-election/promise-category-audit.json", import.meta.url), "utf8"));

test("category audit covers every and only confirmed promise", () => {
  const confirmedIds = catalogue.promises.filter(({ status }) => status === "confirmed").map(({ id }) => id).sort();
  const auditIds = audit.rows.map(({ promiseId }) => promiseId).sort();
  assert.deepEqual(auditIds, confirmedIds);
  assert.equal(new Set(auditIds).size, auditIds.length);
  assert.equal(audit.counts.confirmedPromises, confirmedIds.length);
});

test("category audit records the NÚKIB heading issue without changing the promise", () => {
  const record = audit.rows.find(({ promiseId }) => promiseId === "candidate-aafc1d1e345b");
  assert.deepEqual(record, {
    promiseId: "candidate-aafc1d1e345b",
    partyId: "motoriste",
    sourceId: "motoriste-programme-2025",
    sourcePage: 31,
    sourceSection: "Spravedlnost a bezpečnost: stát, který chrání, ne šikanuje",
    sourceSectionPages: { firstPage: 30, lastPage: 31 },
    proposedPolicyCategoryId: "security-defence-and-migration",
    possibleHeadingPrefix: "Kyberbezpečnost a moderní hrozby",
    requiresItemReview: true,
    originalTextCz: "Kyberbezpečnost a moderní hrozby Posílíme kapacity NÚKIB a dalších složek kybernetické bezpečnosti.",
  });
});
