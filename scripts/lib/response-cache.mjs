import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

function keyOf(keyInput) {
  return createHash("sha256").update(JSON.stringify(keyInput)).digest("hex");
}

/**
 * Returns a saved model response for this role and exact request, or makes
 * the request and saves its response at once (atomically). A run that stops
 * after some calls of one assessment reuses those paid responses next time.
 * Without a cache directory it only makes the request.
 */
export async function cachedModelResponse({ directory, role, keyInput, request, onReuse = () => {} }) {
  if (!directory) return request();
  const path = join(directory, `${role}.json`);
  const key = keyOf(keyInput);
  if (existsSync(path)) {
    const saved = JSON.parse(await readFile(path, "utf8"));
    if (saved.key === key) {
      onReuse();
      return saved.response;
    }
  }
  const response = await request();
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${role}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify({ key, response }, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return response;
}
