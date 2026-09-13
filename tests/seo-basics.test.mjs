import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const astroConfigUrl = new URL("../astro.config.mjs", import.meta.url);
const baseLayoutUrl = new URL("../src/layouts/BaseLayout.astro", import.meta.url);
const robotsUrl = new URL("../src/pages/robots.txt.ts", import.meta.url);
const sitemapUrl = new URL("../src/pages/sitemap.xml.ts", import.meta.url);

test("public pages declare a stable canonical production address", async () => {
  const [astroConfig, baseLayout] = await Promise.all([readFile(astroConfigUrl, "utf8"), readFile(baseLayoutUrl, "utf8")]);

  assert.match(astroConfig, /site: "https:\/\/sliby-chyby\.orik007-apps\.workers\.dev"/);
  assert.match(baseLayout, /<link rel="canonical" href=\{canonicalUrl\}/);
  assert.match(baseLayout, /<meta property="og:url" content=\{canonicalUrl\}/);
  assert.match(baseLayout, /<meta property="og:locale" content="cs_CZ"/);
});

test("public crawl controls expose every published party and promise page", async () => {
  const [robots, sitemap] = await Promise.all([readFile(robotsUrl, "utf8"), readFile(sitemapUrl, "utf8")]);

  assert.match(robots, /Sitemap: \$\{sitemapUrl\}/);
  assert.match(sitemap, /getCurrentPartySummaries/);
  assert.match(sitemap, /\/strany\/\$\{party\.slug\}/);
  assert.match(sitemap, /\/sliby\/\$\{party\.slug\}\/\$\{promise\.slug\}/);
});
