import { defineConfig, passthroughImageService } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import { rehypePrettyCode } from 'rehype-pretty-code';

// https://astro.build/config
export default defineConfig({
    markdown: {
        syntaxHighlight: false,
        remarkPlugins: [
            "remark-math",
            [
                "remark-toc",
                {
                    heading: "(table[ -]of[ -])?contents?|toc|index|목차",
                    ordered: true,
                    tight: true,
                }
            ]
        ],
        rehypePlugins: [
            [
                rehypePrettyCode,
                {
                    theme: "one-dark-pro",
                    keepBackground: true,
                },
            ],
            "rehype-katex"
        ],
        gfm: true,
    },

    integrations: [tailwind(), sitemap()],

    site: process.env.NODE_ENV === 'production' ? "https://jaehee.dev" : undefined,

    build: {
        assets: "asset_dir"
    },
});
