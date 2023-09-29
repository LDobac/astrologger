import {z, defineCollection} from "astro:content";

const postCollection = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        date: z.date(),
        editDate: z.date().optional(),
        series: z.string().optional(),
        tags: z.array(z.string()).optional(),
    }),
});

export const collections = {
    "posts": postCollection,
};
