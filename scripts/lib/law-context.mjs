import { versionConcerned } from "./attribution.mjs";
import { parseAmendingInstructions } from "./amending-instructions.mjs";
import { versionKeys, versionLabels, versionOfChange } from "./print-parts.mjs";

/**
 * The context of a law change (docs/evidence-pipeline.md, Law-change
 * context): for each version, the wording of every provision its amending
 * instructions name, as in force on the date of the earliest conduct on that
 * version, each target with exactly one status.
 */
export const lawContextVersion = "law-context-v1";
export const targetStatuses = ["found", "later-wording", "paragraph-not-found", "new-provision", "not-found", "not-recognised"];

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * The date of the earliest conduct on each version of a law change: its
 * submission or a decisive vote, from the records of its print.
 */
export function conductDatesOfVersions(change, records) {
  const dates = {};
  for (const record of records) {
    const concerned = versionOfChange(change, versionConcerned(record, change.printId));
    const date = String(record.occurredAt ?? "").slice(0, 10);
    if (!concerned || concerned.removed || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) continue;
    if (!dates[concerned.version] || date < dates[concerned.version]) dates[concerned.version] = date;
  }
  return dates;
}

/** The wording in force on a date: effective from on or before it and, if it ends, to on or after it. */
export function wordingOn(wordings, date) {
  return wordings.find(({ from, to }) => from <= date && (to === null || date <= to)) ?? null;
}

/**
 * The nodes of a structure that hold a target, or null. A § is found by its
 * ELI path only (`…/par_52`), never by a citation label; a paragraph by
 * `…/par_52/odst_1`; an article by `…/cl_2` and its point by `…/cl_2/bod_5`;
 * an annex by `…/prilohy/priloha_3` (the only, unnumbered annex is
 * `priloha_0`) and a fee-schedule item by `…/pol_18` in it; a footnote by
 * `…/poznamkypodcarou/ppc_79`. Returns `{ roots, partial }`: `partial` when
 * the § or article exists but the named paragraph or point does not, and
 * then the whole § or article.
 */
export function locateTarget(paths, target) {
  const matching = (pattern) => paths.filter((path) => pattern.test(path));
  if (target.kind === "annex") {
    const annexes = target.annex === null ? ["priloha_1", "priloha_0"] : [`priloha_${target.annex}`];
    for (const annex of annexes) {
      const root = matching(new RegExp(`(?:^|/)prilohy/${annex}$`, "u"));
      if (root.length === 0) continue;
      if (!target.item) return { roots: root, partial: false };
      const item = matching(new RegExp(`(?:^|/)prilohy/${annex}/(?:.*/)?pol_${escape(target.item)}$`, "u"));
      return item.length > 0 ? { roots: item, partial: false } : { roots: root, partial: true };
    }
    return null;
  }
  if (target.kind === "footnote") {
    const roots = matching(new RegExp(`(?:^|/)poznamkypodcarou/ppc_${escape(target.footnote)}(?::\\d+)?$`, "u"));
    return roots.length > 0 ? { roots, partial: false } : null;
  }
  if (target.kind === "article") {
    const roots = matching(new RegExp(`(?:^|/)cl_${escape(target.article)}(?::\\d+)?$`, "u")).filter((path) => !path.includes("/prilohy/"));
    if (roots.length === 0) return null;
    const child = target.point ? `bod_${escape(target.point)}` : target.paragraph ? `odst_${escape(target.paragraph)}` : null;
    if (!child) return { roots, partial: false };
    const nested = roots.flatMap((root) => matching(new RegExp(`^${escape(root)}/${child}$`, "u")));
    return nested.length > 0 ? { roots: nested, partial: false } : { roots, partial: true };
  }
  const roots = matching(new RegExp(`(?:^|/)par_${escape(target.section)}(?::\\d+)?$`, "u")).filter((path) => !path.includes("/prilohy/"));
  if (roots.length === 0) return null;
  if (!target.paragraph) return { roots, partial: false };
  const nested = roots.flatMap((root) => matching(new RegExp(`^${escape(root)}/odst_${escape(target.paragraph)}$`, "u")));
  return nested.length > 0 ? { roots: nested, partial: false } : { roots, partial: true };
}

/** A root node and every node below it, in the structure. */
export function nodesUnder(paths, roots) {
  return paths.filter((path) => roots.some((root) => path === root || path.startsWith(`${root}/`)));
}

const romanNumerals = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

