import { copyFile } from "node:fs/promises";

await copyFile("dist/server/entry.mjs", "dist/server/index.js");
