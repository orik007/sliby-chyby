import { versionConcerned } from "./attribution.mjs";
import { parseAmendingInstructions } from "./amending-instructions.mjs";
import { promulgatedWording } from "./e-sbirka.mjs";
import { versionKeys, versionLabels, versionOfChange } from "./print-parts.mjs";

/**
 * The context of a law change (docs/evidence-pipeline.md, Law-change
 * context): for each version, the wording of every provision its amending
 * instructions name, as in force on the date of the earliest conduct on that
 * version, each target with exactly one status.
 */
export const lawContextVersion = "law-context-v1";
export const targetStatuses = ["found", "later-wording", "promulgated-wording", "unverified-later-wording", "paragraph-not-found", "new-provision", "not-found", "not-recognised"];

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

/**
 * Compares two provision numbers such as "5", "5a", and "6": by number, then
 * by letters ("5" < "5a" < "5b" < "5aa").
 */
export function compareNumbers(left, right) {
  const [, leftNumber, leftLetters] = /^(\d+)([a-z]*)$/u.exec(left) ?? [null, "0", left];
  const [, rightNumber, rightLetters] = /^(\d+)([a-z]*)$/u.exec(right) ?? [null, "0", right];
  return Number(leftNumber) - Number(rightNumber) || leftLetters.length - rightLetters.length || leftLetters.localeCompare(rightLetters);
}

const inRange = (number, from, to) => compareNumbers(from, number) <= 0 && compareNumbers(number, to) <= 0;