/** A readable citation of an ELI path, such as "§ 52 odst. 1 písm. a)". */
export function citationOfPath(path) {
  const parts = [];
  for (const segment of path.split("/")) {
    const [kind, value] = segment.split("_");
    const number = value?.split(":")[0];
    if (kind === "par") parts.push(`§ ${number}`);
    else if (kind === "odst") parts.push(`odst. ${number}`);
    else if (kind === "pism") parts.push(`písm. ${number})`);
    else if (kind === "bod") parts.push(`bod ${number}`);
    else if (kind === "cl") parts.push(`čl. ${romanNumerals[Number(number)] ?? number}`);
    else if (kind === "priloha") parts.push(number === "0" ? "příloha" : `příloha č. ${number}`);
    else if (kind === "pol") parts.push(`položka ${number}`);
    else if (kind === "ppc") parts.push(`poznámka pod čarou č. ${number}`);
  }
  return parts.join(" ") || path;
}

function describeTarget(target) {
  if (target.kind === "annex") return `${target.annex === null ? "příloha" : `příloha č. ${target.annex}`}${target.item ? ` položka ${target.item}` : ""}`;
  if (target.kind === "footnote") return `poznámka pod čarou č. ${target.footnote}`;
  if (target.kind === "article") return `čl. ${romanNumerals[Number(target.article)] ?? target.article}${target.point ? ` bod ${target.point}` : ""}${target.paragraph ? ` odst. ${target.paragraph}` : ""}`;
  return `§ ${target.section}${target.paragraph ? ` odst. ${target.paragraph}` : ""}`;
}

/**
 * Resolves the context of one law change. `records` are the conduct records
 * of its print; `reader` reads wordings, structures, and texts through the
 * cache (e-sbirka.mjs). A version without conduct or without an amended act
 * gets no context. Returns `{ versions: { [version]: context } }`.
 */
export async function resolveLawChangeContext(change, records, reader) {
  const dates = conductDatesOfVersions(change, records);
  const versions = {};
  for (const version of versionKeys) {
    const entry = change.versions[version];
    if (!entry || entry.removed || !dates[version]) continue;
    const textEntry = entry.sameAs ? change.versions[entry.sameAs] : entry;
    const amendedAct = (entry.amendedAct ?? textEntry?.amendedAct)?.act;
    if (!textEntry?.textCz || !amendedAct) continue;
    versions[version] = await resolveVersionContext(textEntry.textCz, amendedAct, dates[version], reader);
  }
  return { contextVersion: lawContextVersion, versions };
}

async function resolveVersionContext(text, amendedAct, date, reader) {
  const instructions = parseAmendingInstructions(text, amendedAct);
  const inserted = new Set();
  const provisions = new Map();
  const resolved = [];
  for (const instruction of instructions) {
    const targets = [];
    if (instruction.targets.length === 0) {
      resolved.push({ instructionCz: instruction.textCz, targets: [{ target: null, status: "not-recognised" }] });
      continue;
    }
    for (const target of instruction.targets) {
      const key = target.section ? `${target.act}#${target.section}` : null;
      if (target.kind === "inserted") {
        inserted.add(key);
        targets.push({ target: describeTarget(target), status: "new-provision" });
        continue;
      }
      const located = await locateAtDate(target, date, reader);
      if (!located && key && inserted.has(key)) {
        targets.push({ target: describeTarget(target), status: "new-provision" });
        continue;
      }
      if (!located) {
        targets.push({ target: describeTarget(target), status: "not-found" });
        continue;
      }
      const status = located.later ? "later-wording" : located.partial ? "paragraph-not-found" : "found";
      const ids = [];
      for (const root of located.roots) {
        const id = `${target.act}@${located.wording}#${root}`;
        if (!provisions.has(id)) provisions.set(id, { act: target.act, wording: located.wording, path: root, citation: citationOfPath(root), nodes: nodesUnder(located.paths, [root]) });
        ids.push(id);
      }
      targets.push({ target: describeTarget(target), status, wording: located.wording, provisionIds: ids });
    }
    resolved.push({ instructionCz: instruction.textCz, targets });
  }
  // A provision inside another supplied one of the same wording is not
  // supplied twice: its targets point to the enclosing provision.
  for (const [id, provision] of provisions) {
    const enclosing = [...provisions.entries()].find(([otherId, other]) => otherId !== id && other.act === provision.act && other.wording === provision.wording && provision.path.startsWith(`${other.path}/`));
    if (!enclosing) continue;
    provisions.delete(id);
    for (const { targets } of resolved) {
      for (const target of targets) {
        if (target.provisionIds) target.provisionIds = [...new Set(target.provisionIds.map((value) => (value === id ? enclosing[0] : value)))];
      }
    }
  }
  // The texts of every provision, read once per wording.
  const byWording = new Map();
  for (const provision of provisions.values()) {
    const key = `${provision.act}@${provision.wording}`;
    byWording.set(key, [...(byWording.get(key) ?? []), provision]);
  }
  for (const group of byWording.values()) {
    const { act, wording } = group[0];
    const texts = await reader.texts(act, wording, [...new Set(group.flatMap(({ nodes }) => nodes))]);
    for (const provision of group) {
      provision.textCz = provision.nodes
        .map((path) => ({ path, ...texts[path] }))
        .filter(({ text }) => text)
        .sort((left, right) => String(left.order ?? "").localeCompare(String(right.order ?? "")) || left.path.localeCompare(right.path, "en", { numeric: true }))
        .map(({ text }) => text)
        .join("\n");
      delete provision.nodes;
    }
  }
  return {
    conductDate: date,
    amendedAct,
    instructions: resolved,
    provisions: Object.fromEntries([...provisions.entries()].map(([id, { act, wording, path, citation, textCz }]) => [id, { act, wording, path, citation, textCz }]))
  };
}

