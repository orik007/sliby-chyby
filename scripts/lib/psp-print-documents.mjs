import { unzipSync } from "fflate";
import { cleanText, invariant, sha256 } from "./collector-core.mjs";

export const printDocumentEnrichmentVersion = "psp-print-document-v1";

const stopWords = new Set([
  "ano", "bude", "budeme", "ceska", "ceske", "cesky", "dalsi", "jejich", "ktery", "ktere", "musi",
  "navrh", "obnovime", "podle", "pro", "program", "slib", "strana", "vratime", "zakon", "zakona", "zrusime"
]);

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

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("cs-CZ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function officialPrintDocumentPageUrl(termNumber, printNumber, partNumber = 0) {
  return `https://www.psp.cz/sqw/text/tiskt.sqw?O=${termNumber}&CT=${printNumber}&CT1=${partNumber}`;
}

export function parseOfficialPrintDocumentLinks(html, pageUrl) {
  const links = [];
  const pattern = /<a\b[^>]*href=["']([^"']*orig2\.sqw[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of String(html).matchAll(pattern)) {
    const label = cleanText(decodeXml(match[2]), 300);
    if (!/\.docx$/i.test(label)) continue;
    const url = new URL(decodeXml(match[1]), pageUrl);
    invariant(url.protocol === "https:" && url.hostname === "www.psp.cz", `Official print document redirected outside the PSP allowlist: ${url}`);
    links.push({ filename: label, url: url.href });
  }
  return links;
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

export function deriveDocumentSearchTerms(evidencePackage, printNumber) {
  const phrases = new Set();
  for (const evidence of evidencePackage.evidence ?? []) {
    const facts = evidence.structuredFacts ?? {};
    const belongsToPrint = facts.printNumber === printNumber
      || (facts.linkedPrints ?? []).some((linkedPrint) => linkedPrint.number === printNumber);
    if (!belongsToPrint) continue;
    for (const term of evidence.matchBasis?.matchedTerms ?? []) {
      const normalized = normalize(term.phrase);
      if (normalized.length >= 3) phrases.add(normalized);
    }
  }

  const promiseText = normalize(`${evidencePackage.promise?.originalTextCz ?? ""} ${evidencePackage.promise?.atomicClaimCz ?? ""}`);
  const tokens = new Set(promiseText.split(" ").filter((token) =>
    /^\d+$/.test(token) || (token.length >= 4 && !stopWords.has(token))
  ));
  return {
    phrases: [...phrases].sort(),
    tokens: [...tokens].sort()
  };
}

function paragraphScore(paragraph, searchTerms) {
  const text = normalize(paragraph);
  let score = 0;
  for (const phrase of searchTerms.phrases) if (text.includes(phrase)) score += 20;
  for (const token of searchTerms.tokens) {
    const present = new RegExp(`(?:^| )${token}(?: |$)`).test(text);
    if (present) score += /^\d+$/.test(token) ? 100 : 2;
  }
  return score;
}

export function selectRelevantDocumentExcerpts(paragraphs, searchTerms, { maxCharacters = 12_000, maxSeedParagraphs = 12 } = {}) {
  const ranked = paragraphs
    .map((text, index) => ({ index, score: paragraphScore(text, searchTerms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxSeedParagraphs);

  const selectedIndexes = new Set();
  for (const { index } of ranked) {
    for (const candidate of [index - 1, index, index + 1]) {
      if (candidate >= 0 && candidate < paragraphs.length) selectedIndexes.add(candidate);
    }
  }

  const excerpts = [];
  let usedCharacters = 0;
  for (const index of [...selectedIndexes].sort((a, b) => a - b)) {
    const text = paragraphs[index];
    if (usedCharacters + text.length > maxCharacters) continue;
    excerpts.push({ paragraph: index + 1, text });
    usedCharacters += text.length;
  }
  return excerpts;
}

export function buildPrintDocumentEvidence({ evidencePackage, print, document, paragraphs, excerpts }) {
  invariant(excerpts.length > 0, `No relevant excerpts selected for print ${print.printNumber}`);
  const documentHash = sha256(document.bytes);
  return {
    id: `psp-core-2025--print-document-${print.externalPrintId}`,
    role: "conduct-evidence",
    type: "legislative-document",
    title: `${print.printNumber}/${print.partNumber}: official proposal document ${document.filename}`,
    publisher: "Chamber of Deputies of the Parliament of the Czech Republic",
    publishedAt: print.publishedAt,
    url: document.url,
    locator: `${document.filename}; mechanically selected DOCX paragraphs ${excerpts.map(({ paragraph }) => paragraph).join(", ")}`,
    primary: true,
    factSummary: `Official proposal document for print ${print.printNumber}. Excerpts were selected mechanically around promise and matcher terms; no direction or score was assigned.`,
    structuredFacts: {
      externalPrintId: print.externalPrintId,
      printNumber: print.printNumber,
      partNumber: print.partNumber,
      documentFilename: document.filename,
      documentContentHash: documentHash,
      documentByteLength: document.bytes.byteLength,
      paragraphCount: paragraphs.length,
      selectedParagraphCount: excerpts.length,
      searchTerms: deriveDocumentSearchTerms(evidencePackage, print.printNumber),
      documentExcerptsCz: excerpts,
      enrichmentVersion: printDocumentEnrichmentVersion
    },
    sourceRecordHash: documentHash,
    matchBasis: {
      score: null,
      attributionStatus: "document-for-matched-print",
      matchedTerms: [],
      matchedExternalReferences: [{ path: "structuredFacts.externalPrintId", equals: print.externalPrintId }]
    }
  };
}
