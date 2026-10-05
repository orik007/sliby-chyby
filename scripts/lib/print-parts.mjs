import { cleanText, invariant } from "./collector-core.mjs";

/**
 * Splits a Chamber print's official texts into law changes, the unit the
 * pipeline screens, routes, packages, and assesses
 * (docs/evidence-pipeline.md, Chamber data rules).
 */
// A state budget (druh_tisku 3) amends no act; its direct identifier is the
// print kind itself.
export const stateBudgetIdentifier = "cz-print-kind-state-budget";

// The labelled section of a print page whose Word file is the proposal text:
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
 * The proposal-text Word file of a print page: the first DOCX file listed
 * under one of the proposal sections or, when there is none, the first
 * Word 97-2003 (.doc) file there. Returns null when the page has neither
 * (for example, only a PDF, which is never read).
 */
export function proposalDocumentLink(html, pageUrl) {
  const files = String(html).split("Soubory sněmovního tisku")[1]?.split("</table>")[0] ?? "";
  let section = null;
  const found = { docx: null, doc: null };
  const pattern = /<th\b[^>]*>([\s\S]*?)<\/th>|<a\b[^>]*href=["']([^"']*orig2\.sqw[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
  for (const match of files.matchAll(pattern)) {
    if (match[1] !== undefined) {
      section = cleanText(match[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " "), 200);
      continue;
    }
    const filename = cleanText(match[3], 200);
    const format = /\.(docx?)$/i.exec(filename)?.[1].toLowerCase();
    if (!section || !format || found[format] || !proposalSectionLabels.some((label) => label.test(section))) continue;
    found[format] = { filename, url: pspUrl(match[2], pageUrl), sectionLabel: section, format };
  }
  return found.docx ?? found.doc;
}

// "ČÁST PRVNÍ", "ČÁST DVACÁTÁ TŘETÍ", "ČÁST STO DVACÁTÁ PRVNÍ", "Část
// druhá": one or two ordinal words ending in -á or -í, after 100 preceded by
// "sto".
const partHeadingPattern = /^ČÁST\s+(?:STO\s+)?\p{L}+[áí](?:\s+\p{L}+[áí])?$/iu;
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

// Print kinds divided into parts (docs/evidence-pipeline.md, Law changes).
const partedPrintKindIds = new Set(["1", "2"]);

// The part of a bill that states when it takes effect ("ČÁST … ÚČINNOST").
// It is not a law change; its text belongs to every law change of the same
// text (docs/evidence-pipeline.md, Effective date).
const effectivePartTitlePattern = /^účinnost$/iu;

function isEffectivePart(part) {
  return part.heading !== null && effectivePartTitlePattern.test(String(part.titleCz ?? "").trim());
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
 * in the open data, so any link to such a text page is read. A bill whose
 * approved text has no such page (one the Senate rejected) links the print
 * holding the text "ve znění, ve kterém byl postoupen Senátu"
 * (`referredToSenate`).
 */
export function laterTextLinks(historyHtml, pageUrl) {
  const links = { approved: null, passed: null, referredToSenate: null };
  for (const match of String(historyHtml).matchAll(/href="([^"]*tiskt\.sqw\?[^"]*)"/g)) {
    const kind = /[?&](?:amp;)?v=(PZ|SZ)(?:&|$)/.exec(match[1])?.[1];
    if (kind) links[kind === "PZ" ? "approved" : "passed"] ??= pspUrl(match[1], pageUrl);
  }
  // "Návrh zákona ve znění, ve kterém byl postoupen Senátu rozeslán … jako
  // tisk 163/2": the approved text as a sub-print of the bill.
  // The link must follow "jako tisk" within the same entry, which ends at
  // a line break or the end of the paragraph.
  const referred = /ve\s+znění,\s+ve\s+kterém\s+byl\s+postoupen\s+Senátu(?:(?!<br\b|<\/p\b|<\/li\b)[\s\S])*?jako\s+tisk\s*(?:<(?!a\b|br\b|\/p\b)[^>]*>\s*)*<a\s+href="([^"]*tiskt\.sqw\?[^"]*)"/i.exec(String(historyHtml));
  if (referred) links.referredToSenate = pspUrl(referred[1], pageUrl);
  return links;
}

/**
 * The DOCX file ("Originál dokumentu") of a later-text page.
 */
export function laterTextDocxLink(html, pageUrl) {
  const match = /<li class="docx">\s*<a href="([^"]*orig2\.sqw[^"]*)"/.exec(String(html));
  return match ? pspUrl(match[1], pageUrl) : null;
}

/**
 * The act a bill became, from the line that ends its history page: “Zákon
 * vyhlášen 28. 8. 2026 ve Sbírce zákonů v částce 155 pod číslem 155/2026
 * Sb.” Returns `{ act, promulgatedOn }` (“155/2026”, ISO date), or null for a
 * bill that was not promulgated.
 */
export function promulgatedActOfHistory(historyHtml) {
  const text = String(historyHtml).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const match = /Zákon vyhlášen (\d{1,2})\. ?(\d{1,2})\. ?(\d{4}) ve Sbírce zákonů v částce \d+ pod číslem (\d+)\/(\d{4}) Sb\./u.exec(text);
  if (!match) return null;
  const [, day, month, year, number, actYear] = match;
  return { act: `${number}/${actYear}`, promulgatedOn: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` };
}

/** The act as it was promulgated, in e-Sbírka. */
export function promulgatedTextUrl(act) {
  const [number, year] = act.split("/");
  return `https://e-sbirka.gov.cz/sb/${year}/${number}/0000-00-00`;
}

/**
 * The version of a bill whose text is the act as it was promulgated, when
 * psp.cz does not publish that version and a decisive vote concerned it
 * (docs/evidence-pipeline.md, Text from the Collection of Laws), or null.
 * `concerned` lists what versionConcerned returned for the bill's votes. The
 * promulgated act is the
 * text passed by Parliament; it is the approved text only when nothing came
 * after the approval that could change it: no Senate return and no passed
 * text listed. A vote on the passed text that is the approved text, which
 * psp.cz publishes (`sameAsApproved`), needs none.
 */
export function promulgatedTextVersion({ texts, concerned, promulgation, senateReturned, passedListed }) {
  if (!promulgation) return null;
  if (!texts.passed && concerned.some(({ version, sameAsApproved }) => version === "passed" && !(sameAsApproved && texts.approved))) return "passed";
  if (!texts.approved && !senateReturned && !passedListed && concerned.some(({ version }) => version === "approved")) return "approved";
  return null;
}

/**
 * The paragraphs of an act as promulgated, from its e-Sbírka nodes in
 * document order (`[path, text]`): every node with text but the act's
 * number at the top, the signatures (`dokument/postfix`), and the act's own
 * annexes (`dokument/prilohy`), in the order of a psp.cz text. e-Sbírka's
 * text of a table runs its cells together, so an annex of figures (a state
 * budget's) would read as wrong numbers; the proposal text of the 2026
 * state budget (print 94) holds no annex either. An annex an amending act
 * replaces is inside its part and kept. Null when e-Sbírka holds no body of
 * the act, only its heading or a notice that the act is still being
 * digitised.
 */
export function promulgatedParagraphs(nodes, act) {
  const number = act.split("/")[0];
  const kept = nodes.filter(([path, text]) => text !== null && !/^dokument\/(?:postfix|prilohy)(?:\/|$)/.test(path) && !(path.startsWith("dokument/prefix/") && text.trim() === number));
  if (!kept.some(([path]) => !path.startsWith("dokument/prefix/"))) return null;
  return kept.map(([, text]) => text);
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

// The text of a version without its part heading, which renumbering changes;
// a text without a part heading is compared whole.
function bodyOf({ heading, textCz }) {
  if (textCz === null) return null;
  return heading ? textCz.split("\n").slice(1).join("\n") : textCz;
}

// The latest version of a change that has not removed it.
function latestTextVersion(change) {
  return [...versionKeys].reverse().find((version) => change.versions[version] && !change.versions[version].removed) ?? null;
}

// A version whose text is the act as promulgated names that act
// (`promulgatedAct`); no other version has the field.
function versionOf(part, amendedAct, document, effectiveCz = null, promulgatedAct = null) {
  return {
    heading: part.heading,
    titleCz: part.titleCz,
    textCz: part.paragraphs ? part.paragraphs.join("\n") : null,
    amendedAct,
    effectiveCz,
    document: document ? { filename: document.filename, url: document.url } : null,
    ...(promulgatedAct ? { promulgatedAct } : {})
  };
}

/**
 * The law changes of one print with their versions. `texts` maps a version
 * key to `{ document, paragraphs }` for each text psp.cz publishes, and to
 * `{ document, paragraphs, promulgatedAct }` for a version whose text is the
 * act as promulgated (promulgatedTextVersion); without
 * a proposal text, the proposed version of each part carries only the print
 * title, and the parts come from the first later text. A part
 * of a later text is matched to an earlier law change by the act it amends,
 * its title, and the similarity of its text (matchParts); a part without a
 * match is a law change added during the debate, and a law change missing
 * from a later text is marked `removed` in that version. A part titled
 * "Účinnost" is not a law change: its text is each version's `effectiveCz`.
 * A print that is a single change also takes its title's acts.
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
    const parts = !text
      ? [{ heading: null, titleCz: null, paragraphs: null }]
      : partedPrintKindIds.has(String(print.kindId)) ? splitProposalText(text.paragraphs) : [{ heading: null, titleCz: null, paragraphs: proposalBody(text.paragraphs) }];
    // The effective-date text of this version, without the part heading and
    // title; null when the text has no effective-date part.
    const effectiveParts = parts.filter(isEffectivePart);
    const effectiveCz = effectiveParts.length > 0 ? effectiveParts.map((part) => part.paragraphs.slice(2).join("\n")).join("\n") : null;
    // A part keeps its position in the text, so its change ID does not
    // depend on whether an effective-date part precedes it.
    const entries = parts.map((part, position) => ({ part, position })).filter(({ part }) => !isEffectivePart(part)).map(({ part, position }) => {
      const amended = part.paragraphs ? amendedActOfPart(part.paragraphs) : null;
      return { part, position, amended, key: partKey(part, amended), words: part.paragraphs ? partWords(part.paragraphs) : new Set() };
    });
    const matched = matchParts(entries, changes);
    for (const [index, entry] of entries.entries()) {
      const { position } = entry;
      let change = matched[index];
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
          versions: fromFirstText ? { proposed: { heading: null, titleCz: print.title, textCz: null, amendedAct: null, effectiveCz: null, document: null } } : {}
        };
        changes.push(change);
      }
      // A matched change is compared with its latest text in the next version.
      change.key = entry.key;
      change.words = entry.words;
      const entryVersion = versionOf({ ...entry.part, titleCz: entry.part.titleCz ?? print.title }, entry.amended, text?.document ?? null, effectiveCz, text?.promulgatedAct ?? null);
      // A version whose text equals the latest earlier text is stored as the
      // same, so models do not read (and pay for) the text twice. The
      // effective date is the version's own.
      const previous = latestTextVersion(change);
      change.versions[version] = previous && entryVersion.textCz !== null && bodyOf(resolvedVersion(change, previous)) === bodyOf(entryVersion)
        ? { sameAs: change.versions[previous].sameAs ?? previous, heading: entryVersion.heading, titleCz: entryVersion.titleCz, amendedAct: entryVersion.amendedAct, effectiveCz, document: entryVersion.document, ...(entryVersion.promulgatedAct ? { promulgatedAct: entryVersion.promulgatedAct } : {}) }
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
    const { key, words, fromFirstText, ...rest } = change;
    return withDerivedFields({ ...rest, titleActs: single && fromFirstText ? namedActsFromPrintTitle(print.title) : [], senateResolutions: resolutions });
  });
}

// The acts, legal identifiers, heading, and title of a law change, derived
// from its versions: the acts its versions amend and, for a print that is a
// single change, the acts of the print title. The heading and title are those
// of the latest version that has not removed it; a version keeps its own
// heading even when its text is stored as the same as an earlier one.
function withDerivedFields(change) {
  const acts = uniqueNamedActs([...Object.values(change.versions).map(({ amendedAct }) => amendedAct).filter(Boolean), ...change.titleActs]);
  const identifiers = acts.map(({ act }) => actIdentifier(act));
  if (change.printKindId === "3") identifiers.push(stateBudgetIdentifier);
  const latest = change.versions[latestTextVersion(change)];
  return { ...change, heading: latest.heading, titleCz: latest.titleCz, acts, identifiers };
}

/**
 * A law change with only its versions up to `lastVersion`, and the acts,
 * identifiers, heading, and title those versions give, or null when the change
 * did not yet exist in that version (docs/evidence-pipeline.md, Conduct and
 * version).
 */
export function changeThroughVersion(change, lastVersion) {
  const kept = versionKeys.slice(0, versionKeys.indexOf(lastVersion) + 1).filter((version) => change.versions[version]);
  if (kept.length === 0) return null;
  return withDerivedFields({ ...change, versions: Object.fromEntries(kept.map((version) => [version, change.versions[version]])) });
}

/**
 * The version of one law change a conduct concerns. When psp.cz does not
 * publish that version, the latest earlier version is used and
 * `publishedVersionMissing` names the one the conduct concerned. Returns
 * null when the law change did not yet exist in the text the conduct
 * concerned (a change added in the debate is never part of the submission).
 */
export function versionOfChange(change, concerned) {
  if (!concerned) return null;
  const position = versionKeys.indexOf(concerned.version);
  for (let index = position; index >= 0; index -= 1) {
    const version = versionKeys[index];
    const entry = change.versions[version];
    if (!entry) continue;
    return {
      version,
      removed: entry.removed === true,
      publishedVersionMissing: version === concerned.version || (concerned.sameAsApproved && version === "approved") ? null : concerned.version,
      withSenateResolution: concerned.withSenateResolution,
      mark: concerned.mark
    };
  }
  return null;
}
