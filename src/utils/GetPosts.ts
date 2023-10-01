import { getCollection, type CollectionEntry } from "astro:content";

const SortFunc = (a: CollectionEntry<"posts">, b: CollectionEntry<"posts">) => {
    return b.data.date.getTime() - a.data.date.getTime();
}

export async function GetPosts(sort: boolean = false)
{
    const posts = await getCollection("posts");
    if (sort) {
        posts.sort(SortFunc);
    }

    return posts;
}

export async function GetPostsBySeries(series: string, sort: boolean = false)
{
    const posts = await getCollection(
        "posts", 
        (post) => post.data.series ? post.data.series === series : false
    );

    if (sort) {
        posts.sort(SortFunc);
    }

    return posts;
}
