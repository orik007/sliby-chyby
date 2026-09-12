import { readFile, writeFile } from "node:fs/promises";
import { createCategoryAudit } from "./lib/promise-category-audit.mjs";

const inputPath = new URL("../research/2025-election/promises.json", import.meta.url);
const outputPath = new URL("../research/2025-election/promise-category-audit.json", import.meta.url);

const catalogue = JSON.parse(await readFile(inputPath, "utf8"));
const result = createCategoryAudit(catalogue);

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result.counts));