// The nodes of `kind` (`par`, `ppc`) whose number is within a range, outside
// the annexes for §§.
function rangeRoots(paths, kind, from, to) {
  const pattern = new RegExp(`(?:^|/)${kind}_(\\d+[a-z]*)(?::\\d+)?$`, "u");
  return paths.filter((path) => {
    const number = pattern.exec(path)?.[1];
    return number !== undefined && inRange(number, from, to) && (kind !== "par" || !path.includes("/prilohy/"));
  });
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
 * `…/poznamkypodcarou/ppc_79`. A range of §§ or footnotes is every § or
 * footnote numbered within it, including those with letters. Returns `{ roots, partial }`: `partial` when
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
      // A missing item is not found; the whole annex, which can be a long
      // fee schedule, is never supplied in its place.
      const item = matching(new RegExp(`(?:^|/)prilohy/${annex}/(?:.*/)?${target.item.kind}_${escape(target.item.number)}$`, "u"));
      return item.length > 0 ? { roots: item, partial: false } : null;
    }
    return null;
  }
  if (target.kind === "footnote" && target.footnoteTo) {
    const roots = rangeRoots(paths, "ppc", target.footnote, target.footnoteTo);
    return roots.length > 0 ? { roots, partial: false } : null;
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
  if (target.sectionTo) {
    const roots = rangeRoots(paths, "par", target.section, target.sectionTo);
    return roots.length > 0 ? { roots, partial: false } : null;
  }
  const roots = matching(new RegExp(`(?:^|/)par_${escape(target.section)}(?::\\d+)?$`, "u")).filter((path) => !path.includes("/prilohy/"));
  if (roots.length === 0) return null;
  const paragraphs = target.paragraph ? roots.flatMap((root) => matching(new RegExp(`^${escape(root)}/odst_${escape(target.paragraph)}$`, "u"))) : roots;
  if (paragraphs.length === 0) return { roots, partial: true };
  if (!target.letter) return { roots: paragraphs, partial: false };
  // A letter changed in place is supplied alone; without it, its paragraph.
  const letters = paragraphs.flatMap((root) => matching(new RegExp(`^${escape(root)}/pism_${escape(target.letter)}$`, "u")));
  return letters.length > 0 ? { roots: letters, partial: false } : { roots: paragraphs, partial: true };
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
  if (target.kind === "annex") return `${target.annex === null ? "příloha" : `příloha č. ${target.annex}`}${target.item ? ` ${target.item.kind === "pol" ? "položka" : "bod"} ${target.item.number}` : ""}`;
  if (target.kind === "footnote") return target.footnoteTo ? `poznámky pod čarou č. ${target.footnote} až ${target.footnoteTo}` : `poznámka pod čarou č. ${target.footnote}`;
  if (target.sectionTo) return `§ ${target.section} až ${target.sectionTo}`;
  if (target.kind === "article") return `čl. ${romanNumerals[Number(target.article)] ?? target.article}${target.point ? ` bod ${target.point}` : ""}${target.paragraph ? ` odst. ${target.paragraph}` : ""}`;
  return `§ ${target.section}${target.paragraph ? ` odst. ${target.paragraph}` : ""}${target.letter ? ` písm. ${target.letter})` : ""}`;
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
  const insertedRanges = [];
  const provisions = new Map();
  const resolved = [];
  for (const instruction of instructions) {
    const targets = [];
    if (instruction.targets.length === 0) {
      resolved.push({ instructionCz: instruction.textCz, targets: [{ target: null, status: "not-recognised" }] });
      continue;
    }
    for (const target of instruction.targets) {
      const sectionKey = target.section ? `${target.act}#${target.section}` : null;
      const paragraphKey = target.section && target.paragraph ? `${sectionKey}#${target.paragraph}` : null;
      if (target.kind === "inserted") {
        if (target.sectionTo) insertedRanges.push({ act: target.act, from: target.section, to: target.sectionTo });
        else inserted.add(paragraphKey ?? sectionKey);
        targets.push({ target: describeTarget(target), status: "new-provision" });
        continue;
      }
      // A provision this change inserted earlier has no earlier text. It is
      // decided before any later wording is searched, because once the
      // change is in force a later wording holds the change's own text.
      const insertedEarlier = target.sectionTo
        ? insertedRanges.some(({ act, from, to }) => act === target.act && inRange(target.section, from, to) && inRange(target.sectionTo, from, to))
        : sectionKey && (inserted.has(sectionKey) || (paragraphKey && inserted.has(paragraphKey)) || insertedRanges.some(({ act, from, to }) => act === target.act && inRange(target.section, from, to)));
      if (insertedEarlier) {
        targets.push({ target: describeTarget(target), status: "new-provision" });
        continue;
      }
      const located = await locateAtDate(target, date, reader);
      if (!located) {
        targets.push({ target: describeTarget(target), status: "not-found" });
        continue;
      }
      const status = { later: "later-wording", promulgated: "promulgated-wording", unverified: "unverified-later-wording" }[located.source] ?? (located.partial ? "paragraph-not-found" : "found");
      const ids = [];
      for (const root of located.roots) {
        const id = `${target.act}@${located.wording}#${root}`;
        if (!provisions.has(id)) provisions.set(id, { act: target.act, wording: located.wording, ...(located.promulgatedOn ? { promulgatedOn: located.promulgatedOn } : {}), path: root, citation: citationOfPath(root), nodes: nodesUnder(located.paths, [root]) });
        ids.push(id);
      }
      // A § or article from a later or the promulgated wording that lacks the
      // named paragraph, letter, or point keeps the status of where its text
      // is from and is marked as the whole provision.
      const partial = located.partial && located.source !== "current";
      targets.push({ target: describeTarget(target), status, ...(partial ? { partial: true } : {}), wording: located.wording, ...(located.promulgatedOn ? { promulgatedOn: located.promulgatedOn } : {}), provisionIds: ids });
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
        .sort((left, right) => (left.order ?? Infinity) - (right.order ?? Infinity) || left.path.localeCompare(right.path, "en", { numeric: true }))
        .map(({ text }) => text)
        .join("\n");
      delete provision.nodes;
    }
  }
  return {
    conductDate: date,
    amendedAct,
    instructions: resolved,
    provisions: Object.fromEntries([...provisions.entries()].map(([id, { act, wording, promulgatedOn, path, citation, textCz }]) => [id, { act, wording, ...(promulgatedOn ? { promulgatedOn } : {}), path, citation, textCz }]))
  };
}

