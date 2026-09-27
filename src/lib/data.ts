import systemStatusData from "../../data/system-status.json";
import policyCategoryData from "../../data/promise-categories.json";
import { assessmentRevisionSchema, partyPeriodSchema, partySchema, periodSchema, policyCategoryDataSchema, promiseSchema, sourceSchema, systemStatusSchema, type AssessmentRevision, type AssessmentStatus, type PartyPeriod, type PolicyCategory, type PromiseRecord } from "./schema";
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
const publishedItems = allPromises.filter(({ isDemo }) => !isDemo);
// Only promises are scored; statements are listed without a score
// (docs/promise-selection.md).
export const promises = publishedItems.filter(({ kind }) => kind === "promise");
export const statements = publishedItems.filter(({ kind }) => kind === "statement");
const visiblePromiseIds = new Set(promises.map(({ id }) => id));
export const assessmentRevisions = allAssessmentRevisions.filter(({ promiseId }) => visiblePromiseIds.has(promiseId));
export const systemStatus = systemStatusSchema.parse(systemStatusData);
const policyCategoryDataParsed = policyCategoryDataSchema.parse(policyCategoryData);
export const policyCategories = [...policyCategoryDataParsed.categories].sort((a, b) => a.order - b.order);
const policyCategoryById = new Map(policyCategories.map((category) => [category.id, category]));

export const statusDetails: Record<AssessmentStatus, { score: number; symbol: string; label: string; className: string }> = {
  fulfilled: { score: 2, symbol: "✓", label: "Splněno", className: "positive-strong" },
  "moving-towards": { score: 1, symbol: "↗", label: "Směřuje ke splnění", className: "positive" },
  "no-progress": { score: 0, symbol: "—", label: "Zatím bez ověřeného podstatného posunu", className: "neutral" },
  "moving-against": { score: -1, symbol: "↘", label: "Směřuje proti slibu", className: "negative" },
  "acting-against": { score: -2, symbol: "×", label: "Jedná proti slibu", className: "negative-strong" },
};

export const statementExplanation = "Výrok strany. Nelze ho splnit ani porušit konkrétním krokem, proto nemá skóre a nepočítá se do SLAVA Indexu.";

const promiseStatusOrder: Record<AssessmentStatus, number> = {
  fulfilled: 0,
  "moving-towards": 1,
  "acting-against": 2,
  "moving-against": 3,
  "no-progress": 4,
};

export function getPublicAssessmentExplanation(explanation: string) {
  const publicExplanation = explanation.startsWith("Výchozí stav: ") ? explanation.slice("Výchozí stav: ".length) : explanation;
  return publicExplanation ? `${publicExplanation.charAt(0).toLocaleUpperCase("cs-CZ")}${publicExplanation.slice(1)}` : publicExplanation;
}

function assertRelationships() {
  const periodIds = new Set(periods.map(({ id }) => id));
  const partyIds = new Set(parties.map(({ id }) => id));
  const partyPeriodIds = new Set(partyPeriods.map(({ id }) => id));
  const promiseById = new Map(promises.map((promise) => [promise.id, promise]));
  const promiseIds = new Set(promiseById.keys());
  const assessedPromiseIds = new Set(allAssessmentRevisions.map(({ promiseId }) => promiseId));
  const sourceIds = new Set(sources.map(({ id }) => id));
  for (const item of partyPeriods) if (!periodIds.has(item.periodId) || !partyIds.has(item.partyId)) throw new Error(`Invalid PartyPeriod relationship: ${item.id}`);
  const itemIds = new Set<string>();
  for (const item of publishedItems) {
    if (itemIds.has(item.id)) throw new Error(`Duplicate published item: ${item.id}`);
    itemIds.add(item.id);
    if (!partyPeriodIds.has(item.partyPeriodId) || !sourceIds.has(item.primarySourceId)) throw new Error(`Invalid Promise relationship: ${item.id}`);
    if (!policyCategoryById.has(item.policyCategoryId)) throw new Error(`Unknown policy category: ${item.id}`);
    if (item.kind === "statement" && assessedPromiseIds.has(item.id)) throw new Error(`A statement has no score: ${item.id}`);
  }
  for (const promise of promises) if (!assessedPromiseIds.has(promise.id)) throw new Error(`Published promise is missing its current score: ${promise.id}`);
  const allItemIds = new Set(allPromises.map(({ id }) => id));
  for (const revision of allAssessmentRevisions) if (!allItemIds.has(revision.promiseId)) throw new Error(`Unknown promise in assessment: ${revision.id}`);
  for (const revision of assessmentRevisions) {
    if (!promiseIds.has(revision.promiseId)) throw new Error(`Unknown promise in assessment: ${revision.id}`);
    for (const sourceId of revision.evidenceSourceIds) if (!sourceIds.has(sourceId)) throw new Error(`Unknown evidence source ${sourceId} in ${revision.id}`);
    if (revision.baselinePromiseSourceId) {
      const promise = promiseById.get(revision.promiseId);
      if (!promise || revision.baselinePromiseSourceId !== promise.primarySourceId) throw new Error(`Invalid baseline source in ${revision.id}`);
      if (revision.evidenceSourceIds.length !== 1 || revision.evidenceSourceIds[0] !== revision.baselinePromiseSourceId) throw new Error(`Baseline revisions must list only their baseline source in ${revision.id}`);
    }
  }
}
assertRelationships();

