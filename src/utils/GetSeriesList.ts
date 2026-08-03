import { getCollection } from "astro:content";

export default async function GetSeriesList() : Promise<Array<string>>
{
    const posts = await getCollection("posts");

    // GetTagList와 동일한 이유로 id(경로 기반) 정렬을 명시해 등장 순서를 고정한다.
    const sortedPosts = [...posts].sort((a, b) => a.id.localeCompare(b.id));

    const seriesSet = new Set<string>();
    for (const post of sortedPosts)
    {
        if (!post.data.series) continue;

        seriesSet.add(post.data.series);
    }

    const series = [...seriesSet];

    return series;
}
