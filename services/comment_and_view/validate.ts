import { fail, type Result } from "./http";

export type CreateInput = {
    postSlug: string;
    parentId: number | null;
    nickname: string;
    password: string;
    email: string | null;
    content: string;
    turnstileToken: string | null;
};

export type UpdateInput = { password: string; content: string };

export type DeleteInput = { password: string };

const SLUG_PATTERN = /^[\p{L}\p{M}\p{N}_-]{1,200}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u200E-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const CONTROL_ALL = /[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

const NICKNAME_MAX = 20;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 72;
const EMAIL_MAX = 254;
const CONTENT_MAX = 2000;
const TURNSTILE_TOKEN_MAX = 2048;

function length(s: string): number {
    return [...s].length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSlug(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const slug = value.normalize("NFC");
    return SLUG_PATTERN.test(slug) ? slug : null;
}

export function parseId(value: string): number | null {
    if (!/^[1-9]\d{0,14}$/.test(value)) return null;
    return Number(value);
}

function parseNickname(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const nickname = value.normalize("NFC").replace(CONTROL_ALL, "").trim();
    const len = length(nickname);
    return len >= 1 && len <= NICKNAME_MAX ? nickname : null;
}

function parsePassword(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const password = value.normalize("NFC");
    const len = length(password);
    return len >= PASSWORD_MIN && len <= PASSWORD_MAX ? password : null;
}

function parseContent(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const content = value.normalize("NFC").replace(/\r\n?/g, "\n").replace(CONTROL_EXCEPT_NEWLINE, "").trim();
    const len = length(content);
    return len >= 1 && len <= CONTENT_MAX ? content : null;
}

function parseEmail(value: unknown): Result<string | null> {
    if (value === undefined || value === null) return { ok: true, value: null };
    if (typeof value !== "string") return fail(400, "invalid_email");
    const email = value.trim();
    if (email.length === 0) return { ok: true, value: null };
    if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email) || /\p{C}/u.test(email)) return fail(400, "invalid_email");
    return { ok: true, value: email };
}

function parseParentId(value: unknown): Result<number | null> {
    if (value === undefined || value === null) return { ok: true, value: null };
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) return fail(400, "invalid_parent");
    return { ok: true, value };
}

export function validateCreate(body: unknown): Result<CreateInput> {
    if (!isRecord(body)) return fail(400, "invalid_request");

    const honeypot = body.website;
    if (honeypot !== undefined && honeypot !== null && honeypot !== "") return fail(400, "invalid_request");

    const postSlug = parseSlug(body.postSlug);
    if (postSlug === null) return fail(400, "invalid_slug");

    const parentId = parseParentId(body.parentId);
    if (!parentId.ok) return parentId;

    const nickname = parseNickname(body.nickname);
    if (nickname === null) return fail(400, "invalid_nickname");

    const password = parsePassword(body.password);
    if (password === null) return fail(400, "invalid_password");

    const email = parseEmail(body.email);
    if (!email.ok) return email;

    const content = parseContent(body.content);
    if (content === null) return fail(400, "invalid_content");

    const token = body.turnstileToken;
    if (token !== undefined && token !== null && (typeof token !== "string" || token.length > TURNSTILE_TOKEN_MAX)) {
        return fail(400, "invalid_request");
    }

    return {
        ok: true,
        value: {
            postSlug,
            parentId: parentId.value,
            nickname,
            password,
            email: email.value,
            content,
            turnstileToken: typeof token === "string" && token.length > 0 ? token : null,
        },
    };
}

export function validateUpdate(body: unknown): Result<UpdateInput> {
    if (!isRecord(body)) return fail(400, "invalid_request");
    const password = parsePassword(body.password);
    if (password === null) return fail(400, "invalid_password");
    const content = parseContent(body.content);
    if (content === null) return fail(400, "invalid_content");
    return { ok: true, value: { password, content } };
}

export function validateDelete(body: unknown): Result<DeleteInput> {
    if (!isRecord(body)) return fail(400, "invalid_request");
    const password = parsePassword(body.password);
    if (password === null) return fail(400, "invalid_password");
    return { ok: true, value: { password } };
}
