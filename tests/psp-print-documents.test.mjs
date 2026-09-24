import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { extractDocxParagraphs, officialPrintDocumentPageUrl } from "../scripts/lib/psp-print-documents.mjs";

test("builds the official print page URL", () => {
  assert.equal(officialPrintDocumentPageUrl(10, 90, 0), "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=90&CT1=0");
});

test("extracts readable numbered paragraphs from a bounded DOCX archive", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="urn:test"><w:body>
      <w:p><w:r><w:t>Návrh zákona</w:t></w:r></w:p>
      <w:p><w:r><w:t>Rozhlasové &amp; televizní poplatky se zrušují.</w:t></w:r></w:p>
    </w:body></w:document>`;
  const bytes = zipSync({ "word/document.xml": strToU8(documentXml) });
  assert.deepEqual(extractDocxParagraphs(bytes), [
    "Návrh zákona",
    "Rozhlasové & televizní poplatky se zrušují."
  ]);
});
