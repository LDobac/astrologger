import { defineMdastPlugin } from "satteri";
import GithubSlugger from "github-slugger";

interface TocItem {
    depth: number;
    text: string;
}

interface SatteriTocOptions {
    /** "목차" 헤딩 텍스트를 판별하는 정규식. 매칭되는 헤딩 바로 뒤에 TOC를 삽입한다. */
    heading: RegExp;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/*
 * "목차" 헤딩 뒤의 원본 마크다운 텍스트에서 ATX(`#`) 헤딩 라인만 골라낸다.
 * 코드펜스(``` 또는 ~~~) 내부는 건너뛴다 — C++ 코드의 `#include <vector>`처럼
 * `#`로 시작하는 줄이 코드블록 안에 흔하기 때문이다(공백 없는 `#include`는
 * 정규식 자체가 걸러내지만, 방어적으로 펜스 추적을 둔다).
 *
 * remark-toc(mdast-util-toc)의 실제 동작을 그대로 재현한다: "목차"와 같거나
 * 얕은 헤딩이 처음 나타나기 전까지는 수집을 시작하지 않고(latch), 일단
 * 시작되면 depth와 무관하게 문서 끝까지 전부 포함한다. 이 데이터셋에서는
 * "목차" 바로 다음이 항상 동일 depth 헤딩이라 즉시 래치되지만, 임의의
 * 문서 구조에서도 동일하게 동작하도록 명시적으로 재현한다.
 */
function collectHeadingsAfter(rest: string, openDepth: number): TocItem[] {
    const items: TocItem[] = [];
    // 원본 마크다운이 CRLF(\r\n)일 수 있으므로 분리 후 각 줄 끝의 \r을 제거한다.
    const lines = rest.split("\n").map((line) => line.replace(/\r$/, ""));
    let inFence = false;
    let fenceMarker = "";
    let started = false;

    for (const line of lines) {
        const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
        if (fenceMatch) {
            const marker = fenceMatch[1][0];
            const len = fenceMatch[1].length;
            if (!inFence) {
                inFence = true;
                fenceMarker = marker.repeat(len);
            } else if (line.trim().startsWith(fenceMarker)) {
                inFence = false;
                fenceMarker = "";
            }
            continue;
        }
        if (inFence) continue;

        const headingMatch = /^(#{1,6})[ \t]+(.+?)[ \t]*$/.exec(line);
        if (!headingMatch) continue;

        const depth = headingMatch[1].length;
        if (!started) {
            if (depth > openDepth) continue;
            started = true;
        }
        items.push({ depth, text: headingMatch[2].trim() });
    }

    return items;
}

/*
 * 평탄한 depth 목록을 중첩 <ol> HTML로 만든다. remark-toc의 ordered:true,
 * tight:true와 동일한 시맨틱(모든 레벨 <ol>, <li> 안에 <p> 래핑 없음) —
 * 실제 번호 스타일(1,2,3 다음 레벨은 i,ii,iii)은 PostLayout.astro의
 * "Markdown List Styles" 블록(.markdown-body ol ol { list-style-type:
 * lower-roman })이 그대로 담당하므로 여기서는 순수 구조만 만들면 된다.
 */
function buildTocHtml(items: TocItem[]): string {
    const slugger = new GithubSlugger();
    let html = "";
    const stack: number[] = [];

    for (const item of items) {
        const slug = slugger.slug(item.text);

        while (stack.length > 0 && item.depth < stack[stack.length - 1]) {
            html += "</li></ol>";
            stack.pop();
        }

        if (stack.length > 0 && item.depth === stack[stack.length - 1]) {
            html += "</li>";
        } else {
            html += "<ol>";
            stack.push(item.depth);
        }

        html += `<li><a href="${encodeURI(`#${slug}`)}">${escapeHtml(item.text)}</a>`;
    }

    while (stack.length > 0) {
        html += "</li></ol>";
        stack.pop();
    }

    return html;
}

export default function satteriToc(options: SatteriTocOptions) {
    return defineMdastPlugin({
        name: "satteri-toc",
        heading(node, ctx) {
            const headingText = ctx.textContent(node);
            if (!options.heading.test(headingText)) return;

            const startOffset = node.position?.end?.offset;
            if (startOffset == null) return;

            const items = collectHeadingsAfter(ctx.source.slice(startOffset), node.depth);
            if (items.length === 0) return;

            ctx.insertAfter(node, { rawHtml: buildTocHtml(items) });
        },
    });
}
