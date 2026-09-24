import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCollectedRecord } from "../scripts/lib/collector-core.mjs";
import { validatePromiseRegistry } from "../scripts/lib/attribution.mjs";
import { buildTopicEvidencePackage } from "../scripts/lib/topic-evidence-package.mjs";

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
      linkedPrints: [{ historyContexts: [{ actionCz: "souhlas" }] }],
      ...overrides.payload
    }
  });
}

test("a topic-routed record with attributable evidence builds a real evidence package", () => {
  const pkg = buildTopicEvidencePackage({
    promise: fiscalPromise,
    routedRecords: [{ record: attributedVoteRecord(), routeBasis: ["controlled-tag"] }],
    collectorRun,
    asOf: "2026-06-15"
  });
  assert.ok(pkg, "an attributable routed record must produce a package");
  assert.equal(pkg.promise.id, fiscalPromise.id);
  assert.ok(pkg.evidence.some(({ role }) => role === "promise-source"));
  const conductEvidence = pkg.evidence.find(({ role }) => role === "conduct-evidence");
  assert.ok(conductEvidence, "must include the routed record as conduct evidence");
  assert.equal(conductEvidence.matchBasis.attributionStatus, "verified-party-vote");
  assert.deepEqual(conductEvidence.matchBasis.routeBasis, ["controlled-tag"]);
});

test("a topic-routed record that is not attributable party conduct never builds a package", () => {
  // No partyVoteSummaries at all -- a vote no one from this party is
  // recorded on cannot become attributable conduct merely through tag
  // routing (design doc step 6).
  const unattributedRecord = createCollectedRecord({
    id: "psp--unrelated-vote",
    sourceId: "psp-core-2025",
    kind: "parliamentary-vote",
    primary: true,
    evidenceRole: "primary-record",
    occurredAt: "2026-06-01T00:00:00",
    title: "Hlasování bez vazby na tuto stranu",
    publisher: "Chamber of Deputies",
    url: "https://public.psp.cz/sqw/hlasy.sqw?g=2",
    payload: { externalVoteId: "2", counts: { yes: 50, no: 40 } }
  });
  const pkg = buildTopicEvidencePackage({
    promise: fiscalPromise,
    routedRecords: [{ record: unattributedRecord, routeBasis: ["controlled-tag"] }],
    collectorRun,
    asOf: "2026-06-15"
  });
  assert.equal(pkg, null, "an unattributable routed record must never become an evidence package");
});

test("no routed records builds no package", () => {
  const pkg = buildTopicEvidencePackage({ promise: fiscalPromise, routedRecords: [], collectorRun, asOf: "2026-06-15" });
  assert.equal(pkg, null);
});
