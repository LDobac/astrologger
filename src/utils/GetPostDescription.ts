import type { CollectionEntry } from "astro:content";
import {convert} from "html-to-text";
import {DESC_LEN} from "./Constants";

const descCache = new Map<string, string>();

/*
 * post.rendered.html은 Sätteri가 실제로 렌더링한(목차 삽입, KaTeX 렌더링,
 * 구문 강조 전부 반영된) 최종 HTML이다 — 사이트에 실제로 보이는 것과 같은
 * 파서를 한 번 더 쓰는 셈이라 marked라는 별도 파서보다 1티어에 가깝다.
 * satteriToc(../plugins/satteri-toc.ts)가 만드는 목차(<nav class="toc">)는
 * 항목 나열만으로 DESC_LEN을 다 채워버리므로 설명문에서는 제외한다.
 */
function GeneratePostDesc (post: CollectionEntry<"posts">): string
{
    if (descCache.has(post.id)) {
        return descCache.get(post.id) ?? "";
    }

    const renderedContent = convert(post.rendered?.html ?? "", {
        selectors: [{ selector: "nav.toc", format: "skip" }],
    });

    const description = renderedContent.replaceAll("\n", " ").slice(0, DESC_LEN);
    descCache.set(post.id, description);
    return description;
}


export default function GetPostDescription(
    post: CollectionEntry<"posts">
): string {
    return post.data.description ?? GeneratePostDesc(post);
}
