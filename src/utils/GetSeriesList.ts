import { getCollection } from "astro:content";

export default async function GetSeriesList() : Promise<Array<string>>
{
    const posts = await getCollection("posts");

    const series = [...new Set<string>(posts.filter(post => !!post.data.series).map(post => post.data.series))];

    return series;
}
