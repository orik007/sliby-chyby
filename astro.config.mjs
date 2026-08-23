import { defineConfig } from "astro/config";
import { sites } from "@openai/sites-vite-plugin";

export default defineConfig({
  vite: {
    plugins: [sites()],
  },
});
