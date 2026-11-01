import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// The resolution the pages are rendered at for OCR, the resolution at which
// psp.cz's scans of the treaties are stored (print 105: 300 ppi).
const renderDpi = 300;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * The paragraphs of one page of OCR text, as Tesseract prints it: blocks
 * separated by empty lines, their lines joined with a space. A block with no
 * letter (a page number, a rule, a stamp read as dashes) is left out.
 */
export function ocrPageParagraphs(pageText) {
  return String(pageText)
    .split(/\n\s*\n/u)
    .map((block) => block.replace(/\s+/gu, " ").trim())
    .filter((block) => /\p{L}/u.test(block));
}

/**
 * The paragraphs of a scanned PDF, read by OCR in Czech: every page rendered
 * in grey at 300 dpi with pdftoppm (Poppler) and read with Tesseract
 * (`-l ces`), page by page in order (docs/evidence-pipeline.md, Chamber data
 * rules). Poppler and Tesseract must be installed; a PDF with no readable paragraph
 * fails.
 */
export async function extractPdfOcrParagraphs(bytes) {
  const directory = await mkdtemp(join(tmpdir(), "psp-ocr-"));
  try {
    const pdf = join(directory, "scan.pdf");
    await writeFile(pdf, bytes);
    const { stdout: info } = await run("pdfinfo", [pdf], { maxBuffer: 1_000_000 });
    const pageCount = Number(/^Pages:\s+(\d+)$/mu.exec(info)?.[1] ?? 0);
    invariant(pageCount > 0, "Scanned PDF has no page");
    // One page at a time, so a long scan never holds all its rendered pages.
    const paragraphs = [];
    for (let page = 1; page <= pageCount; page += 1) {
      const image = join(directory, "page");
      await run("pdftoppm", ["-r", String(renderDpi), "-gray", "-singlefile", "-f", String(page), "-l", String(page), pdf, image], { maxBuffer: 1_000_000 });
      const { stdout } = await run("tesseract", [`${image}.pgm`, "stdout", "-l", "ces", "quiet"], { maxBuffer: 10_000_000 });
      await rm(`${image}.pgm`, { force: true });
      paragraphs.push(...ocrPageParagraphs(stdout));
    }
    invariant(paragraphs.length > 0, "Scanned PDF contains no readable paragraphs");
    return paragraphs;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
