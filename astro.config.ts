import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
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

    integrations: [sitemap()],

    /*
     * Fonts API(Noto Sans KR self-host)를 시도했으나 롤백했다. Astro의 <Font />는
     * @font-face + unicode-range 매핑 전체를 캐시 불가능한 인라인 <style>로 매
     * 페이지에 중복 삽입한다(포스트 1페이지 기준 234KB). 45페이지 전체 dist가
     * 4.82MB -> 18.75MB로 불어나 측정 게이트(§Stage 6, 15MB/1.5배 기준)를
     * 압도적으로 초과해 기존 Google <link rel="stylesheet"> 방식으로 되돌렸다.
     */

    site: process.env.NODE_ENV === 'production' ? "https://jaehee.dev" : undefined,

    build: {
        assets: "asset_dir"
    },

    vite: {
        plugins: [tailwindcss()],
    },
});
