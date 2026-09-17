function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateTaxonomy(taxonomy) {
  invariant(taxonomy?.schemaVersion === "1.0.0", "Unsupported topic-routing taxonomy schemaVersion");
  invariant(typeof taxonomy.taxonomyVersion === "string" && taxonomy.taxonomyVersion.length > 0, "Taxonomy is missing taxonomyVersion");
  invariant(Array.isArray(taxonomy.tags) && taxonomy.tags.length > 0, "Taxonomy must contain tags");

  const ids = new Set();
  for (const tag of taxonomy.tags) {
    invariant(typeof tag.id === "string" && tag.id.length > 0, "Taxonomy tag is missing id");
    invariant(!ids.has(tag.id), `Duplicate taxonomy tag id: ${tag.id}`);
    ids.add(tag.id);
    invariant(tag.parent === null || typeof tag.parent === "string", `Tag ${tag.id} has an invalid parent`);
    invariant(typeof tag.labelEn === "string" && tag.labelEn.length > 0, `Tag ${tag.id} is missing labelEn`);
    invariant(typeof tag.assessmentEligible === "boolean", `Tag ${tag.id} is missing assessmentEligible`);
    invariant(Array.isArray(tag.inclusionExamples) && tag.inclusionExamples.length > 0, `Tag ${tag.id} needs at least one inclusion example`);
    invariant(Array.isArray(tag.exclusionExamples) && tag.exclusionExamples.length > 0, `Tag ${tag.id} needs at least one exclusion example`);
    invariant(Array.isArray(tag.czechAliases) && tag.czechAliases.length > 0, `Tag ${tag.id} needs at least one Czech alias`);
    if (tag.directLegalIdentifiers !== undefined) {
      invariant(Array.isArray(tag.directLegalIdentifiers), `Tag ${tag.id} directLegalIdentifiers must be an array`);
    }
  }
  for (const tag of taxonomy.tags) {
    invariant(tag.parent === null || ids.has(tag.parent), `Tag ${tag.id} has an unknown parent: ${tag.parent}`);
    invariant(tag.parent !== tag.id, `Tag ${tag.id} cannot be its own parent`);
  }
  return taxonomy;
}

export function resolveTag(taxonomy, tagId) {
  const tag = taxonomy.tags.find((candidate) => candidate.id === tagId);
  invariant(tag, `Unknown taxonomy tag: ${tagId}`);
  return tag;
}

export function hasTag(taxonomy, tagId) {
  return taxonomy.tags.some((tag) => tag.id === tagId);
}

export function ancestorChain(taxonomy, tagId) {
  const chain = [];
  let current = resolveTag(taxonomy, tagId);
  while (current.parent) {
    current = resolveTag(taxonomy, current.parent);
    chain.push(current.id);
  }
  return chain;
}

export function isDescendant(taxonomy, tagId, ancestorId) {
  return ancestorChain(taxonomy, tagId).includes(ancestorId);
}

export function isAssessmentEligible(taxonomy, tagId) {
  return resolveTag(taxonomy, tagId).assessmentEligible === true;
}

export function aliasIndex(taxonomy) {
  const index = new Map();
  for (const tag of taxonomy.tags) {
    for (const alias of tag.czechAliases) {
      const key = alias.trim().toLocaleLowerCase("cs-CZ");
      invariant(!index.has(key), `Czech alias "${alias}" is assigned to more than one tag`);
      index.set(key, tag.id);
    }
  }
  return index;
}

export function directLegalIdentifierIndex(taxonomy) {
  const index = new Map();
  for (const tag of taxonomy.tags) {
    for (const identifier of tag.directLegalIdentifiers ?? []) {
      const list = index.get(identifier) ?? [];
      list.push(tag.id);
      index.set(identifier, list);
    }
  }
  return index;
}

export function taxonomyHash(taxonomy) {
  const content = JSON.stringify(taxonomy.tags.map(({ id, parent, assessmentEligible }) => ({ id, parent, assessmentEligible })).sort((a, b) => a.id.localeCompare(b.id)));
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