/**
 * Whether the amendments that took effect in a later wording were promulgated
 * by the date: `in-time` when e-Sbírka names them and each was, `late` when
 * one was promulgated after it (its text was not known then), `unknown` when
 * e-Sbírka names none, or not the promulgation day of one.
 */
async function amendmentsPromulgated(wording, date, reader) {
  if (wording.amendments.length === 0) return "unknown";
  let unknown = false;
  for (const amendment of wording.amendments) {
    const day = await reader.promulgated(amendment);
    if (day === null) unknown = true;
    else if (day > date) return "late";
  }
  return unknown ? "unknown" : "in-time";
}

/**
 * Where a target's wording is taken from (docs/evidence-pipeline.md,
 * Law-change context): the wording on the date; else the nearest later
 * wording made only by amendments promulgated by the date; else, when the
 * nearest later wording that holds it cannot be shown to be (and none on
 * the way is known to be promulgated after the date), the act as it was
 * itself promulgated, when that was by the date and holds it, or that later
 * wording, marked unverified.
 */
async function locateAtDate(target, date, reader) {
  const wordings = await reader.wordings(target.act);
  const current = wordingOn(wordings, date);
  if (current) {
    const paths = await reader.structure(target.act, current.wording);
    const found = locateTarget(paths, target);
    if (found) return { ...found, wording: current.wording, paths, source: "current" };
  }
  const later = wordings.filter(({ from }) => from > date);
  let index = 0;
  let check = null;
  for (; index < later.length; index += 1) {
    check = await amendmentsPromulgated(later[index], date, reader);
    if (check !== "in-time") break;
    const paths = await reader.structure(target.act, later[index].wording);
    const found = locateTarget(paths, target);
    if (found) return { ...found, wording: later[index].wording, paths, source: "later" };
  }
  // The nearest later wording that holds the target, up to the first one
  // known to be promulgated after the date.
  let candidate = null;
  for (let next = index; next < later.length && !candidate; next += 1) {
    if (next > index) check = await amendmentsPromulgated(later[next], date, reader);
    if (check === "late") return null;
    const paths = await reader.structure(target.act, later[next].wording);
    const found = locateTarget(paths, target);
    if (found) candidate = { ...found, wording: later[next].wording, paths, source: "unverified" };
  }
  if (!candidate) return null;
  // A part of the act itself with a later effect was public once the act
  // was promulgated.
  const promulgatedOn = await reader.promulgated(target.act);
  if (promulgatedOn !== null && promulgatedOn <= date) {
    const paths = await reader.structure(target.act, promulgatedWording);
    const found = locateTarget(paths, target);
    if (found) return { ...found, wording: promulgatedWording, paths, source: "promulgated", promulgatedOn };
  }
  return candidate;
}

const statusLabels = {
  found: "found",
  "later-wording": "later wording",
  "promulgated-wording": "as promulgated",
  "unverified-later-wording": "later wording, promulgation not verified",
  "paragraph-not-found": "whole provision",
  "new-provision": "new",
  "not-found": "not found",
  "not-recognised": "not recognised"
};

const contextLegend = "Status of each named provision: found = in the wording on that date; later wording = missing on that date but in a later wording made only by amendments already promulgated on that date, with a later effect; as promulgated = missing on that date, taken from the act as it was itself promulgated before that date, with a later effect, without amendments made since; later wording, promulgation not verified = missing on that date, taken from a later wording whose amendment e-Sbírka does not name or date, so it may not have been known on that date; whole provision = the named paragraph, letter, or point does not exist, so the enclosing provision is supplied; new = inserted by this change, no earlier text; not found = in no wording in e-Sbírka that could be used for that date; not recognised = the instruction names no single provision (a whole part or head, a title, words in the whole act). Never guess the wording of a provision that is not supplied.";

// Where a provision not in the wording on the date was taken from.
function wordingNote(status, wording, promulgatedOn) {
  if (status === "later-wording" || status === "unverified-later-wording") return ` (wording from ${wording})`;
  if (status === "promulgated-wording") return ` (promulgated on ${promulgatedOn})`;
  return "";
}

