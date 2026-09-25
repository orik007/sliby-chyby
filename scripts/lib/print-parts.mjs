import { cleanText, invariant } from "./collector-core.mjs";

/**
 * Splits a Chamber print's official texts into law changes, the unit the
 * pipeline screens, routes, packages, and assesses
 * (docs/evidence-pipeline.md, Chamber data rules).
 */
// A state budget (druh_tisku 3) amends no act; its direct identifier is the
// print kind itself.
export const stateBudgetIdentifier = "cz-print-kind-state-budget";

// The labelled section of a print page whose DOCX file is the proposal text:
// the bill (or state budget) with its explanatory memorandum, or the text of
// a treaty or another print. Other sections (RIA, the consolidated text with
// marked changes, EU compatibility, annexes) are never read.
const proposalSectionLabels = [
  /^Návrh zákona včetně důvodové zprávy$/i,
  /^Návrh, důvodová zpráva, obsah zákona$/i,
  /^Text v českém jazyce$/i,
  /^Text$/i
];

export function actIdentifier(act) {
  const match = /^(\d+)\/(\d{4})$/.exec(act);
  invariant(match, `Invalid act reference: ${act}`);
  return `cz-act-${match[1]}-${match[2]}`;
}

function sortedActs(acts) {
  return [...new Set(acts)].sort((left, right) => {
    const [leftNumber, leftYear] = left.split("/").map(Number);
    const [rightNumber, rightYear] = right.split("/").map(Number);
    return leftYear - rightYear || leftNumber - rightNumber;
  });
}

