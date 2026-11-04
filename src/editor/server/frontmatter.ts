import { Document, YAMLMap, isMap, isScalar, parseDocument } from "yaml";
import type { PostMeta } from "../types";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const KEY_ORDER = ["title", "date", "editDate", "series", "tags", "description", "og"];

export interface ParsedPost {
    doc: Document;
    meta: PostMeta;
    body: string;
}

function str(value: unknown): string {
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

export function emptyMeta(date: string): PostMeta {
    return { title: "", description: "", date, editDate: "", series: "", tags: [], og: null };
}

export function parsePost(source: string): ParsedPost {
    const text = source.replace(/\r\n/g, "\n");
    const match = FRONTMATTER.exec(text);
    const doc = parseDocument(match ? match[1] : "");
    const body = (match ? text.slice(match[0].length) : text).replace(/^\n/, "");
    const data = (doc.toJS() ?? {}) as Record<string, unknown>;
    const og = data.og as { img?: unknown; alt?: unknown } | undefined;

    return {
        doc,
        body,
        meta: {
            title: str(data.title),
            description: str(data.description),
            date: str(data.date),
            editDate: str(data.editDate),
            series: str(data.series),
            tags: Array.isArray(data.tags) ? data.tags.map(str) : [],
            og: og && og.img ? { img: str(og.img), alt: str(og.alt) } : null,
        },
    };
}

function setOrDelete(doc: Document, key: string, value: string) {
    if (value.trim()) doc.set(key, value.trim());
    else doc.delete(key);
}

export function serializePost(meta: PostMeta, body: string, base?: Document): string {
    const doc = base ?? new Document({});
    if (!isMap(doc.contents)) doc.contents = new YAMLMap();

    setOrDelete(doc, "title", meta.title);
    setOrDelete(doc, "date", meta.date);
    setOrDelete(doc, "editDate", meta.editDate);
    setOrDelete(doc, "series", meta.series);

    const tags = [...new Set(meta.tags.map((t) => t.trim()).filter(Boolean))];
    if (tags.length > 0) {
        const node = doc.createNode(tags);
        node.flow = true;
        for (const item of node.items) item.type = "QUOTE_DOUBLE";
        doc.set("tags", node);
    } else {
        doc.delete("tags");
    }

    setOrDelete(doc, "description", meta.description);

    if (meta.og && meta.og.img.trim()) {
        doc.set("og", doc.createNode({ img: meta.og.img.trim(), alt: meta.og.alt.trim() }));
    } else {
        doc.delete("og");
    }

    const map = doc.contents as YAMLMap;
    const rank = (key: unknown) => {
        const index = KEY_ORDER.indexOf(String(isScalar(key) ? key.value : key));
        return index === -1 ? KEY_ORDER.length : index;
    };
    map.items.sort((a, b) => rank(a.key) - rank(b.key));

    const yaml = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).trimEnd();
    return `---\n${yaml}\n---\n\n${body.replace(/^\n+/, "").trimEnd()}\n`;
}
