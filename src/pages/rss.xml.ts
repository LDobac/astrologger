import rss from "@astrojs/rss";
import GeneratePostDesc from "@utils/GeneratePostDesc";
import {GetPosts} from "@utils/GetPosts";
import type {APIRoute} from "astro";
import {slug as slugger} from "github-slugger";

export const GET: APIRoute = async (ctx) => {
    const site = ctx.site ?? (import.meta.env.SITE ?? "https://jaehee.dev");

    const posts = await GetPosts(true);
    
    return rss({
        title: "Jaehee.dev",
        description: "Recent posts in Jaehee.dev",
        site: site,
        items: posts.map((post) => {
            const categories = new Set([...(post.data.tags ?? [])]);

            if (post.data.series) categories.add(post.data.series);

            return {
                title: post.data.title,
                pubDate: post.data.date,
                description: post.data.description ?? GeneratePostDesc(post),
                categories: [...categories],
                link: `/posts/${slugger(post.data.title)}`,
                author: "Jaehee Lee"
            };
        })
    });
}

