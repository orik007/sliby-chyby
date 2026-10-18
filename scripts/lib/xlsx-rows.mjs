import { unzipSync } from "fflate";
import { invariant } from "./collector-core.mjs";

/**
 * The rows of an XLSX workbook as text lines (docs/evidence-pipeline.md,
 * Government resolution data rules, Text): each sheet in workbook order,
 * named when there are several, and each non-empty row as its cells joined
 * by " | ", from the sheet's first used column to the row's last cell, an
 * empty cell kept as an empty position so every value stays under its
 * column. A cell is what the workbook stores for it: a string, a number
 * without binary floating-point noise (3448599.9999999991 is 3448600), the
 * value a formula last computed, or, for a number in a date or time format,
 * its date (YYYY-MM-DD), time (HH:MM:SS), or both.
 */
export function extractXlsxRows(bytes) {
  const entries = unzipSync(bytes);
  const names = Object.keys(entries);
  invariant(names.length > 0 && names.length < 5_000, "XLSX archive has an unsafe entry count");
  invariant(Object.values(entries).reduce((sum, entry) => sum + entry.byteLength, 0) <= 40_000_000, "XLSX archive exceeds the uncompressed size limit");
  const read = (name) => {
    const actual = names.find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    return actual ? new TextDecoder("utf-8", { fatal: true }).decode(entries[actual]) : null;
  };
  const workbook = read("xl/workbook.xml");
  const relations = read("xl/_rels/workbook.xml.rels");
  invariant(workbook && relations, "XLSX archive is missing its workbook");
  const targets = new Map([...relations.matchAll(/<Relationship\b([^>]*)\/?>/gu)].map(([, attributes]) => [attributeOf(attributes, "Id"), attributeOf(attributes, "Target")]));
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/gu)].map(([, attributes]) => ({
    name: decodeXml(attributeOf(attributes, "name") ?? ""),
    path: `xl/${String(targets.get(attributeOf(attributes, "r:id"))).replace(/^\/?xl\//u, "")}`
  }));
  invariant(sheets.length > 0, "XLSX workbook has no sheets");
  const date1904 = /<workbookPr\b[^>]*date1904="(?:1|true)"/u.test(workbook);
  const strings = sharedStrings(read("xl/sharedStrings.xml"));
  const dateStyles = dateStyleKinds(read("xl/styles.xml"));
  const lines = [];
  for (const sheet of sheets) {
    const xml = read(sheet.path);
    invariant(xml !== null, `XLSX archive is missing ${sheet.path}`);
    if (sheets.length > 1) lines.push(`List: ${sheet.name}`);
    // Each cell at its column: from its reference (`C5`), or, when the
    // workbook gives none, after the cell before it.
    const rows = [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gu)].map(([, row]) => {
      let column = 0;
      return [...row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)].map(([, attributes, inner = ""]) => {
        const reference = /^([A-Z]+)\d+$/u.exec(attributeOf(attributes, "r") ?? "");
        column = reference ? columnNumber(reference[1]) : column + 1;
        return { column, text: cellText(attributes, inner, { strings, dateStyles, date1904 }) };
      }).filter(({ text }) => text !== "");
    }).filter((cells) => cells.length > 0);
    // A loop, not Math.min(...cells), so a large sheet cannot exceed the
    // number of arguments a call takes.
    const firstColumn = rows.reduce((first, cells) => cells.reduce((least, { column }) => Math.min(least, column), first), Infinity);
    for (const cells of rows) {
      const positions = Array(cells.at(-1).column - firstColumn + 1).fill("");
      for (const { column, text } of cells) positions[column - firstColumn] = text;
      lines.push(positions.join(" | "));
    }
  }
  invariant(lines.length > 0, "XLSX workbook contains no readable cells");
  return lines;
}

// The number of a column from its letters (A is 1, AA is 27).
function columnNumber(letters) {
  return [...letters].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0);
}

function attributeOf(attributes, name) {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "u").exec(attributes);
  return match ? match[1] : null;
}

