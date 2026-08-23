import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { sites } from "@openai/sites-vite-plugin";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  vite: {
    plugins: [sites()],
  },
});
