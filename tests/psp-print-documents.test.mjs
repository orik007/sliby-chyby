import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import {
  deriveDocumentSearchTerms,
  extractDocxParagraphs,
  parseOfficialPrintDocumentLinks,
  selectRelevantDocumentExcerpts
} from "../scripts/lib/psp-print-documents.mjs";

test("finds official DOCX links and rejects unrelated download links", () => {
  const html = `<a href="/sqw/text/orig2.sqw?idd=1">t020100.pdf</a>
    <a href="/sqw/text/orig2.sqw?idd=2">t020100.docx</a>
    <a href="https://other.example/file.docx">untrusted.docx</a>`;
  assert.deepEqual(
    parseOfficialPrintDocumentLinks(html, "https://www.psp.cz/sqw/text/tiskt.sqw?O=10&CT=201&CT1=0"),
    [{ filename: "t020100.docx", url: "https://www.psp.cz/sqw/text/orig2.sqw?idd=2" }]
  );
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

test("mechanically selects relevant promise paragraphs with adjacent context", () => {
  const evidencePackage = {
    promise: {
      originalTextCz: "Vrátíme důchodový věk na 65 let.",
      atomicClaimCz: "ANO vrátí důchodový věk na 65 let."
    },
    evidence: [{
      structuredFacts: { printNumber: 270 },
      matchBasis: { matchedTerms: [{ phrase: "důchodového pojištění" }] }
    }]
  };
  const terms = deriveDocumentSearchTerms(evidencePackage, 270);
  assert.ok(terms.phrases.includes("duchodoveho pojisteni"));
  assert.ok(terms.tokens.includes("65"));
  const excerpts = selectRelevantDocumentExcerpts([
    "Obecná část důvodové zprávy.",
    "Zákon o důchodovém pojištění upravuje další technické otázky.",
    "Standardní důchodový věk činí nejvýše 65 let.",
    "Toto ustanovení nabývá účinnosti dnem vyhlášení.",
    "Nesouvisející rozpočtové ustanovení."
  ], terms);
  assert.deepEqual(excerpts.map(({ paragraph }) => paragraph), [2, 3, 4]);
  assert.match(excerpts[1].text, /65 let/);
});
