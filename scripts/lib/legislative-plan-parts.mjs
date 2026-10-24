import { invariant } from "./collector-core.mjs";

/**
 * Divides a government resolution on the government's plan of legislative
 * work into parts (docs/evidence-pipeline.md, Government resolution data
 * rules, Law changes): the resolution itself, each task of the tables of its
 * annexes with the entries that the tables relating the tasks to EU law and to
 * the government's programme priorities hold for it, and, per annex, the rest
 * of its text. A task listed again in the same annex in the same words (the
 * plan lists its tasks by ministry and again by month) is read once.
 *
 * The text is the resolution's paragraphs as read from zVlády: a table cell
 * per paragraph. Returns the parts in document order, each `{ heading,
 * titleCz, paragraphs }`, or null when the text has no table of tasks.
 */
export const legislativePlanTitlePattern = /pl[áa]n\p{L}*\s+legislativních\s+prací\s+vlády/iu;

const annexPattern = /^Příloha č\. (\d+)$/u;
const relationPattern = /^Vztah výše uvedených úkolů k /u;
const numberPattern = /^\d+$/u;

// "PV předseda vlády", "MSp-LRV ministr spravedlnosti a …": the first word of
// each line after "Přehled použitých zkratek" up to the table's explanations.
function submitterAbbreviations(paragraphs, start, end) {
  const listAt = paragraphs.slice(start, end).findIndex((paragraph) => paragraph === "Přehled použitých zkratek");
  if (listAt < 0) return new Set();
  const abbreviations = new Set();
  for (let index = start + listAt + 1; index < end; index += 1) {
    const match = /^(\S+) \S/u.exec(paragraphs[index]);
    if (!match || paragraphs[index] === "Vysvětlivky k tabulce") break;
    abbreviations.add(match[1]);
  }
  return abbreviations;
}

// A table of tasks starts with its header row: "č.", "předkladatel", and the
// other column names, up to the first row.
function isTableHeader(paragraphs, index) {
  return paragraphs[index] === "č." && paragraphs[index + 1] === "předkladatel";
}

function annexParts(paragraphs, start, end, annexHeading) {
  const abbreviations = submitterAbbreviations(paragraphs, start, end);
  const isRowStart = (index) => numberPattern.test(paragraphs[index]) && abbreviations.has(paragraphs[index + 1]);
  // Each table is headed by the paragraph before its header row: a ministry
  // ("Ministr dopravy") or a period ("březen 2026").
  const tables = [];
  for (let index = start + 1; index < end; index += 1) if (isTableHeader(paragraphs, index)) tables.push(index - 1);
  if (tables.length === 0) return null;
  const used = new Set();
  const seenRows = new Set();
  const tasks = [];
  for (const [tableIndex, headingAt] of tables.entries()) {
    const tableEnd = tables[tableIndex + 1] ?? end;
    let firstRow = headingAt + 2;
    while (firstRow < tableEnd && !isRowStart(firstRow)) firstRow += 1;
    const header = paragraphs.slice(headingAt, firstRow);
    // Rows run to the next row or to a table relating the tasks.
    const rows = [];
    let index = firstRow;
    while (index < tableEnd && !relationPattern.test(paragraphs[index])) {
      if (isRowStart(index)) rows.push({ number: paragraphs[index], start: index, end: index + 1 });
      else if (rows.length > 0) rows.at(-1).end = index + 1;
      index += 1;
    }
    // Each relating table: its title, three column names, then entries
    // "k č." a task number, the task, and what it relates to.
    const relations = new Map();
    while (index < tableEnd && relationPattern.test(paragraphs[index])) {
      const titleAt = index;
      index += 4;
      let entry = null;
      while (index < tableEnd && !relationPattern.test(paragraphs[index])) {
        if (numberPattern.test(paragraphs[index])) {
          entry = { number: paragraphs[index], indexes: [index] };
          relations.set(entry.number, [...(relations.get(entry.number) ?? []), { titleAt, entry }]);
        } else if (entry) entry.indexes.push(index);
        index += 1;
      }
    }
    for (const row of rows) {
      const rowIndexes = Array.from({ length: row.end - row.start }, (_, offset) => row.start + offset);
      // The same task listed again, without its number, is read once.
      const key = paragraphs.slice(row.start + 1, row.end).join("\n");
      const related = relations.get(row.number) ?? [];
      if (seenRows.has(key) && related.length === 0) {
        for (const at of rowIndexes) used.add(at);
        continue;
      }
      seenRows.add(key);
      const relatedParagraphs = related.flatMap(({ titleAt, entry }) => [...paragraphs.slice(titleAt, titleAt + 4), ...entry.indexes.map((at) => paragraphs[at])]);
      for (const at of [...rowIndexes, ...related.flatMap(({ entry }) => entry.indexes)]) used.add(at);
      // The task's name follows the submitters, each one word ("MPO", "ÚOHS").
      const titleAt = rowIndexes.find((at) => at > row.start && /\s/u.test(paragraphs[at]));
      tasks.push({
        heading: `${annexHeading}, ${paragraphs[headingAt]}, úkol č. ${row.number}`,
        titleCz: titleAt === undefined ? null : paragraphs[titleAt],
        paragraphs: [...header, ...paragraphs.slice(row.start, row.end), ...relatedParagraphs]
      });
    }
  }
  // Every other paragraph of the annex (its title, contents, abbreviations,
  // the tables' headings and headers) is one more part, so no text is lost.
  const rest = [];
  for (let index = start; index < end; index += 1) if (!used.has(index)) rest.push(paragraphs[index]);
  return [{ heading: annexHeading, titleCz: paragraphs.slice(start + 1, start + 8).find((paragraph) => paragraph !== paragraphs[start] && !/^(?:usnesení vlády|ze dne )/u.test(paragraph)) ?? annexHeading, paragraphs: rest }, ...tasks];
}

export function legislativePlanParts(paragraphs) {
  invariant(Array.isArray(paragraphs), "A resolution text needs paragraphs");
  // An annex starts at its first "Příloha č. N" paragraph; the heading is
  // often repeated on the next one.
  const annexStarts = [];
  for (const [index, paragraph] of paragraphs.entries()) {
    const match = annexPattern.exec(paragraph);
    if (match && !annexStarts.some(({ number }) => number === match[1])) annexStarts.push({ number: match[1], index });
  }
  if (annexStarts.length === 0) return null;
  const parts = [{ heading: "Usnesení", titleCz: null, paragraphs: paragraphs.slice(0, annexStarts[0].index) }];
  let tasks = 0;
  for (const [position, { number, index }] of annexStarts.entries()) {
    const end = annexStarts[position + 1]?.index ?? paragraphs.length;
    const heading = `Příloha č. ${number}`;
    const split = annexParts(paragraphs, index, end, heading);
    if (split) tasks += split.length - 1;
    parts.push(...(split ?? [{ heading, titleCz: paragraphs.slice(index + 1, index + 8).find((paragraph) => paragraph !== paragraphs[index] && !/^(?:usnesení vlády|ze dne )/u.test(paragraph)) ?? heading, paragraphs: paragraphs.slice(index, end) }]));
  }
  return tasks > 0 ? parts.filter(({ paragraphs: partParagraphs }) => partParagraphs.length > 0) : null;
}
