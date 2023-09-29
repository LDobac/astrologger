import { getCollection } from "astro:content";

export default async function GetTagList(): Promise<Array<string>>
{
    const posts = await getCollection("posts");

    const tagSet = new Set<string>();
    for (const post of posts) 
    {
        if (!post.data.tags) continue;

        post.data.tags.forEach(tag => tagSet.add(tag));
    }

    const tags = [...tagSet];

    return tags;
}
