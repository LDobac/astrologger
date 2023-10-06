import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
    markdown: {
        syntaxHighlight: "shiki",
        remarkPlugins: ["remark-math"],
        rehypePlugins: ["rehype-katex"],
        gfm: true,
    },
  integrations: [tailwind(), sitemap()],
  site: import.meta.env.PROD ? "https://jaehee.dev" : undefined,
  build: {
    assets: "asset_dir"
  }
});
