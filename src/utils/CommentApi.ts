import { COMMENT_API_URL } from "./Constants";

export type Comment = {
    id: number;
    parentId: number | null;
    nickname: string;
    content: string;
    createdAt: string;
    updatedAt: string | null;
    isAdmin: boolean;
};

export type CreateCommentInput = {
    postSlug: string;
    nickname: string;
    password: string;
    email: string;
    content: string;
    website: string;
};

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
    network: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    invalid_nickname: "사용할 수 없는 닉네임입니다. 1~20자로 입력해 주세요.",
    invalid_password: "비밀번호는 4~72자로 입력해 주세요.",
    invalid_email: "이메일 형식이 올바르지 않습니다.",
    invalid_content: "내용은 1~2000자로 입력해 주세요.",
    invalid_parent: "답글을 달 수 없는 댓글입니다.",
    wrong_password: "비밀번호가 일치하지 않습니다.",
    has_replies: "답글이 달린 댓글은 수정하거나 삭제할 수 없습니다.",
    comment_limit: "이 글에는 더 이상 댓글을 남길 수 없습니다.",
    rate_limited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    not_found: "댓글을 찾을 수 없습니다.",
    captcha_failed: "자동 입력 방지 확인에 실패했습니다.",
    payload_too_large: "내용이 너무 깁니다.",
};

export function errorMessage(code: string): string {
    return MESSAGES[code] ?? "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function errorCode(data: unknown): string {
    if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
        return data.error;
    }
    return "unknown";
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
    try {
        const res = await fetch(COMMENT_API_URL + path, init);
        const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);
        return res.ok ? { ok: true, value: data as T } : { ok: false, error: errorCode(data) };
    } catch {
        return { ok: false, error: "network" };
    }
}

function jsonInit(method: string, body: unknown): RequestInit {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

export function listComments(slug: string) {
    return request<Comment[]>(`/comments?slug=${encodeURIComponent(slug)}`);
}

export function createComment(input: CreateCommentInput) {
    return request<Comment>("/comments", jsonInit("POST", input));
}

export function updateComment(id: number, password: string, content: string) {
    return request<Comment>(`/comments/${id}`, jsonInit("PATCH", { password, content }));
}

export function deleteComment(id: number, password: string) {
    return request<null>(`/comments/${id}`, jsonInit("DELETE", { password }));
}

export function getViews(slug: string) {
    return request<{ count: number }>(`/views/${encodeURIComponent(slug)}`);
}

export function recordView(slug: string) {
    return request<{ count: number; counted: boolean }>(`/views/${encodeURIComponent(slug)}`, { method: "POST" });
}
