import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { slug as slugger } from "github-slugger";

export const GET: APIRoute = async ({ params, request, props }) => {
    const { post } = props as { post: CollectionEntry<"posts"> };
    
    const response = await fetch("https://docs.astro.build/assets/full-logo-light.png");
    return new Response(await response.arrayBuffer(), {
        headers: { "Content-Type": "image/png" },
    });
};

export async function getStaticPaths () {
    const posts = await getCollection("posts");

    const links = posts.map((post) => {
        return {
            params: {
                slug: slugger(post.data.title)
            },
            props: {
                post
            }
        };
    });

    return links;
}