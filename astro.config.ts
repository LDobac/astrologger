import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { satteri } from "@astrojs/markdown-satteri";
import { transformerMetaHighlight, transformerMetaWordHighlight } from "@shikijs/transformers";
import satteriKatex from "./src/plugins/satteri-katex";
import satteriToc from "./src/plugins/satteri-toc";
import transformerLineNumbers from "./src/plugins/line-numbers";

// https://astro.build/config
export default defineConfig({
    markdown: {
        processor: satteri({
            features: { math: true },
            mdastPlugins: [
                satteriToc({
                    heading: /^(?:(?:table[ -]of[ -])?contents?|toc|index|목차)$/i,
                }),
                satteriKatex(),
            ],
        }),
        // 듀얼 테마: defaultColor:false로 두 테마 모두 리터럴 color 없이
        // --shiki-light / --shiki-dark 변수로만 출력하게 한다(rehype-pretty-code의
        // 기존 출력과 동일한 계약). 어느 쪽을 쓸지는 PostLayout.astro의
        // "Shiki - Dual Theme" 블록에서 CSS로 선택한다.
        shikiConfig: {
            themes: {
                light: "github-light",
                dark: "github-dark",
            },
            defaultColor: false,
            transformers: [
                transformerMetaHighlight(),
                transformerMetaWordHighlight(),
                transformerLineNumbers(),
            ],
        },
    },

    integrations: [sitemap()],

    // Astro 7 기본값이 'jsx'(공백을 다르게 압축)로 바뀌었다. 기존 압축 방식을 유지한다.
    compressHTML: true,

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