function decodeXml(text) {
  return text
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&amp;/gu, "&");
}

// The text runs of a string item, without its phonetic guides.
function runText(xml) {
  return decodeXml([...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/gu, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gu)].map(([, text]) => text).join(""));
}

function sharedStrings(xml) {
  if (xml === null) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/gu)].map(([, item]) => runText(item));
}

// The built-in number formats that show a date, a time of day, an elapsed
// time (46, [h]:mm:ss), or a date with a time (ECMA-376, 18.8.30).
const builtInDateFormats = new Map([[14, "date"], [15, "date"], [16, "date"], [17, "date"], [18, "time"], [19, "time"], [20, "time"], [21, "time"], [22, "date-time"], [45, "time"], [46, "elapsed"], [47, "time"]]);

// The kind of each cell style whose number format shows a date or a time: a
// built-in one, or a custom one with a day or year (a date), an hour or
// second (a time of day, or an elapsed time when in brackets, [h]), or both,
// outside quoted text; a month alone is a date.
function dateStyleKinds(xml) {
  if (xml === null) return new Map();
  const custom = new Map([...xml.matchAll(/<numFmt\b([^>]*)\/?>/gu)].map(([, attributes]) => [Number(attributeOf(attributes, "numFmtId")), decodeXml(attributeOf(attributes, "formatCode") ?? "")]));
  const kindOf = (id) => {
    if (builtInDateFormats.has(id)) return builtInDateFormats.get(id);
    if (!custom.has(id)) return null;
    const code = custom.get(id).replace(/"[^"]*"|\[(?![hms]+\])[^\]]*\]|\\./giu, "");
    const date = /[dy]/iu.test(code) || (/m/iu.test(code) && !/[hs]/iu.test(code));
    const time = /[hs]/iu.test(code);
    if (date) return time ? "date-time" : "date";
    if (time) return /\[[hms]+\]/iu.test(code) ? "elapsed" : "time";
    return null;
  };
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/u.exec(xml)?.[1] ?? "";
  const kinds = new Map();
  [...cellXfs.matchAll(/<xf\b([^>]*)\/?>/gu)].forEach(([, attributes], index) => {
    const kind = kindOf(Number(attributeOf(attributes, "numFmtId")));
    if (kind) kinds.set(index, kind);
  });
  return kinds;
}

function cellText(attributes, inner, { strings, dateStyles, date1904 }) {
  const type = attributeOf(attributes, "t");
  if (type === "inlineStr") return runText(inner).replace(/\s+/gu, " ").trim();
  const value = /<v>([\s\S]*?)<\/v>/u.exec(inner)?.[1];
  if (value === undefined) return "";
  if (type === "s") return (strings[Number(value)] ?? "").replace(/\s+/gu, " ").trim();
  if (type === "str" || type === "e") return decodeXml(value).replace(/\s+/gu, " ").trim();
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  const number = Number(value);
  if (!Number.isFinite(number)) return decodeXml(value).trim();
  const kind = dateStyles.get(Number(attributeOf(attributes, "s") ?? 0));
  if (kind) return serialDateTime(number, kind, date1904);
  return String(Number(number.toPrecision(15)));
}

// A date serial of the 1900 system counts days from 30 December 1899
// (keeping Excel's day for 29 February 1900 out of real dates from March
// 1900 on); of the 1904 system, from 1 January 1904. Its fraction is the time
// of day, to the second; an elapsed time shows the whole serial as hours.
function serialDateTime(serial, kind, date1904) {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const seconds = Math.round(serial * 86_400);
  const date = new Date(epoch + Math.floor(seconds / 86_400) * 86_400_000).toISOString().slice(0, 10);
  const clock = (total) => [Math.floor(total / 3_600), Math.floor(total / 60) % 60, total % 60].map((part) => String(part).padStart(2, "0")).join(":");
  if (kind === "date") return date;
  if (kind === "elapsed") return clock(seconds);
  if (kind === "time") return clock(seconds % 86_400);
  return `${date} ${clock(seconds % 86_400)}`;
}
