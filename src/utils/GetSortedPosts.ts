import {getCollection} from "astro:content";

export default async function GetSortedPosts()
{
    const posts = await getCollection("posts");
    posts.sort((a, b) => {
        return b.data.date.getTime() - a.data.date.getTime();
    });

    return posts;
}
