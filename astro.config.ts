import { defineConfig } from "astro/config";
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
                    // 듀얼 테마. shiki는 --shiki-light / --shiki-dark 변수를 출력만 하고
                    // 자동으로 전환하지는 않으므로, 어느 쪽을 쓸지는 PostLayout.astro의
                    // "Rehype Pretty Code - Dual Theme" 블록에서 CSS로 선택한다.
                    theme: {
                        light: "github-light",
                        dark: "github-dark",
                    },
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
