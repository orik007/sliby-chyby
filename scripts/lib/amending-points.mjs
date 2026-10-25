/**
 * The groups of a long amending part's points by the sections they amend
 * (docs/evidence-pipeline.md, Chamber data rules, Law changes), and the
 * matching of an amendment to them (Amendment data rules, Which part). The
 * points are read with their Word list numbers (extractDocxNumberedParagraphs).
 */

export const dividedPartMinLength = 60_000;
export const sectionGroupMaxLength = 20_000;

const pointLabelPattern = /^(\d+)\.$/u;
// A point is an instruction ("V § 1 …", "Za § 4 …"); an item of a list in the
// quoted wording of a provision ("1. záměrů EIA,") starts in lower case.
const pointTextPattern = /^[\p{Lu}§]/u;
// "§ 144a", "§ 1 se", "§ 10, 12 a 30", "§ 10 až 30", "§§ 5 až 7".
const sectionNumber = "(\\d+)([a-z]{0,2})(?!\\p{L})";
const sectionPattern = new RegExp(`§{1,2}\\s*${sectionNumber}((?:\\s*(?:,|a|nebo|až|–|-)\\s*\\d+[a-z]{0,2}(?!\\p{L}))*)`, "gu");
const sectionContinuationPattern = new RegExp(`\\s*(,|a|nebo|až|–|-)\\s*${sectionNumber}`, "gu");
// "V příloze č. 1 …", "Příloha č. 3 zní:".
const annexPointPattern = /^(?:V\s+)?[Pp]řílo[hz]/u;
const articleHeadingPattern = /^Čl\.\s+[IVXLC]+[a-z]?$/u;

// Annexes follow the last section of an act.
export const annexSectionKey = 1e9;

// A section's place in the act: its number, then its letters ("1a" after "1").
function sectionKeyOf(number, letters) {
  const letterValue = [...letters].reduce((value, letter) => value * 27 + (letter.charCodeAt(0) - 96), 0);
  return Number(number) * 1000 + letterValue;
}

// A section as a group's name gives it, after "body k".
function sectionLabel(key) {
  if (key === annexSectionKey) return "přílohám";
  let value = key % 1000;
  let letters = "";
  while (value > 0) {
    letters = String.fromCharCode(96 + (value % 27)) + letters;
    value = Math.floor(value / 27);
  }
  return `§ ${Math.floor(key / 1000)}${letters}`;
}

/**
 * The sections a text names, as ranges of section keys `[from, to]`: one
 * section is a range of itself, and a range ("§ 10 až 30") holds every
 * section between.
 */
export function sectionRangesNamed(text) {
  const ranges = [];
  for (const [, number, letters, continuation] of text.matchAll(sectionPattern)) {
    const first = sectionKeyOf(number, letters);
    ranges.push([first, first]);
    for (const [, joint, nextNumber, nextLetters] of continuation.matchAll(sectionContinuationPattern)) {
      const key = sectionKeyOf(nextNumber, nextLetters);
      if (joint === "až" || joint === "–" || joint === "-") ranges.at(-1)[1] = key;
      else ranges.push([key, key]);
    }
  }
  return ranges;
}

function pointSection(paragraph) {
  if (annexPointPattern.test(paragraph)) return annexSectionKey;
  return sectionRangesNamed(paragraph)[0]?.[0] ?? null;
}

/**
 * An amending part's text, `paragraphs` with their Word list `labels`, as
 * its opening paragraphs, its points (each with its number, its section,
 * and its paragraphs, the first prefixed with its number), and the rest from
 * the part's next article on; null with fewer than two points.
 */
export function amendingPoints(paragraphs, labels) {
  const starts = [];
  let end = paragraphs.length;
  for (const [index, paragraph] of paragraphs.entries()) {
    if (starts.length > 0 && articleHeadingPattern.test(paragraph.trim())) {
      end = index;
      break;
    }
    const match = pointLabelPattern.exec(labels[index] ?? "");
    if (match && Number(match[1]) === starts.length + 1 && pointTextPattern.test(paragraph)) starts.push(index);
  }
  if (starts.length < 2) return null;
  let section = null;
  const points = starts.map((start, index) => {
    const pointParagraphs = paragraphs.slice(start, starts[index + 1] ?? end);
    section = pointSection(pointParagraphs[0]) ?? section;
    return { number: index + 1, section, paragraphs: [`${index + 1}. ${pointParagraphs[0]}`, ...pointParagraphs.slice(1)] };
  });
  return { opening: paragraphs.slice(0, starts[0]), points, rest: paragraphs.slice(end) };
}

