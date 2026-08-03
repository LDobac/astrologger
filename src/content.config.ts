import { z, defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const postCollection = defineCollection({
    loader: glob({ base: "./src/content/posts", pattern: "**/*.md" }),
    schema: ({ image }) => z.object({
        title: z.string(),
        description: z.string().optional(),
        date: z.date(),
        editDate: z.date().optional(),
        series: z.string().optional(),
        tags: z.array(z.string()).optional(),
        og: z.object({
            img: image(),
            alt: z.string(),
        }).optional()
    }),
});

export const collections = {
    "posts": postCollection,
};
