import { NOW, PUBLIC_COLUMNS, toPublic, type CommentRow } from "./comments";
import { error, json, readJsonBody, type AppEnv } from "./http";
import { rateKey, withinLimit } from "./spam";
import { ADMIN_NICKNAME, parseContent, parseId } from "./validate";

type AdminRow = CommentRow & {
    post_slug: string;
    email: string | null;
    notified_at: string | null;
};

const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, post_slug, email, notified_at`;
const DISABLED_HASH = "admin$disabled";
const MIN_TOKEN_LENGTH = 32;
const MAX_LIST = 2000;
const REPLY_PATH = /^\/admin\/comments\/([^/]+)\/replies$/;
const NOTIFIED_PATH = /^\/admin\/comments\/([^/]+)\/notified$/;

function toAdmin(row: AdminRow) {
    return { ...toPublic(row), postSlug: row.post_slug, email: row.email, notifiedAt: row.notified_at };
}

async function sha256(value: string): Promise<ArrayBuffer> {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

async function isAuthorized(req: Request, env: AppEnv): Promise<boolean> {
    const expected = env.ADMIN_TOKEN ?? "";
    if (expected.length < MIN_TOKEN_LENGTH) return false;
    const header = req.headers.get("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const [a, b] = await Promise.all([sha256(token), sha256(expected)]);
    return crypto.subtle.timingSafeEqual(a, b);
}

async function listAll(env: AppEnv): Promise<Response> {
    const { results } = await env.DB
        .prepare(`SELECT ${ADMIN_COLUMNS} FROM comments ORDER BY id DESC LIMIT ?`)
        .bind(MAX_LIST)
        .all<AdminRow>();
    return json(results.map(toAdmin));
}

async function createReply(req: Request, env: AppEnv, parentId: number): Promise<Response> {
    const body = await readJsonBody(req);
    if (!body.ok) return error(body.status, body.error);
    const raw = typeof body.value === "object" && body.value !== null ? (body.value as Record<string, unknown>).content : undefined;
    const content = parseContent(raw);
    if (content === null) return error(400, "invalid_content");

    const parent = await env.DB
        .prepare(`SELECT ${ADMIN_COLUMNS} FROM comments WHERE id = ? AND parent_id IS NULL`)
        .bind(parentId)
        .first<AdminRow>();
    if (parent === null) return error(404, "not_found");

    const reply = await env.DB
        .prepare(
            `INSERT INTO comments (parent_id, post_slug, nickname, pw_hash, pw_salt, content, is_admin)
             VALUES (?, ?, ?, ?, '', ?, 1)
             RETURNING ${ADMIN_COLUMNS}`,
        )
        .bind(parent.id, parent.post_slug, ADMIN_NICKNAME, DISABLED_HASH, content)
        .first<AdminRow>();
    if (reply === null) return error(500, "internal_error");

    return json({ reply: toAdmin(reply), parent: toAdmin(parent) }, 201);
}

async function markNotified(env: AppEnv, id: number): Promise<Response> {
    const row = await env.DB
        .prepare(`UPDATE comments SET notified_at = ${NOW} WHERE id = ? AND is_admin = 1 RETURNING ${ADMIN_COLUMNS}`)
        .bind(id)
        .first<AdminRow>();
    return row === null ? error(404, "not_found") : json(toAdmin(row));
}

export async function routeAdmin(req: Request, env: AppEnv, url: URL): Promise<Response> {
    if (req.headers.get("Origin") !== null) return error(403, "forbidden_origin");
    if (!(await isAuthorized(req, env))) {
        return (await withinLimit(env.AUTH_LIMITER, `admin:${rateKey(req)}`)) ? error(401, "unauthorized") : error(429, "rate_limited");
    }

    if (url.pathname === "/admin/comments") {
        return req.method === "GET" ? listAll(env) : error(405, "method_not_allowed");
    }

    const reply = REPLY_PATH.exec(url.pathname);
    if (reply?.[1] !== undefined) {
        const id = parseId(reply[1]);
        if (id === null) return error(404, "not_found");
        return req.method === "POST" ? createReply(req, env, id) : error(405, "method_not_allowed");
    }

    const notified = NOTIFIED_PATH.exec(url.pathname);
    if (notified?.[1] !== undefined) {
        const id = parseId(notified[1]);
        if (id === null) return error(404, "not_found");
        return req.method === "POST" ? markNotified(env, id) : error(405, "method_not_allowed");
    }

    return error(404, "not_found");
}