// The official name that follows an act reference ("…Sb., o pravidlech
// rozpočtové odpovědnosti, ve znění…"), up to the amendment history.
function actName(rest) {
  const text = String(rest ?? "").replace(/^[\s,]+/, "");
  // An amending act's own name begins "kterým se mění …"; elsewhere
  // "… se mění" ends the name.
  const end = /^kterým\s+se\b/.test(text)
    ? /,\s*ve\s+znění|,?\s+a\s+kterým\s+se|;|:/
    : /,\s*ve\s+znění|,?\s+se\s+(?:mění|doplňuje)|,?\s+a\s+kterým\s+se|\s+a\s+(?:další|o\s+změně)|\s*\(|;|:/;
  const name = text
    .split(end)[0]
    .replace(/(?:[\s,]+a)?[\s,]+$/, "")
    .trim();
  return name.length > 0 ? name.slice(0, 200) : null;
}

function uniqueNamedActs(namedActs) {
  const byAct = new Map();
  for (const { act, name } of namedActs) {
    if (!byAct.has(act) || (!byAct.get(act) && name)) byAct.set(act, name ?? null);
  }
  return sortedActs([...byAct.keys()]).map((act) => ({ act, name: byAct.get(act) }));
}

const titleReferencePattern = /(\S+)(?:\s+České\s+národní\s+rady)?\s+č\.\s*(\d+)\/(\d{4})\s*Sb\./g;

/**
 * Acts an official print title amends or repeals, with their official names.
 * A title lists them as "zákon č. X/YYYY Sb., <name>, ve znění …" joined by
 * commas and "a", or as "o změně zákona č. X/YYYY Sb." A reference inside
 * another act's name ("o změně a doplnění zákona č. …", "kterým se mění
 * zákon č. …") or its amendment history ("ve znění zákona č. …") is not an
 * act the print amends.
 */
export function namedActsFromPrintTitle(title) {
  const text = String(title ?? "");
  const references = [...text.matchAll(titleReferencePattern)];
  const amended = [];
  let previousEnd = null;
  for (const match of references) {
    const between = previousEnd === null ? "" : text.slice(previousEnd, match.index);
    const previousNameEnded = previousEnd === null || /ve\s+znění/.test(between);
    const amendedInList = /^zákon$/i.test(match[1]) && !/kterým\s+se\s+mění/.test(between);
    const amendedByChange = /^zákona$/i.test(match[1]) && /o\s+změně\s+$/.test(text.slice(0, match.index)) && previousNameEnded;
    if (!amendedInList && !amendedByChange) continue;
    amended.push(match);
    previousEnd = match.index + match[0].length;
  }
  // An act's name runs to the next amended act.
  return uniqueNamedActs(amended.map((match, index) => ({
    act: `${match[2]}/${match[3]}`,
    name: actName(text.slice(match.index + match[0].length, amended[index + 1]?.index ?? text.length))
  })));
}

const amendingVerbPattern = /(?:mění|doplňuj\p{L}*|vklád\p{L}*|nahrazuj\p{L}*|zrušuj\p{L}*|zní:)/u;
const actReferencePattern = /zákon(?:a|ě|u)?\s+č\.\s*(\d+)\/(\d{4})\s*Sb\.,?/iu;

/**
 * The act one law change amends: the first act reference in its first
 * amending sentence, the first paragraph that names an act ("Zákon č.
 * X/YYYY Sb., …", "V § … zákona č. X/YYYY Sb., …", "Příloha k zákonu č. …")
 * and states an amendment ("mění", "doplňuje", "vkládá", "nahrazuje",
 * "zrušuje", "zní:"). A part that only creates new provisions has none.
 */
export function amendedActOfPart(paragraphs) {
  for (const paragraph of paragraphs) {
    const match = actReferencePattern.exec(paragraph);
    if (!match || !amendingVerbPattern.test(paragraph)) continue;
    return { act: `${match[1]}/${match[2]}`, name: actName(paragraph.slice(match.index + match[0].length)) };
  }
  return null;
}

/**
 * The proposal-text DOCX of a print page: the first DOCX file listed under
 * one of the proposal sections. Returns null when the page has none (for
 * example, only a legacy .doc file).
 */
export function proposalDocumentLink(html, pageUrl) {
  const files = String(html).split("Soubory sněmovního tisku")[1]?.split("</table>")[0] ?? "";
  let section = null;
  const pattern = /<th\b[^>]*>([\s\S]*?)<\/th>|<a\b[^>]*href=["']([^"']*orig2\.sqw[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
  for (const match of files.matchAll(pattern)) {
    if (match[1] !== undefined) {
      section = cleanText(match[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " "), 200);
      continue;
    }
    const filename = cleanText(match[3], 200);
    if (!section || !/\.docx$/i.test(filename) || !proposalSectionLabels.some((label) => label.test(section))) continue;
    return { filename, url: pspUrl(match[2], pageUrl), sectionLabel: section };
  }
  return null;
}

// "ČÁST PRVNÍ", "ČÁST DVACÁTÁ TŘETÍ", "Část druhá": one or two ordinal
// words, which end in -á or -í.
const partHeadingPattern = /^ČÁST\s+\p{L}+[áí](?:\s+\p{L}+[áí])?$/iu;
const memorandumHeadingPattern = /^důvodová\s+zpráva$/iu;

/**
 * A proposal text without its explanatory memorandum: the text ends at the
 * heading "Důvodová zpráva".
 */
export function proposalBody(paragraphs) {
  invariant(Array.isArray(paragraphs) && paragraphs.length > 0, "A proposal text needs paragraphs");
  const memorandumAt = paragraphs.findIndex((paragraph) => memorandumHeadingPattern.test(paragraph.trim()));
  return memorandumAt > 0 ? paragraphs.slice(0, memorandumAt) : paragraphs;
}

/**
 * Divides a proposal text into its parts. Each "ČÁST …" heading starts a
 * part whose title is the next paragraph; a text without part headings is
 * one part.
 */
export function splitProposalText(paragraphs) {
  const body = proposalBody(paragraphs);
  const starts = body.map((paragraph, index) => (partHeadingPattern.test(paragraph.trim()) ? index : -1)).filter((index) => index >= 0);
  if (starts.length === 0) return [{ heading: null, titleCz: null, paragraphs: body }];
  return starts.map((start, index) => ({
    heading: body[start].trim(),
    titleCz: body[start + 1]?.trim() ?? null,
    paragraphs: body.slice(start, starts[index + 1] ?? body.length)
  }));
}

// The texts of a bill as the Chamber debates it (docs/evidence-pipeline.md,
// Versions of a law change): proposed, approved by the Chamber in the third
// reading, and passed by Parliament after a Senate or presidential return.
export const versionKeys = ["proposed", "approved", "passed"];

// Short English names of the versions, for model briefs and summaries.
export const versionLabels = { proposed: "proposed text", approved: "text approved by the Chamber", passed: "text passed by Parliament" };

// An absolute psp.cz URL from an href on a psp.cz page.
function pspUrl(href, pageUrl) {
  const url = new URL(href.replace(/&amp;/g, "&"), pageUrl);
  invariant(url.protocol === "https:" && url.hostname === "www.psp.cz", `Official print document redirected outside the PSP allowlist: ${url}`);
  return url.href;
}

/**
 * Links to a bill's later texts on its history page: "Text návrhu zákona
 * schváleného Poslaneckou sněmovnou" (approved, a text page with `v=PZ`) and
 * "… přijatého Parlamentem České republiky" (passed, `v=SZ`). They are not
 * in the open data, so any link to such a text page is read.
 */
export function laterTextLinks(historyHtml, pageUrl) {
  const links = { approved: null, passed: null };
  for (const match of String(historyHtml).matchAll(/href="([^"]*tiskt\.sqw\?[^"]*)"/g)) {
    const kind = /[?&](?:amp;)?v=(PZ|SZ)(?:&|$)/.exec(match[1])?.[1];
    if (kind) links[kind === "PZ" ? "approved" : "passed"] ??= pspUrl(match[1], pageUrl);
  }
  return links;
}

/**
 * The DOCX file ("Originál dokumentu") of a later-text page.
 */
export function laterTextDocxLink(html, pageUrl) {
  const match = /<li class="docx">\s*<a href="([^"]*orig2\.sqw[^"]*)"/.exec(String(html));
  return match ? pspUrl(match[1], pageUrl) : null;
}

function normalizedTitle(title) {
  return String(title ?? "").normalize("NFC").toLocaleLowerCase("cs-CZ").replace(/\s+/g, " ").trim();
}

// The key that identifies a part across versions: the act it amends or,
// when it amends no act, its title.
function partKey(part, amended) {
  if (amended) return `act:${amended.act}`;
  return part.heading === null ? "whole" : `title:${normalizedTitle(part.titleCz)}`;
}

function partWords(paragraphs) {
  // Numbers count whatever their length: an amount or a rate is often the
  // only difference between two parts.
  return new Set(paragraphs.slice(1).join(" ").toLocaleLowerCase("cs-CZ").match(/\p{L}{3,}|\p{N}+/gu) ?? []);
}

function textSimilarity(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function textContainment(part, whole) {
  if (part.size === 0) return 0;
  let shared = 0;
  for (const word of part) if (whole.has(word)) shared += 1;
  return shared / part.size;
}

// A later part whose text is at least this similar to an earlier part is
// the same law change even when its key differs (a retitled part, or a
// proposal without parts that the debate divided into parts).
const minimumPartSimilarity = 0.3;

/**
 * Pairs each part of a later text with at most one existing law change: an
 * equal key counts most, and among equal keys (two parts amending the same
 * act) the more similar text decides. Returns the matched change for each
 * part, or null for a part added in this text.
 */
function matchParts(entries, changes) {
  const scored = [];
  for (const [entryIndex, entry] of entries.entries()) {
    for (const change of changes) {
      // A proposal without parts contains every part the debate divided it
      // into, so a part is compared by how much of it the whole contains.
      const similarity = change.key === "whole" && entry.key !== "whole" ? textContainment(entry.words, change.words) : textSimilarity(entry.words, change.words);
      const score = (entry.key === change.key ? 1 : 0) + similarity;
      if (entry.key === change.key || similarity >= minimumPartSimilarity) scored.push({ entryIndex, change, score });
    }
  }
  scored.sort((left, right) => right.score - left.score);
  const matched = new Array(entries.length).fill(null);
  const taken = new Set();
  for (const { entryIndex, change, score } of scored) {
    if (matched[entryIndex] || taken.has(change) || score <= 0) continue;
    matched[entryIndex] = change;
    taken.add(change);
  }
  return matched;
}

/**
 * A version's own entry, or, for a version stored as the same as an earlier
 * one (`sameAs`), the earlier entry that holds the text. The `sameAs` entry
 * keeps its own heading, title, and document.
 */
function resolvedVersion(change, version) {
  const entry = change.versions[version];
  return entry?.sameAs ? change.versions[entry.sameAs] : entry;
}

// A part's text without its heading line, which renumbering changes.
function bodyOf(textCz) {
  return textCz === null ? null : textCz.split("\n").slice(1).join("\n");
}

// The latest version of a change that has not removed it.
function latestTextVersion(change) {
  return [...versionKeys].reverse().find((version) => change.versions[version] && !change.versions[version].removed) ?? null;
}

function versionOf(part, document) {
  return {
    heading: part.heading,
    titleCz: part.titleCz,
    textCz: part.paragraphs ? part.paragraphs.join("\n") : null,
    document: document ? { filename: document.filename, url: document.url } : null
  };
}

/**
 * The law changes of one print with their versions. `texts` maps a version
 * key to `{ document, paragraphs }` for each text psp.cz publishes; without
 * a proposal text, the proposed version of each part carries only the print
 * title, and the parts come from the first later text. A part
 * of a later text is matched to an earlier law change by the act it amends,
 * its title, and the similarity of its text (matchParts); a part without a
 * match is a law change added during the debate, and a law change missing
 * from a later text is marked `removed` in that version. A print that is a
 * single change also takes its title's acts.
 */
export function lawChangesOfPrint({ print, texts = {}, senateResolutions = [] }) {
  const changes = [];
  // Without a proposal text, the proposed version of every part is known
  // only by the print title; the parts come from the first later text.
  const proposalUnknown = !texts.proposed;
  const firstText = versionKeys.find((version) => texts[version]);
  for (const version of versionKeys) {
    const text = texts[version] ?? null;
    if (!text && !(version === "proposed" && !firstText)) continue;
    const parts = text ? splitProposalText(text.paragraphs) : [{ heading: null, titleCz: null, paragraphs: null }];
    const entries = parts.map((part) => {
      const amended = part.paragraphs ? amendedActOfPart(part.paragraphs) : null;
      return { part, amended, key: partKey(part, amended), words: part.paragraphs ? partWords(part.paragraphs) : new Set() };
    });
    const matched = matchParts(entries, changes);
    for (const [position, entry] of entries.entries()) {
      let change = matched[position];
      if (!change) {
        const fromFirstText = proposalUnknown && version === firstText;
        change = {
          fromFirstText: version === (firstText ?? "proposed"),
          changeId: version === "proposed" || fromFirstText ? `${print.printId}-${position + 1}` : `${print.printId}-${version}-${position + 1}`,
          printId: print.printId,
          printNumber: print.number,
          printKindId: print.kindId,
          printTitleCz: print.title,
          printPageUrl: print.pageUrl,
          addedIn: fromFirstText ? "proposed" : version,
          amendedActs: [],
          versions: fromFirstText ? { proposed: { heading: null, titleCz: print.title, textCz: null, document: null } } : {}
        };
        changes.push(change);
      }
      // A matched change is compared with its latest text in the next version.
      change.key = entry.key;
      change.words = entry.words;
      if (entry.amended) change.amendedActs.push(entry.amended);
      const entryVersion = versionOf({ ...entry.part, titleCz: entry.part.titleCz ?? print.title }, text?.document ?? null);
      // A version whose text equals the latest earlier text is stored as the
      // same, so models do not read (and pay for) the text twice.
      const previous = latestTextVersion(change);
      change.versions[version] = previous && entryVersion.textCz !== null && bodyOf(resolvedVersion(change, previous).textCz) === bodyOf(entryVersion.textCz)
        ? { sameAs: change.versions[previous].sameAs ?? previous, heading: entryVersion.heading, titleCz: entryVersion.titleCz, document: entryVersion.document }
        : entryVersion;
    }
    // A part of an earlier version that this text no longer has was removed.
    for (const change of changes) {
      if (!change.versions[version]) change.versions[version] = { removed: true };
    }
  }
  // Only a print whose first text is one part takes the title's acts.
  const single = changes.filter((change) => change.fromFirstText).length === 1;
  const resolutions = senateResolutions.map(({ partNumber, document, paragraphs }) => ({
    partNumber,
    document: { filename: document.filename, url: document.url },
    textCz: paragraphs.join("\n")
  }));
  return changes.map((change) => {
    const acts = uniqueNamedActs([...change.amendedActs, ...(single && change.fromFirstText ? namedActsFromPrintTitle(print.title) : [])]);
    const identifiers = acts.map(({ act }) => actIdentifier(act));
    if (print.kindId === "3") identifiers.push(stateBudgetIdentifier);
    // A version keeps its own heading even when its text is stored as the
    // same as an earlier one: renumbering changes only the heading.
    const latest = change.versions[latestTextVersion(change)];
    const { amendedActs, key, words, fromFirstText, ...rest } = change;
    return { ...rest, heading: latest.heading, titleCz: latest.titleCz, acts, identifiers, senateResolutions: resolutions };
  });
}
