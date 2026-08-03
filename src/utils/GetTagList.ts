import { getCollection } from "astro:content";

export default async function GetTagList(): Promise<Array<string>>
{
    const posts = await getCollection("posts");

    // getCollection의 반환 순서는 로더 구현에 의존하는 비보장 동작이라 태그
    // 등장 순서가 로더가 바뀔 때마다 달라질 수 있다(실제로 legacy 로더 -> glob
    // 로더 전환 시 순서가 바뀌는 것을 확인했다). id(경로 기반) 정렬로 고정해
    // 항상 같은 태그 목록 순서를 보장한다.
    const sortedPosts = [...posts].sort((a, b) => a.id.localeCompare(b.id));

    const tagSet = new Set<string>();
    for (const post of sortedPosts)
    {
        if (!post.data.tags) continue;

        post.data.tags.forEach(tag => tagSet.add(tag));
    }

    const tags = [...tagSet];

    return tags;
}
