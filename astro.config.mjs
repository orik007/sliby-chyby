import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { sites } from "@openai/sites-vite-plugin";

export default defineConfig({
  site: "https://sliby-chyby.orik007-apps.workers.dev",
  output: "server",
  adapter: cloudflare(),
  vite: {
    plugins: [sites()],
  },
});
