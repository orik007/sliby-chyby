import systemStatusData from "../../data/system-status.json";
import { assessmentRevisionSchema, partyPeriodSchema, partySchema, periodSchema, promiseSchema, sourceSchema, systemStatusSchema, type AssessmentRevision, type AssessmentStatus, type PartyPeriod, type PromiseRecord } from "./schema";
import { calculateSlavaIndex } from "./scoring";

function parseCollection<T>(modules: Record<string, unknown>, schema: { parse: (value: unknown) => T }): T[] {
  return Object.values(modules).map((value) => schema.parse(value));
}

export const periods = parseCollection(import.meta.glob("../../data/periods/*.json", { eager: true, import: "default" }), periodSchema);
export const parties = parseCollection(import.meta.glob("../../data/parties/*.json", { eager: true, import: "default" }), partySchema);
export const partyPeriods = parseCollection(import.meta.glob("../../data/party-periods/*.json", { eager: true, import: "default" }), partyPeriodSchema);
const allPromises = parseCollection(import.meta.glob("../../data/promises/*.json", { eager: true, import: "default" }), promiseSchema);
export const sources = parseCollection(import.meta.glob("../../data/sources/*.json", { eager: true, import: "default" }), sourceSchema);
const allAssessmentRevisions = parseCollection(import.meta.glob("../../data/assessment-revisions/*.json", { eager: true, import: "default" }), assessmentRevisionSchema);
export const promises = allPromises.filter(({ isDemo }) => !isDemo);
const visiblePromiseIds = new Set(promises.map(({ id }) => id));
export const assessmentRevisions = allAssessmentRevisions.filter(({ promiseId }) => visiblePromiseIds.has(promiseId));
export const systemStatus = systemStatusSchema.parse(systemStatusData);

export const statusDetails: Record<AssessmentStatus, { score: number; symbol: string; label: string; className: string }> = {
  fulfilled: { score: 2, symbol: "✓", label: "Splněno", className: "positive-strong" },
  "moving-towards": { score: 1, symbol: "↗", label: "Směřuje ke splnění", className: "positive" },
  "no-progress": { score: 0, symbol: "—", label: "Bez posunu", className: "neutral" },
  "moving-against": { score: -1, symbol: "↘", label: "Směřuje proti slibu", className: "negative" },
  "acting-against": { score: -2, symbol: "×", label: "Jedná proti slibu", className: "negative-strong" },
};

function assertRelationships() {
  const periodIds = new Set(periods.map(({ id }) => id));
  const partyIds = new Set(parties.map(({ id }) => id));
  const partyPeriodIds = new Set(partyPeriods.map(({ id }) => id));
  const promiseIds = new Set(promises.map(({ id }) => id));
  const sourceIds = new Set(sources.map(({ id }) => id));
  for (const item of partyPeriods) if (!periodIds.has(item.periodId) || !partyIds.has(item.partyId)) throw new Error(`Invalid PartyPeriod relationship: ${item.id}`);
  for (const promise of promises) if (!partyPeriodIds.has(promise.partyPeriodId) || !sourceIds.has(promise.primarySourceId)) throw new Error(`Invalid Promise relationship: ${promise.id}`);
  for (const revision of assessmentRevisions) {
    if (!promiseIds.has(revision.promiseId)) throw new Error(`Unknown promise in assessment: ${revision.id}`);
    for (const sourceId of revision.evidenceSourceIds) if (!sourceIds.has(sourceId)) throw new Error(`Unknown evidence source ${sourceId} in ${revision.id}`);
  }
}
assertRelationships();

export function getCurrentPeriod() {
  const period = periods.find(({ current }) => current);
  if (!period) throw new Error("No current period configured");
  return period;
}
export function getLatestAssessment(promiseId: string): AssessmentRevision {
  const revision = assessmentRevisions.filter((item) => item.promiseId === promiseId).sort((a, b) => b.revision - a.revision)[0];
  if (!revision) throw new Error(`No assessment for promise ${promiseId}`);
  return revision;
}
export function getAssessmentHistory(promiseId: string) { return assessmentRevisions.filter((item) => item.promiseId === promiseId).sort((a, b) => b.revision - a.revision); }
export function calculateIndex(partyPromises: PromiseRecord[]) {
  const scores = partyPromises.map(({ id }) => statusDetails[getLatestAssessment(id).status].score);
  return calculateSlavaIndex(scores);
}
export function getPartySummary(partyPeriod: PartyPeriod) {
  const party = parties.find(({ id }) => id === partyPeriod.partyId);
  const period = periods.find(({ id }) => id === partyPeriod.periodId);
  if (!party || !period) throw new Error(`Missing party or period for ${partyPeriod.id}`);
  const partyPromises = promises.filter(({ partyPeriodId }) => partyPeriodId === partyPeriod.id).map((promise) => ({ promise, assessment: getLatestAssessment(promise.id) }));
  const index = calculateIndex(partyPromises.map(({ promise }) => promise));
  return { party, period, partyPeriod, promises: partyPromises, index };
}
export function getCurrentPartySummaries() {
  const period = getCurrentPeriod();
  return partyPeriods.filter(({ periodId }) => periodId === period.id).sort((a, b) => a.order - b.order).map(getPartySummary);
}
export function getSource(sourceId: string) {
  const source = sources.find(({ id }) => id === sourceId);
  if (!source) throw new Error(`Unknown source ${sourceId}`);
  return source;
}
