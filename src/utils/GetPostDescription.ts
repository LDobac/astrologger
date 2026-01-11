import type { CollectionEntry } from "astro:content";
import {convert} from "html-to-text";
import {marked} from "marked";
import {DESC_LEN} from "./Constants";

const descCache = new Map<string, string>();

function GeneratePostDesc (post: CollectionEntry<"posts">): string 
{
    if (descCache.has(post.id)) {
        return descCache.get(post.id) ?? "";
    }

    const parsedContent = marked.parse(post.body);
    const renderedContent = convert(parsedContent.toString());
    
    const description = renderedContent.replaceAll("\n", " ").slice(0, DESC_LEN);
    descCache.set(post.id, description);
    return description;
}


export default function GetPostDescription(
    post: CollectionEntry<"posts">
): string {
    return post.data.description ?? GeneratePostDesc(post);
}
