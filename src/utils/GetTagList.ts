import { getCollection } from "astro:content";

export default async function GetTagList() : Promise<Array<string>>
{
    const posts = await getCollection("posts");

    const tagSet = new Set<string>();
    posts
    .filter(post => !!post.data.tags)
    .forEach(post => post.data.tags.forEach(tag => tagSet.add(tag)));

    const tags = [...tagSet];

    return tags;
}
