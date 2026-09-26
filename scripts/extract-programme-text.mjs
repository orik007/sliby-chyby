// Extracts the text of each archived election programme PDF, page by page, so
// every catalogue quote can be checked against the archived source.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const manifestUrl = new URL("../archive/promise-sources/manifest.json", import.meta.url);
const outputDirectory = new URL("../research/2025-election/programme-text/", import.meta.url);

export async function extractPdfPages(bytes) {
  const document = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const pages = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const { items } = await (await document.getPage(number)).getTextContent();
    let text = "";
    for (const item of items) text += item.str + (item.hasEOL ? "\n" : "");
    pages.push(text.trimEnd());
  }
  return pages;
}

export function formatPages(pages) {
  return pages.map((text, index) => `=== PAGE ${index + 1} ===\n${text}\n`).join("");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  await mkdir(outputDirectory, { recursive: true });
  for (const entry of manifest.entries) {
    const pages = await extractPdfPages(await readFile(new URL(`../${entry.path}`, import.meta.url)));
    await writeFile(new URL(`${entry.sourceId}.txt`, outputDirectory), formatPages(pages));
    console.log(`${entry.sourceId}: ${pages.length} pages`);
  }
}
