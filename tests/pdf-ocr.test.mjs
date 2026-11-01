import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractPdfOcrParagraphs, ocrPageParagraphs } from "../scripts/lib/pdf-ocr.mjs";

test("a page of OCR text is its blocks, lines joined, without blocks that have no letter", () => {
  const page = "> ----->->->———— \n\nČlánek 1\nOSOBY, NA KTERÉ SE SMLOUVA VZTAHUJE\n\nTato smlouva se vztahuje na osoby,\nkteré jsou rezidenty.\n\n17\n\n";
  assert.deepEqual(ocrPageParagraphs(page), ["Článek 1 OSOBY, NA KTERÉ SE SMLOUVA VZTAHUJE", "Tato smlouva se vztahuje na osoby, které jsou rezidenty."]);
});

// A part of page 2 of the Czech text of the treaty with Kenya (print 105,
// t0105b0.pdf), which psp.cz publishes only as a scan, rendered and cut to
// keep the fixture small.
test("reads a scanned treaty page by OCR in Czech", { timeout: 120_000 }, async () => {
  const paragraphs = await extractPdfOcrParagraphs(await readFile(new URL("./fixtures/print-parts/print-105-treaty-scan-excerpt.pdf", import.meta.url)));
  assert.deepEqual(paragraphs.slice(0, 4), [
    "Článek 1 OSOBY, NA KTERÉ SE SMLOUVA VZTAHUJE",
    "Tato smlouva se vztahuje na osoby, které jsou rezidenty jednoho nebo obou smluvních států.",
    "Článek 2 DANĚ, NA KTERÉ SE SMLOUVA VZTAHUJE",
    "1. Tato smlouva se vztahuje na daně z příjmu ukládané jménem každého ze smluvních států nebo jeho nižších správních útvarů nebo místních úřadů, ať je způsob vybírání jakýkoli."
  ]);
});
