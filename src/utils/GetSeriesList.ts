import { getCollection } from "astro:content";

export default async function GetSeriesList() : Promise<Array<string>>
{
    const posts = await getCollection("posts");

    const seriesSet = new Set<string>();
    for (const post of posts)
    {
        if (!post.data.series) continue;

        seriesSet.add(post.data.series);
    }

    const series = [...seriesSet];

    return series;
}
