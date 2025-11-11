// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { port: 3000 },
  vite: {
    plugins: [tailwindcss()],
    define: {
      "import.meta.env.SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL),
      "import.meta.env.SUPABASE_KEY": JSON.stringify(process.env.SUPABASE_KEY),
      "import.meta.env.OPENROUTER_API_KEY": JSON.stringify(process.env.OPENROUTER_API_KEY),
      "import.meta.env.OPENROUTER_DEFAULT_MODEL": JSON.stringify(process.env.OPENROUTER_DEFAULT_MODEL),
    },
  },
  adapter: cloudflare({
    mode: "directory",
    platformProxy: {
      enabled: true,
    },
  }),
});
