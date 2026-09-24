import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import { validatePromiseRegistry } from "../scripts/lib/attribution.mjs";
import { buildLawChangeEvidencePackage, estimatePackageTokens, lawChangeEvidenceId, maxPackageTokens } from "../scripts/lib/topic-evidence-package.mjs";

const registry = validatePromiseRegistry(JSON.parse(await readFile(new URL("../automation/promise-registry/promises.json", import.meta.url), "utf8")));
const fiscalPromise = registry.promises.find(({ id }) => id === "candidate-d5359e35a4c4");
const collectorRun = { schemaVersion: "1.0.0", runId: "fixture-run", records: [] };

function attributedVoteRecord(overrides = {}) {
  return createCollectedRecord({
    id: overrides.id ?? "psp--fiscal-vote-1",
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: overrides.occurredAt ?? "2026-06-01T00:00:00",
    title: "Hlasování o novele zákona o pravidlech rozpočtové odpovědnosti",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/hlasy.sqw?g=1",
    payload: {
      externalVoteId: "1",
      counts: { yes: 90, no: 10 },
      partyVoteSummaries: [{
        partyId: fiscalPromise.partyId,
        attributionStatus: "attributed",
        majorityChoice: "yes",
        counts: { yes: 20, no: 0 },
        strictMajorityThreshold: 11,
        eligibleMemberCount: 21
      }],
      linkedPrints: [{ externalPrintId: "43200", historyContexts: [{ actionCz: "souhlas" }] }],
      ...overrides.payload
    }
  });
}

function lawChange(index, textCz = "Zákon č. 23/2017 Sb., o pravidlech rozpočtové odpovědnosti, se mění takto: …") {
  return {
    changeId: `43200-${index}`,
    printId: "43200",
    printNumber: 90,
    printKindId: "1",
    printTitleCz: "Vládní návrh zákona, kterým se mění některé zákony v oblasti veřejných rozpočtů",
    printPageUrl: "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=90&CT1=0",
    index,
    heading: index === 1 ? "ČÁST PRVNÍ" : "ČÁST DRUHÁ",
    titleCz: index === 1 ? "Změna zákona o pravidlech rozpočtové odpovědnosti" : "Změna rozpočtových pravidel",
    acts: [{ act: index === 1 ? "23/2017" : "218/2000", name: null }],
    identifiers: [index === 1 ? "cz-act-23-2017" : "cz-act-218-2000"],
    document: { filename: "t009000.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=1", sectionLabel: "Návrh zákona včetně důvodové zprávy" },
    textCz
  };
}

const route = { routeBasis: ["direct-structural-link"], matchedTagIds: [], directLinkIdentifiers: ["cz-act-23-2017"] };
const printFirstSeenOn = new Map([["43200", "2026-02-01"]]);

test("a package holds every kept law change in full and the party's conduct on its print, once", () => {
  const vote = attributedVoteRecord();
  const pkg = buildLawChangeEvidencePackage({
    promise: fiscalPromise,
    keptChanges: [{ change: lawChange(2), route }, { change: lawChange(1), route }],
    recordsByPrintId: new Map([["43200", [vote]]]),
    printFirstSeenOn,
    collectorRun,
    asOf: "2026-06-15"
  });
  assert.equal(pkg.promise.id, fiscalPromise.id);
  const changes = pkg.evidence.filter(({ role }) => role === "law-change");
  assert.deepEqual(changes.map(({ id }) => id), [lawChangeEvidenceId(lawChange(1)), lawChangeEvidenceId(lawChange(2))]);
  assert.equal(changes[0].structuredFacts.textCz, lawChange(1).textCz);
  assert.equal(changes[0].publishedAt, "2026-02-01");
  assert.deepEqual(changes[0].matchBasis, route);
  const conduct = pkg.evidence.filter(({ role }) => role === "conduct-evidence");
  assert.equal(conduct.length, 1, "a vote on the print appears once for all its law changes");
  assert.equal(conduct[0].matchBasis.attributionStatus, "verified-party-vote");
  assert.deepEqual(conduct[0].structuredFacts.concernsLawChangeIds, ["43200-1", "43200-2"]);
  assert.equal(pkg.generation.lawChangeCount, 2);
  assert.equal(pkg.generation.oversized, false);
});

test("nothing is trimmed: many law changes all stay in the package", () => {
  const keptChanges = Array.from({ length: 40 }, (_, index) => ({ change: { ...lawChange(index + 1), heading: `ČÁST ${index + 1}` }, route }));
  const pkg = buildLawChangeEvidencePackage({ promise: fiscalPromise, keptChanges, recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg.evidence.filter(({ role }) => role === "law-change").length, 40);
});

test("a package above the normal-price input limit is marked oversized, not trimmed", () => {
  const huge = "x".repeat(maxPackageTokens * 3 + 10);
  const pkg = buildLawChangeEvidencePackage({ promise: fiscalPromise, keptChanges: [{ change: lawChange(1, huge), route }], recordsByPrintId: new Map([["43200", [attributedVoteRecord()]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg.generation.oversized, true);
  assert.ok(pkg.generation.estimatedTokens > maxPackageTokens);
  assert.equal(pkg.evidence.find(({ role }) => role === "law-change").structuredFacts.textCz, huge);
  assert.equal(estimatePackageTokens({ text: "abc" }), Math.ceil(JSON.stringify({ text: "abc" }).length / 3));
});

test("a law change without attributable conduct of the promise's party builds no package", () => {
  // No partyVoteSummaries: nobody from this party is recorded on the vote.
  const unattributed = createCollectedRecord({
    id: "psp--unrelated-vote",
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-06-01T00:00:00",
    title: "Hlasování bez vazby na tuto stranu",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/hlasy.sqw?g=2",
    payload: { externalVoteId: "2", counts: { yes: 50, no: 40 }, linkedPrints: [{ externalPrintId: "43200", historyContexts: [{ actionCz: "souhlas" }] }] }
  });
  const pkg = buildLawChangeEvidencePackage({ promise: fiscalPromise, keptChanges: [{ change: lawChange(1), route }], recordsByPrintId: new Map([["43200", [unattributed]]]), printFirstSeenOn, collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg, null);
  assert.equal(buildLawChangeEvidencePackage({ promise: fiscalPromise, keptChanges: [], recordsByPrintId: new Map(), printFirstSeenOn, collectorRun, asOf: "2026-06-15" }), null);
});
