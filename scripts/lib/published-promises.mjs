import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { taxonomyHash, validateTaxonomy } from "./topic-taxonomy.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJsonDirectory(directory) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(resolve(directory, file), "utf8"))));
}

function assertMaintenanceBaseline(id, baseline) {
  const source = baseline?.source;
  invariant(typeof baseline?.preservedStateCz === "string" && baseline.preservedStateCz.length > 0, `Promise ${id} maintenance baseline is missing the preserved state`);
  invariant(source && typeof source === "object", `Promise ${id} maintenance baseline is missing its source`);
  for (const field of ["id", "url", "publishedAt", "locator", "factSummary"]) invariant(typeof source[field] === "string" && source[field].length > 0, `Promise ${id} maintenance baseline source is missing ${field}`);
  invariant(/^https:\/\//.test(source.url), `Promise ${id} maintenance baseline source must use HTTPS`);
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(source.publishedAt) && !Number.isNaN(Date.parse(source.publishedAt)), `Promise ${id} maintenance baseline source has an invalid publication date`);
  invariant(source.primary === true, `Promise ${id} maintenance baseline source must be primary`);
}

/**
 * The promises the pipeline routes, packages, and assesses: exactly the
 * published items of kind "promise" (docs/promise-selection.md), each with
 * its routing tags from automation/topic-routing/promise-tags.json. A
 * statement is never tracked.
 */
export async function loadTrackedPromises(root = process.cwd()) {
  const data = (path) => resolve(root, "data", path);
  const [items, parties, partyPeriods, sources] = await Promise.all([
    readJsonDirectory(data("promises")),
    readJsonDirectory(data("parties")),
    readJsonDirectory(data("party-periods")),
    readJsonDirectory(data("sources"))
  ]);
  const tagFile = JSON.parse(await readFile(resolve(root, "automation/topic-routing/promise-tags.json"), "utf8"));
  invariant(tagFile?.schemaVersion === "1.0.0" && tagFile.promises && typeof tagFile.promises === "object", "Invalid promise tag file");
  // Tags were reviewed against one exact taxonomy; any change to it invalidates them.
  const routingTaxonomy = validateTaxonomy(JSON.parse(await readFile(resolve(root, "automation/topic-routing/taxonomy-v2.json"), "utf8")));
  invariant(tagFile.taxonomyVersion === routingTaxonomy.taxonomyVersion && tagFile.taxonomyContentHash === taxonomyHash(routingTaxonomy), "Promise tags were reviewed against a different routing taxonomy");
  const eligibleTags = new Set(routingTaxonomy.tags.filter(({ assessmentEligible }) => assessmentEligible).map(({ id }) => id));
  const partyById = new Map(parties.map((party) => [party.id, party]));
  const partyPeriodById = new Map(partyPeriods.map((partyPeriod) => [partyPeriod.id, partyPeriod]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const ids = new Set();
  const trackedIds = new Set();
  const promises = [];
  for (const item of items) {
    invariant(typeof item.id === "string" && item.id.length > 0, "Published item is missing id");
    invariant(!ids.has(item.id), `Duplicate published item id: ${item.id}`);
    ids.add(item.id);
    invariant(item.kind === "promise" || item.kind === "statement", `Published item ${item.id} has an invalid kind`);
    if (item.isDemo) continue;
    const tags = tagFile.promises[item.id];
    if (item.kind === "statement") {
      invariant(tags === undefined, `Statement ${item.id} must have no routing tags`);
      continue;
    }
    invariant(Array.isArray(tags) && tags.length > 0, `Promise ${item.id} has no routing tags`);
    invariant(new Set(tags).size === tags.length, `Promise ${item.id} has duplicate routing tags`);
    for (const tag of tags) invariant(eligibleTags.has(tag), `Promise ${item.id} has a routing tag that is not assessment-eligible: ${tag}`);
    invariant(Number.isInteger(item.sourceLocator?.page) && item.sourceLocator.page > 0, `Promise ${item.id} has an invalid source page`);
    if (item.maintenanceBaseline !== undefined) assertMaintenanceBaseline(item.id, item.maintenanceBaseline);
    trackedIds.add(item.id);
    const partyPeriod = partyPeriodById.get(item.partyPeriodId);
    invariant(partyPeriod, `Promise ${item.id} has an unknown party period`);
    const party = partyById.get(partyPeriod.partyId);
    const source = sourceById.get(item.primarySourceId);
    invariant(party && source, `Promise ${item.id} has an unknown party or source`);
    invariant(source.type === "programme", `Promise ${item.id} source must be an election programme`);
    invariant(/^https:\/\//.test(source.url), `Promise ${item.id} source must use HTTPS`);
    promises.push({
      id: item.id,
      partyPeriodId: item.partyPeriodId,
      partyId: party.id,
      partyName: party.fullName,
      titleCz: item.title,
      originalTextCz: item.originalText,
      tags,
      promiseSource: {
        id: `${item.id}--source`,
        role: "promise-source",
        type: source.type,
        title: source.title,
        publisher: source.publisher,
        publishedAt: source.publishedAt,
        url: source.url,
        locator: `PDF page ${item.sourceLocator.page}`,
        primary: true,
        factSummary: "The official national election programme contains the exact wording of this promise.",
        exactQuoteCz: item.originalText
      },
      ...(item.maintenanceBaseline ? { maintenanceBaseline: item.maintenanceBaseline } : {})
    });
  }
  for (const id of Object.keys(tagFile.promises)) invariant(trackedIds.has(id), `Tagged item ${id} is not a tracked promise`);
  return { taxonomy: routingTaxonomy, promises: promises.sort((left, right) => left.id.localeCompare(right.id)) };
}
