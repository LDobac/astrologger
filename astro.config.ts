import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
    markdown: {
        remarkPlugins: [
            "remark-math", 
            [
                "remark-toc", 
                {
                    heading: "(table[ -]of[ -])?contents?|toc|index|목차"
                }
            ]
        ],
        gfm: true,
    },
  integrations: [tailwind(), sitemap()],
  site: import.meta.env.PROD ? "https://jaehee.dev" : undefined,
  build: {
    assets: "asset_dir"
  }
});