/**
 * The context of one version as the models read it: the provisions its
 * instructions name, each with its status, and the text of every supplied
 * provision once. The instructions themselves are in the version's text and
 * are not repeated. `supplied` maps a provision already supplied for an
 * earlier version of the same law change (by act, citation, and text) to
 * that version's label, so an identical text is referred to, not repeated.
 */
export function contextText(context, supplied = new Map(), versionLabel = null, omitted = null) {
  if (!context) return null;
  const named = [];
  for (const { instructionCz, targets } of context.instructions) {
    for (const { target, status, partial, wording, promulgatedOn } of targets) {
      const label = target
        ? `${target}: ${statusLabels[status]}${wordingNote(status, wording, promulgatedOn)}${partial ? `, ${statusLabels["paragraph-not-found"]}` : ""}`
        : `not recognised: "${instructionCz.length > 120 ? `${instructionCz.slice(0, 119)}…` : instructionCz}"`;
      if (!named.includes(label)) named.push(label);
    }
  }
  const lines = [
    `Context from the Collection of Laws (e-Sbírka): the provisions this version amends, as in force on ${context.conductDate}, the date of the earliest conduct on it. It is not evidence of conduct. ${contextLegend}`,
    `Named provisions: ${named.join("; ")}.`
  ];
  const left = Object.entries(context.provisions).filter(([id]) => omitted?.has(id));
  if (left.length > 0) {
    lines.push(`Not supplied, because the evidence package is larger than the models can read: the wording of ${left.length} of the ${Object.keys(context.provisions).length} provisions this version's context holds (${left.map(([, { act, citation }]) => `${citation} zákona č. ${act} Sb.`).join("; ")}). Read the amending text without it; never guess their wording.`);
  }
  for (const [id, { act, wording, promulgatedOn, citation, textCz }] of Object.entries(context.provisions)) {
    if (omitted?.has(id)) continue;
    const key = `${act}\n${citation}\n${textCz}`;
    const heading = `${citation} zákona č. ${act} Sb. (${wording === promulgatedWording ? `as promulgated on ${promulgatedOn}` : `wording from ${wording}`})`;
    if (supplied.has(key)) {
      lines.push(`${heading}: the same text as supplied for the ${supplied.get(key)}.`);
      continue;
    }
    if (versionLabel) supplied.set(key, versionLabel);
    lines.push(`${heading}:\n${textCz || "(no text in e-Sbírka)"}`);
  }
  return lines.join("\n");
}

/**
 * A law change whose versions carry the context text the models read
 * (`contextCz`), so screening, relevance checks, and the evidence package,
 * and their input hashes, all include it. A provision with the same text as
 * for an earlier version is supplied once. `omitted` maps a version to the
 * IDs of the provisions left out of an evidence package that would otherwise
 * be larger than the models can read (docs/evidence-pipeline.md, Package);
 * the context names them as not supplied.
 */
export function withContext(change, context, omitted = null) {
  const versions = {};
  const supplied = new Map();
  for (const version of versionKeys) {
    const entry = change.versions[version];
    if (!entry) continue;
    const text = contextText(context.versions[version], supplied, versionLabels[version], omitted?.get(version) ?? null);
    versions[version] = text ? { ...entry, contextCz: text } : entry;
  }
  return { ...change, versions };
}

/**
 * The public e-Sbírka page of a provision's wording, scrolled to the
 * provision: the wording's page with the node path from its § as the anchor
 * (`#par_166-odst_1`, checked on 4 October 2026). A provision outside the §§
 * (an article or an annex) links to the top of the wording.
 */
export function eSbirkaProvisionUrl({ act, wording, path }) {
  const [number, year] = act.split("/");
  const segments = path.split("/");
  const section = path.includes("prilohy") ? -1 : segments.findIndex((segment) => segment.startsWith("par_"));
  return `https://e-sbirka.gov.cz/sb/${year}/${number}/${wording}${section >= 0 ? `#${segments.slice(section).join("-")}` : ""}`;
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
