import { getCollection, type CollectionEntry } from "astro:content";

const SortFunc = (a: CollectionEntry<"posts">, b: CollectionEntry<"posts">) => {
    return b.data.date.getTime() - a.data.date.getTime();
};

let postsCache: Array<CollectionEntry<"posts">> | null = null;
let postsSortedCache: Array<CollectionEntry<"posts">> | null = null;
const seriesCache = new Map<string, Array<CollectionEntry<"posts">>>();
const seriesSortedCache = new Map<string, Array<CollectionEntry<"posts">>>();

async function GetBasePosts(): Promise<Array<CollectionEntry<"posts">>> {
    if (!postsCache) {
        postsCache = await getCollection("posts");
    }
    return postsCache;
}

async function GetSeriesPosts(series: string): Promise<Array<CollectionEntry<"posts">>> {
    if (!seriesCache.has(series)) {
        const posts = await getCollection(
            "posts",
            (post) => post.data.series ? post.data.series === series : false
        );
        seriesCache.set(series, posts);
    }
    return seriesCache.get(series) ?? [];
}

export async function GetPosts(sort: boolean = false)
{
    if (!sort) {
        return await GetBasePosts();
    }

    if (!postsSortedCache) {
        const posts = await GetBasePosts();
        postsSortedCache = [...posts].sort(SortFunc);
    }
    return postsSortedCache;
}

export async function GetPostsBySeries(series: string, sort: boolean = false)
{
    if (!sort) {
        return await GetSeriesPosts(series);
    }

    if (!seriesSortedCache.has(series)) {
        const posts = await GetSeriesPosts(series);
        seriesSortedCache.set(series, [...posts].sort(SortFunc));
    }
    return seriesSortedCache.get(series) ?? [];
}
