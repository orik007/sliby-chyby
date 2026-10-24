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
 * titleCz, paragraphs }`, or null when the text has no table of tasks or a
 * table whose rows are not numbered 1, 2, 3, …, so it is read whole.
 */
export const legislativePlanTitlePattern = /pl[áa]n\p{L}*\s+legislativních\s+prací\s+vlády/iu;

const annexPattern = /^Příloha č\. (\d+)$/u;
const relationPattern = /^Vztah výše uvedených úkolů k /u;
// The heading of a list of tables: by ministry or by period, of a year.
const listingPattern = /^(?:Resortní|Časové) členění/u;
const numberPattern = /^\d+$/u;
// A submitter's abbreviation: one word of at least two capitals ("PV",
// "MSp-LRV", "ÚOHS"), never a cell such as "Ne".
const submitterPattern = /^\p{Lu}{2}[\p{L}-]{0,10}$/u;

// A table of tasks starts with its header row: "č.", "předkladatel", and the
// other column names, up to the first row.
function isTableHeader(paragraphs, index) {
  return paragraphs[index] === "č." && paragraphs[index + 1] === "předkladatel";
}

// The title of an annex: the first of its opening paragraphs that does not
// repeat its heading or name the resolution ("usnesení vlády", "ze dne …").
function annexTitle(paragraphs, start, heading) {
  return paragraphs.slice(start + 1, start + 8).find((paragraph) => paragraph !== heading && !/^(?:usnesení vlády|ze dne )/iu.test(paragraph)) ?? heading;
}

function annexParts(paragraphs, start, end, annexHeading) {
  const isRowStart = (index) => numberPattern.test(paragraphs[index]) && submitterPattern.test(paragraphs[index + 1] ?? "");
  // Each table is headed by the paragraph before its header row: a ministry
  // ("Ministr dopravy") or a period ("březen 2026").
  const tables = [];
  for (let index = start + 1; index < end; index += 1) if (isTableHeader(paragraphs, index)) tables.push(index - 1);
  if (tables.length === 0) return null;
  const used = new Set();
  const tasksByRow = new Map();
  const tasks = [];
  for (const [tableIndex, headingAt] of tables.entries()) {
    // A table runs to the next table's heading, without the heading of the
    // list that begins there ("Časové členění").
    let tableEnd = tables[tableIndex + 1] ?? end;
    while (tableEnd > headingAt && listingPattern.test(paragraphs[tableEnd - 1])) tableEnd -= 1;
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
    // The last row ends with its last column, a flag "ano" or "ne"; what
    // follows it before a relating table or the next table stays in the
    // annex's rest.
    const last = rows.at(-1);
    if (last) {
      let end = last.end;
      while (end > last.start + 2 && !/^(?:ano|ne)$/iu.test(paragraphs[end - 1])) end -= 1;
      if (end > last.start + 2) last.end = end;
    }
    // The rows are numbered 1, 2, 3, …; otherwise the table is not read as
    // one, and the resolution is one law change.
    if (rows.some(({ number }, position) => Number(number) !== position + 1)) return undefined;
    // Each relating table: its title and column names, then entries: a task
    // number, the task, and what it relates to.
    const relations = new Map();
    while (index < tableEnd && relationPattern.test(paragraphs[index])) {
      const titleAt = index;
      index += 1;
      while (index < tableEnd && !numberPattern.test(paragraphs[index]) && !relationPattern.test(paragraphs[index])) index += 1;
      const columns = paragraphs.slice(titleAt, index);
      let entry = null;
      while (index < tableEnd && !relationPattern.test(paragraphs[index])) {
        // An entry starts with the number of one of the table's tasks; any
        // other number ("2027") is a cell of the entry.
        if (numberPattern.test(paragraphs[index]) && rows.some(({ number }) => number === paragraphs[index])) {
          entry = { number: paragraphs[index], indexes: [index] };
          relations.set(entry.number, [...(relations.get(entry.number) ?? []), { columns, entry }]);
        } else if (entry) entry.indexes.push(index);
        index += 1;
      }
    }
    for (const row of rows) {
      const rowIndexes = Array.from({ length: row.end - row.start }, (_, offset) => row.start + offset);
      const related = relations.get(row.number) ?? [];
      const relatedParagraphs = related.flatMap(({ columns, entry }) => [...columns, ...entry.indexes.map((at) => paragraphs[at])]);
      // The same task listed again, without its number, is read once: its
      // number stays in the annex's rest, and what the later listing relates
      // it to joins the task.
      const key = paragraphs.slice(row.start + 1, row.end).join("\n");
      const earlier = tasksByRow.get(key);
      for (const at of [...(earlier ? rowIndexes.slice(1) : rowIndexes), ...related.flatMap(({ entry }) => entry.indexes)]) used.add(at);
      if (earlier) {
        earlier.paragraphs.push(...relatedParagraphs);
        continue;
      }
      // The task's name follows the submitters, each one word.
      const titleAt = rowIndexes.find((at) => at > row.start && /\s/u.test(paragraphs[at]));
      const task = {
        heading: `${annexHeading}, ${paragraphs[headingAt]}, úkol č. ${row.number}`,
        titleCz: titleAt === undefined ? null : paragraphs[titleAt],
        paragraphs: [...header, ...paragraphs.slice(row.start, row.end), ...relatedParagraphs]
      };
      tasksByRow.set(key, task);
      tasks.push(task);
    }
  }
  // Every other paragraph of the annex (its title, contents, abbreviations,
  // the headings and header rows of its tables, and the numbers of tasks read
  // once) is one more part, so no text is lost.
  const rest = [];
  for (let index = start; index < end; index += 1) if (!used.has(index)) rest.push(paragraphs[index]);
  return [{ heading: annexHeading, titleCz: annexTitle(paragraphs, start, annexHeading), paragraphs: rest }, ...tasks];
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
    if (split === undefined) return null;
    if (split) tasks += split.length - 1;
    parts.push(...(split ?? [{ heading, titleCz: annexTitle(paragraphs, index, heading), paragraphs: paragraphs.slice(index, end) }]));
  }
  return tasks > 0 ? parts.filter(({ paragraphs: partParagraphs }) => partParagraphs.length > 0) : null;
}
