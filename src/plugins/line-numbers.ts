import type { ShikiTransformer } from "shiki";

/*
 * rehype-pretty-code의 `showLineNumbers` 펜스 메타 문법을 그대로 재현한다.
 * <code> 엘리먼트에 data-line-numbers / data-line-numbers-max-digits
 * 속성을 달아두면, PostLayout.astro의 기존 카운터 기반 CSS
 * (counter-reset/counter-increment)가 그대로 번호를 그려준다 — 마크다운
 * 펜스 문법도 CSS 셀렉터도 바꿀 필요가 없다.
 */
export default function transformerLineNumbers(): ShikiTransformer {
    return {
        name: "line-numbers",
        code(node) {
            const raw = this.options.meta?.__raw;
            if (!raw?.includes("showLineNumbers")) return;

            const lineCount = node.children.filter(
                (child) => child.type === "element" && child.tagName === "span",
            ).length;

            node.properties["data-line-numbers"] = "";
            node.properties["data-line-numbers-max-digits"] = String(String(lineCount).length);
        },
    };
}