const textLength = (paragraphs) => paragraphs.reduce((sum, paragraph) => sum + paragraph.length + 1, 0);
const bySection = (left, right) => (left ?? -1) - (right ?? -1);

/**
 * The groups of an amending part from the text of each of its versions,
 * `{ [version]: { paragraphs, labels } }` in version order. The groups'
 * sections are bounded by the points of the first version, so they do not
 * change when a later version is published. Each group is `{ section: {
 * labelCz, from, to, rest, restArticles }, versions: { [version]: paragraphs
 * } }`, with only the versions that have points in it. Null when a version
 * has no numbered points or the part forms one group.
 */
export function sectionGroups(versionTexts, maxLength = sectionGroupMaxLength) {
  const read = Object.entries(versionTexts).map(([version, { paragraphs, labels }]) => ({ version, ...(labels ? amendingPoints(paragraphs, labels) : { points: null }) }));
  if (read.length === 0 || read.some(({ points }) => !points)) return null;
  const lengthBySection = new Map();
  for (const point of read[0].points) lengthBySection.set(point.section, (lengthBySection.get(point.section) ?? 0) + textLength(point.paragraphs));
  const starts = [];
  let length = 0;
  for (const section of [...lengthBySection.keys()].sort(bySection)) {
    if (starts.length === 0 || (length > 0 && length + lengthBySection.get(section) > maxLength)) {
      starts.push(section);
      length = 0;
    }
    length += lengthBySection.get(section);
  }
  const hasRest = read.some(({ rest }) => rest.length > 0);
  if (starts.length + (hasRest ? 1 : 0) < 2) return null;
  const groupOf = (section) => Math.max(0, starts.findLastIndex((start) => bySection(section, start) >= 0));
  // The further articles open with the part's heading and title, what
  // precedes its amending article.
  const headingOf = (opening) => opening.slice(0, Math.max(0, opening.findIndex((paragraph) => articleHeadingPattern.test(paragraph.trim()))));
  const restVersions = Object.fromEntries(read.filter(({ rest }) => rest.length > 0).map(({ version, opening, rest }) => [version, [...headingOf(opening), ...rest]]));
  const restArticles = [...new Set(read.flatMap(({ rest }) => rest).map((paragraph) => paragraph.trim()).filter((paragraph) => articleHeadingPattern.test(paragraph)))];
  const sections = [...new Set(read.flatMap(({ points }) => points.map(({ section }) => section)))].filter((section) => section !== null).sort(bySection);
  const groups = starts.map((start, index) => {
    const named = sections.filter((section) => groupOf(section) === index);
    const [first, last] = [named[0], named.at(-1)];
    return {
      section: {
        labelCz: first === undefined ? "úvodní body" : first === last ? `body k ${sectionLabel(first)}` : `body k ${sectionLabel(first)} až ${sectionLabel(last)}`,
        from: index === 0 ? null : start,
        to: starts[index + 1] ?? null,
        rest: false,
        restArticles
      },
      versions: Object.fromEntries(read.map(({ version, opening, points }) => {
        const held = points.filter(({ section }) => groupOf(section) === index);
        return [version, held.length > 0 ? [...opening, ...held.flatMap(({ paragraphs }) => paragraphs)] : null];
      }).filter(([, paragraphs]) => paragraphs))
    };
  });
  if (hasRest) {
    const labelCz = restArticles.length > 1 ? `${restArticles[0]} až ${restArticles.at(-1)}` : restArticles[0] ?? "další články";
    groups.push({ section: { labelCz, from: null, to: null, rest: true, restArticles }, versions: restVersions });
  }
  return groups;
}

/**
 * Whether a group (`section`, or none for an undivided part) holds what an
 * amendment amends in the group's part: one of its instructions on the part
 * (`instructions`, as sectionsNamedInAmendment gives them) names a section
 * in the group's range, or one of the part's further articles for their
 * group, or names neither, which concerns every group.
 */
export function sectionGroupHolds(section, instructions) {
  if (!section) return true;
  return instructions.some(({ sections, articles }) => {
    const namesRest = articles.some((article) => section.restArticles.includes(article));
    if (sections.length === 0 && !namesRest) return true;
    if (section.rest) return namesRest;
    return sections.some(([from, to]) => (section.to === null || from < section.to) && (section.from === null || to >= section.from));
  });
}
