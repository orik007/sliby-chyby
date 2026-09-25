import { unzipSync } from "fflate";
import { fetchVerified, invariant } from "./collector-core.mjs";

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// With four parallel requests, psp.cz intermittently refused connections
// within the first minute in two runs (25 September 2026, connect timeouts),
// and one URL failed all four attempts spaced 1, 2, and 4 s apart. So at
// most two requests are open at a time, and a failed request waits longer
// before each retry: 5, 10, 20, 40, and 80 s. A request keeps its slot while
// it waits, so when psp.cz stops answering, every download pauses rather
// than adding connections.
export const pspDownloadSettings = { concurrency: 2, retryAttempts: 6, retryDelayMs: 5_000 };

// Returns a fetch that sends every request through one shared limit. A
// request takes a slot only for itself, never while holding another, so the
// limit cannot deadlock.
export function createPspFetcher({ concurrency, retryAttempts, retryDelayMs } = pspDownloadSettings) {
  let active = 0;
  const waiting = [];
  return async (source, url, options) => {
    if (active >= concurrency) await new Promise((resolveTurn) => waiting.push(resolveTurn));
    active += 1;
    try {
      return await fetchVerified(source, url, { ...options, retryAttempts, retryDelayMs });
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

export function officialPrintDocumentPageUrl(termNumber, printNumber, partNumber = 0) {
  return `https://www.psp.cz/sqw/text/tiskt.sqw?O=${termNumber}&CT=${printNumber}&CT1=${partNumber}`;
}

export function officialPrintHistoryUrl(termNumber, printNumber) {
  return `https://www.psp.cz/sqw/historie.sqw?o=${termNumber}&t=${printNumber}`;
}

export function extractDocxParagraphs(bytes) {
  const entries = unzipSync(bytes);
  const names = Object.keys(entries);
  invariant(names.length > 0 && names.length < 5_000, "DOCX archive has an unsafe entry count");
  const totalBytes = Object.values(entries).reduce((sum, entry) => sum + entry.byteLength, 0);
  invariant(totalBytes <= 40_000_000, "DOCX archive exceeds the uncompressed size limit");
  const documentName = names.find((name) => name.toLowerCase() === "word/document.xml");
  invariant(documentName, "DOCX archive is missing word/document.xml");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(entries[documentName]);
  const paragraphs = [];
  for (const paragraphMatch of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)) {
    const fragments = [];
    const content = paragraphMatch[1];
    const tokenPattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:br\b[^>]*\/?\s*>/gi;
    for (const token of content.matchAll(tokenPattern)) {
      if (token[1] !== undefined) fragments.push(decodeXml(token[1]));
      else fragments.push(" ");
    }
    const text = fragments.join("").replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
  }
  invariant(paragraphs.length > 0, "Official DOCX document contains no readable paragraphs");
  return paragraphs;
}
