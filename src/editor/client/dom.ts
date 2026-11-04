export function esc(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function $<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`element not found: ${selector}`);
    return el;
}

export function editUrl(params: { draft?: string; source?: string }): string {
    const q = new URLSearchParams();
    if (params.draft) q.set("draft", params.draft);
    if (params.source) q.set("source", params.source);
    const s = q.toString();
    return `/__editor/edit${s ? `?${s}` : ""}`;
}

export function formatDate(iso: string): string {
    return iso ? iso.slice(0, 10) : "";
}