export function getCurrentPeriod() {
  const period = periods.find(({ current }) => current);
  if (!period) throw new Error("No current period configured");
  return period;
}
// Each promise's revisions, newest first, indexed once for the whole build.
const historyByPromise = new Map<string, AssessmentRevision[]>();
for (const revision of assessmentRevisions) historyByPromise.set(revision.promiseId, [...(historyByPromise.get(revision.promiseId) ?? []), revision]);
for (const history of historyByPromise.values()) history.sort((a, b) => b.revision - a.revision);

export function getLatestAssessment(promiseId: string): AssessmentRevision {
  const revision = historyByPromise.get(promiseId)?.[0];
  if (!revision) throw new Error(`No assessment for promise ${promiseId}`);
  return revision;
}
export function getAssessmentHistory(promiseId: string) { return [...(historyByPromise.get(promiseId) ?? [])]; }
export function calculateIndex(partyPromises: PromiseRecord[]) {
  const scores = partyPromises.map(({ id }) => statusDetails[getLatestAssessment(id).status].score);
  return calculateSlavaIndex(scores);
}
export function getPartySummary(partyPeriod: PartyPeriod) {
  const party = parties.find(({ id }) => id === partyPeriod.partyId);
  const period = periods.find(({ id }) => id === partyPeriod.periodId);
  if (!party || !period) throw new Error(`Missing party or period for ${partyPeriod.id}`);
  const partyPromises = promises
    .filter(({ partyPeriodId }) => partyPeriodId === partyPeriod.id)
    .map((promise) => ({ promise, assessment: getLatestAssessment(promise.id), policyCategory: getPolicyCategory(promise) }))
    .sort((a, b) => a.policyCategory.order - b.policyCategory.order || promiseStatusOrder[a.assessment.status] - promiseStatusOrder[b.assessment.status] || a.promise.sourceOrder - b.promise.sourceOrder);
  const partyStatements = statements
    .filter(({ partyPeriodId }) => partyPeriodId === partyPeriod.id)
    .map((statement) => ({ statement, policyCategory: getPolicyCategory(statement) }))
    .sort((a, b) => a.policyCategory.order - b.policyCategory.order || a.statement.sourceOrder - b.statement.sourceOrder);
  const index = calculateIndex(partyPromises.map(({ promise }) => promise));
  return { party, period, partyPeriod, promises: partyPromises, statements: partyStatements, index };
}
export function getCurrentPartySummaries() {
  const period = getCurrentPeriod();
  return partyPeriods.filter(({ periodId }) => periodId === period.id).sort((a, b) => a.order - b.order).map(getPartySummary);
}
export function getPolicyCategory(promise: PromiseRecord): PolicyCategory {
  const category = policyCategoryById.get(promise.policyCategoryId);
  if (!category) throw new Error(`Unknown policy category for ${promise.id}`);
  return category;
}
export function getSource(sourceId: string) {
  const source = sources.find(({ id }) => id === sourceId);
  if (!source) throw new Error(`Unknown source ${sourceId}`);
  return source;
}
// The item's original source with its locator; a PDF link opens at the quoted page.
export function getItemSource(item: PromiseRecord) {
  const source = getSource(item.primarySourceId);
  const { page, paragraph, timestamp, imageRegion } = item.sourceLocator;
  const locatorLabel = page ? `strana ${page}` : paragraph ? `odstavec ${paragraph}` : timestamp ? `čas ${timestamp}` : `oblast ${imageRegion}`;
  const url = source.url && page ? `${source.url}#page=${page}` : source.url;
  return { source, locatorLabel, url };
}
