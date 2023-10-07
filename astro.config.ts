import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import rehypePrettyCode from "rehype-pretty-code";

const rehypePrettyCodeOptions = {
    theme: "github-dark",
}

// https://astro.build/config
export default defineConfig({
    markdown: {
        syntaxHighlight: false,
        remarkPlugins: ["remark-math"],
        rehypePlugins: [
            [rehypePrettyCode, rehypePrettyCodeOptions], 
            "rehype-katex"
        ],
        gfm: true,
    },
  integrations: [tailwind(), sitemap()],
  site: import.meta.env.PROD ? "https://jaehee.dev" : undefined,
  build: {
    assets: "asset_dir"
  }
});
