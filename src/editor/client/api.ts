import type {
    AdminCommentsResponse,
    EditorDoc,
    PostMeta,
    PublishRequest,
    PublishResponse,
    ReplyResponse,
    SaveRequest,
    TreeResponse,
} from "../types";

const BASE = "/__editor/api";

async function request<T>(method: string, path: string, body?: BodyInit, json = true): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method,
        body,
        headers: body && json ? { "Content-Type": "application/json" } : undefined,
    });
    const text = await res.text();
    let data: T & { error?: string };
    try {
        data = JSON.parse(text) as T & { error?: string };
    } catch {
        throw new Error(`에디터 API 응답이 올바르지 않습니다 (${method} ${path} → ${res.status}). dev 서버를 재시작해 보세요.`);
    }
    if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
    return data;
}

function query(params: Record<string, string | null | undefined>): string {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `?${s}` : "";
}

export const api = {
    tree: () => request<TreeResponse>("GET", "/tree"),
    doc: (params: { draft?: string | null; source?: string | null }) => request<EditorDoc>("GET", `/doc${query(params)}`),
    save: (req: SaveRequest) => request<{ draftId: string; updatedAt: string }>("PUT", "/draft", JSON.stringify(req)),
    discard: (id: string) => request<{ ok: true }>("DELETE", `/draft${query({ id })}`),
    deletePost: (dir: string) => request<{ dir: string }>("DELETE", `/post${query({ dir })}`),
    upload: (draft: string, file: File) =>
        request<{ path: string }>("POST", `/attachment${query({ draft, name: file.name })}`, file, false),
    render: (params: { draft: string | null; source: string | null }, body: string, meta: PostMeta) =>
        request<{ html: string }>("POST", `/render${query(params)}`, JSON.stringify({ body, meta })),
    publish: (req: PublishRequest) => request<PublishResponse>("POST", "/publish", JSON.stringify(req)),
    comments: () => request<AdminCommentsResponse>("GET", "/comments"),
    reply: (id: number, content: string) => request<ReplyResponse>("POST", `/comments/reply${query({ id: String(id) })}`, JSON.stringify({ content })),
    resendMail: (id: number) => request<ReplyResponse>("POST", `/comments/resend${query({ id: String(id) })}`),
    fileUrl: (params: { draft: string | null; source: string | null }, ref: string) =>
        `${BASE}/file${query({ ...params, path: ref })}`,
};
