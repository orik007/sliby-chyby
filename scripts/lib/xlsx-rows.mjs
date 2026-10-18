import { unzipSync } from "fflate";
import { invariant } from "./collector-core.mjs";

/**
 * The rows of an XLSX workbook as text lines (docs/evidence-pipeline.md,
 * Government resolution data rules, Text): each sheet in workbook order,
 * named when there are several, and each non-empty row as its cells joined
 * by " | ". A cell is what the workbook stores for it: a string, a number
 * without binary floating-point noise (3448599.9999999991 is 3448600), the
 * value a formula last computed, or, for a number in a date format, its
 * date (YYYY-MM-DD).
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
  const dateStyles = dateStyleIndexes(read("xl/styles.xml"));
  const lines = [];
  for (const sheet of sheets) {
    const xml = read(sheet.path);
    invariant(xml !== null, `XLSX archive is missing ${sheet.path}`);
    if (sheets.length > 1) lines.push(`List: ${sheet.name}`);
    for (const [, row] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gu)) {
      const cells = [...row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)]
        .map(([, attributes, inner = ""]) => cellText(attributes, inner, { strings, dateStyles, date1904 }))
        .filter((text) => text !== "");
      if (cells.length > 0) lines.push(cells.join(" | "));
    }
  }
  invariant(lines.length > 0, "XLSX workbook contains no readable cells");
  return lines;
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

// The built-in number formats that show a date (ECMA-376, 18.8.30).
const builtInDateFormats = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

// The cell styles whose number format shows a date: a built-in date format,
// or a custom one with a day, month, or year outside quoted text.
function dateStyleIndexes(xml) {
  if (xml === null) return new Set();
  const custom = new Map([...xml.matchAll(/<numFmt\b([^>]*)\/?>/gu)].map(([, attributes]) => [Number(attributeOf(attributes, "numFmtId")), decodeXml(attributeOf(attributes, "formatCode") ?? "")]));
  const isDate = (id) => builtInDateFormats.has(id) || (custom.has(id) && /[dmy]/iu.test(custom.get(id).replace(/"[^"]*"|\[[^\]]*\]|\\./gu, "")));
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/u.exec(xml)?.[1] ?? "";
  const indexes = new Set();
  [...cellXfs.matchAll(/<xf\b([^>]*)\/?>/gu)].forEach(([, attributes], index) => {
    if (isDate(Number(attributeOf(attributes, "numFmtId")))) indexes.add(index);
  });
  return indexes;
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
  if (dateStyles.has(Number(attributeOf(attributes, "s") ?? 0))) return serialDate(number, date1904);
  return String(Number(number.toPrecision(15)));
}

// A date serial of the 1900 system counts from 30 December 1899 (keeping
// Excel's day for 29 February 1900 out of real dates from March 1900 on); of
// the 1904 system, from 1 January 1904.
function serialDate(serial, date1904) {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
}
