import { defineMdastPlugin } from "satteri";
import katex from "katex";

/*
 * Sätteri의 features.math는 $$...$$ / $...$ 를 mdast의 math/inlineMath 노드로
 * 파싱만 하고 시각 출력은 만들지 않는다("no native equivalent" to rehype-katex).
 * 이 플러그인이 그 렌더링을 대신한다 — rehype-katex도 내부적으로 같은
 * katex.renderToString 호출을 한다.
 *
 * math/inlineMath visitor가 { rawHtml } 을 반환하면 해당 노드가 그 raw HTML로
 * 치환된다(satteri의 MdastVisitorContext 계약). KaTeX가 생성하는 <span
 * class="katex">...</span> 마크업은 posts/[slug]/index.astro가 조건부로 넣는
 * KaTeX CDN CSS를 그대로 소비한다.
 */
export default function satteriKatex() {
    return defineMdastPlugin({
        name: "satteri-katex",
        math(node) {
            return {
                rawHtml: katex.renderToString(node.value, {
                    displayMode: true,
                    throwOnError: false,
                }),
            };
        },
        inlineMath(node) {
            return {
                rawHtml: katex.renderToString(node.value, {
                    displayMode: false,
                    throwOnError: false,
                }),
            };
        },
    });
}
