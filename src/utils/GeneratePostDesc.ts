import type { CollectionEntry } from "astro:content";
import {convert} from "html-to-text";
import {marked} from "marked";
import {DESC_LEN} from "./Constants";

export default function GeneratePostDesc (post: CollectionEntry<"posts">): string 
{
    const renderedContent = convert(marked(post.body));
    
    return renderedContent.slice(0, DESC_LEN);
}
