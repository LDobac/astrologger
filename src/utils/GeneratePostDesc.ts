import type { CollectionEntry } from "astro:content";
import {convert} from "html-to-text";
import {marked} from "marked";
import {DESC_LEN} from "./Constants";

export default function GeneratePostDesc (post: CollectionEntry<"posts">): string 
{
    const parsedContent = marked.parse(post.body);
    const renderedContent = convert(parsedContent.toString());
    
    return renderedContent.replaceAll("\n", " ").slice(0, DESC_LEN);
}