// The wording on the date, or the nearest later wording that holds the target.
async function locateAtDate(target, date, reader) {
  const wordings = await reader.wordings(target.act, { for: date });
  const current = wordingOn(wordings, date);
  if (current) {
    const paths = await reader.structure(target.act, current.wording);
    const found = locateTarget(paths, target);
    if (found) return { ...found, wording: current.wording, paths, later: false };
  }
  for (const later of wordings.filter(({ from }) => from > date)) {
    const paths = await reader.structure(target.act, later.wording);
    const found = locateTarget(paths, target);
    if (found) return { ...found, wording: later.wording, paths, later: true };
  }
  return null;
}

const statusLabels = {
  found: "found in the wording in force on the date of the conduct",
  "later-wording": "not in the wording in force on the date of the conduct; taken from a later wording (an earlier amendment, already promulgated, inserted it with a later effect)",
  "paragraph-not-found": "the named paragraph or point does not exist in that wording; the whole provision is supplied",
  "new-provision": "inserted by this change itself; there is no earlier text",
  "not-found": "not in e-Sbírka, neither in the wording in force on the date of the conduct nor in any later wording",
  "not-recognised": "the instruction names no single provision that could be supplied (for example a whole part or head, a title, or a replacement of words in the whole act)"
};

/**
 * The context of one version as the models read it: each instruction with
 * the status of its targets, then the text of every supplied provision once.
 */
export function contextText(context) {
  if (!context) return null;
  const lines = [`Context: the wording of the amended provisions in the Collection of Laws (e-Sbírka) in force on ${context.conductDate}, the date of the earliest conduct on this version. It is not evidence of conduct.`];
  for (const { instructionCz, targets } of context.instructions) {
    lines.push(`Instruction: ${instructionCz}`);
    for (const { target, status, wording } of targets) {
      lines.push(`- ${target ? `${target}: ` : ""}${statusLabels[status]}${wording ? ` (wording effective from ${wording})` : ""}.`);
    }
  }
  const provisions = Object.values(context.provisions);
  if (provisions.length > 0) {
    lines.push("Supplied provisions:");
    for (const { act, wording, citation, textCz } of provisions) {
      lines.push(`${citation} zákona č. ${act} Sb., wording effective from ${wording}:\n${textCz || "(no text in e-Sbírka)"}`);
    }
  }
  return lines.join("\n");
}

/**
 * A law change whose versions carry the context text the models read
 * (`contextCz`), so screening, relevance checks, and the evidence package,
 * and their input hashes, all include it.
 */
export function withContext(change, context) {
  const versions = {};
  for (const [version, entry] of Object.entries(change.versions)) {
    const text = contextText(context.versions[version]);
    versions[version] = text ? { ...entry, contextCz: text } : entry;
  }
  return { ...change, versions };
}

/** Counts of targets by status, for the audit. */
export function contextStatusCounts(contexts) {
  const counts = Object.fromEntries(targetStatuses.map((status) => [status, 0]));
  for (const context of contexts) {
    for (const version of Object.values(context?.versions ?? {})) {
      for (const { targets } of version.instructions) for (const { status } of targets) counts[status] += 1;
    }
  }
  return counts;
}

export { versionLabels };
