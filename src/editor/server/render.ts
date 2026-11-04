import type { AstroConfig } from "astro";
import type { PostMeta } from "../types";

type Renderer = Awaited<ReturnType<AstroConfig["markdown"]["processor"]["createRenderer"]>>;

let config: AstroConfig | null = null;
let renderer: Promise<Renderer> | null = null;

export function setRenderConfig(next: AstroConfig) {
    config = next;
    renderer = null;
}

function getRenderer(): Promise<Renderer> {
    if (!config) throw new Error("editor render config is not set");
    const { markdown, image } = config;
    renderer ??= Promise.resolve(
        markdown.processor.createRenderer({
            image,
            syntaxHighlight: markdown.syntaxHighlight,
            shikiConfig: markdown.shikiConfig,
            gfm: markdown.gfm,
            smartypants: markdown.smartypants,
        }),
    );
    return renderer;
}

function escapeAttr(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export async function renderMarkdown(body: string, meta: PostMeta, fileUrl: (ref: string) => string): Promise<string> {
    const result = await (await getRenderer()).render(body, { frontmatter: meta });
    return result.code.replace(/__ASTRO_IMAGE_="([^"]+)"/g, (_, raw: string) => {
        const props = JSON.parse(raw.replace(/&(?:#x22|quot);/g, '"').replace(/&(?:#x27|apos);/g, "'")) as Record<string, unknown>;
        const { src, index: _index, inferSize: _inferSize, ...rest } = props;
        const attrs = Object.entries(rest)
            .filter(([, v]) => v != null)
            .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`);
        const url = typeof src === "string" && src.startsWith("./") ? fileUrl(src) : String(src);
        return [`src="${escapeAttr(url)}"`, ...attrs].join(" ");
    });
}
