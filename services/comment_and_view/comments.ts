import { error, json, readJsonBody, type AppEnv } from "./http";
import { hashPassword, verifyPassword } from "./password";
import { clientIp, rateKey, verifyTurnstile, withinLimit } from "./spam";
import { validateCreate, validateDelete, validateUpdate } from "./validate";

export type CommentRow = {
    id: number;
    parent_id: number | null;
    nickname: string;
    content: string;
    created_at: string;
    updated_at: string | null;
    is_admin: number;
};

type AuthRow = {
    pw_hash: string;
    pw_salt: string;
    has_replies: number;
};

export const PUBLIC_COLUMNS = "id, parent_id, nickname, content, created_at, updated_at, is_admin";
export const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";
const MAX_PER_POST = 300;

export function toPublic(row: CommentRow) {
    return {
        id: row.id,
        parentId: row.parent_id,
        nickname: row.nickname,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isAdmin: row.is_admin === 1,
    };
}

export async function listComments(req: Request, env: AppEnv, slug: string): Promise<Response> {
    if (!(await withinLimit(env.READ_LIMITER, rateKey(req)))) return error(429, "rate_limited");

    const { results } = await env.DB
        .prepare(`SELECT ${PUBLIC_COLUMNS} FROM comments WHERE post_slug = ? ORDER BY id LIMIT ?`)
        .bind(slug, MAX_PER_POST)
        .all<CommentRow>();
    return json(results.map(toPublic));
}

export async function createComment(req: Request, env: AppEnv): Promise<Response> {
    if (!(await withinLimit(env.CREATE_LIMITER, rateKey(req)))) return error(429, "rate_limited");

    const body = await readJsonBody(req);
    if (!body.ok) return error(body.status, body.error);

    const input = validateCreate(body.value);
    if (!input.ok) return error(input.status, input.error);
    const c = input.value;

    if (env.TURNSTILE_SECRET) {
        if (c.turnstileToken === null || !(await verifyTurnstile(env.TURNSTILE_SECRET, c.turnstileToken, clientIp(req)))) {
            return error(403, "captcha_failed");
        }
    }

    const count = await env.DB
        .prepare("SELECT COUNT(*) AS n FROM comments WHERE post_slug = ?")
        .bind(c.postSlug)
        .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_PER_POST) return error(409, "comment_limit");

    const { hash, salt } = await hashPassword(c.password);

    const row = await env.DB
        .prepare(
            `INSERT INTO comments (post_slug, nickname, pw_hash, pw_salt, email, content)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING ${PUBLIC_COLUMNS}`,
        )
        .bind(c.postSlug, c.nickname, hash, salt, c.email, c.content)
        .first<CommentRow>();
    if (row === null) return error(500, "internal_error");

    return json(toPublic(row), 201);
}

async function allowAuthAttempt(req: Request, env: AppEnv, id: number): Promise<boolean> {
    const [byClient, byComment] = await Promise.all([
        withinLimit(env.AUTH_LIMITER, rateKey(req)),
        withinLimit(env.COMMENT_AUTH_LIMITER, `comment:${id}`),
    ]);
    return byClient && byComment;
}

async function authorize(env: AppEnv, id: number, password: string): Promise<Response | null> {
    const auth = await env.DB
        .prepare("SELECT pw_hash, pw_salt, EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = c.id) AS has_replies FROM comments c WHERE c.id = ?")
        .bind(id)
        .first<AuthRow>();
    if (auth === null) return error(404, "not_found");
    if (auth.has_replies) return error(409, "has_replies");
    if (!(await verifyPassword(password, auth.pw_hash, auth.pw_salt))) return error(403, "wrong_password");
    return null;
}

async function conflictOrMissing(env: AppEnv, id: number): Promise<Response> {
    const exists = await env.DB.prepare("SELECT 1 FROM comments WHERE id = ?").bind(id).first();
    return exists === null ? error(404, "not_found") : error(409, "has_replies");
}

export async function updateComment(req: Request, env: AppEnv, id: number): Promise<Response> {
    if (!(await allowAuthAttempt(req, env, id))) return error(429, "rate_limited");

    const body = await readJsonBody(req);
    if (!body.ok) return error(body.status, body.error);

    const input = validateUpdate(body.value);
    if (!input.ok) return error(input.status, input.error);

    const denied = await authorize(env, id, input.value.password);
    if (denied !== null) return denied;

    const row = await env.DB
        .prepare(
            `UPDATE comments SET content = ?1, updated_at = ${NOW}
             WHERE id = ?2 AND NOT EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = ?2)
             RETURNING ${PUBLIC_COLUMNS}`,
        )
        .bind(input.value.content, id)
        .first<CommentRow>();
    if (row === null) return conflictOrMissing(env, id);

    return json(toPublic(row));
}

export async function deleteComment(req: Request, env: AppEnv, id: number): Promise<Response> {
    if (!(await allowAuthAttempt(req, env, id))) return error(429, "rate_limited");

    const body = await readJsonBody(req);
    if (!body.ok) return error(body.status, body.error);

    const input = validateDelete(body.value);
    if (!input.ok) return error(input.status, input.error);

    const denied = await authorize(env, id, input.value.password);
    if (denied !== null) return denied;

    const result = await env.DB
        .prepare("DELETE FROM comments WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = ?1)")
        .bind(id)
        .run();
    if (result.meta.changes === 0) return conflictOrMissing(env, id);

    return new Response(null, { status: 204 });
}
