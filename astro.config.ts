import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  site: import.meta.env.PROD ? "https://jaehee.dev" : undefined,
  build: {
      assets: "asset_dir"
  }
});
