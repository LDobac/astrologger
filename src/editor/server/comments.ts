import fs from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import nodemailer from "nodemailer";
import type { AdminComment, AdminCommentsResponse, ReplyResponse } from "../types";
import { HttpError } from "./paths";
import { getTree } from "./store";

type AdminEnv = {
    apiUrl: string;
    token: string;
    gmailUser: string;
    gmailPassword: string;
    mailFrom: string;
};

type PostInfo = { title: string; url: string };

const ENV_FILE = path.resolve(".env");
const CNAME_FILE = path.resolve("public/CNAME");

function parseApiUrl(value: string): string {
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    try {
        return new URL(withScheme).origin;
    } catch {
        throw new HttpError(500, `.env의 COMMENT_ADMIN_API_URL이 올바른 URL이 아닙니다: ${value}`);
    }
}

async function loadEnv(): Promise<AdminEnv> {
    let raw: string;
    try {
        raw = await fs.readFile(ENV_FILE, "utf8");
    } catch {
        throw new HttpError(500, ".env 파일이 없습니다. .env.example을 참고해 만들어 주세요.");
    }
    const env = parseEnv(raw);
    const get = (key: string) => {
        const value = env[key]?.trim();
        if (!value) throw new HttpError(500, `.env에 ${key}가 없습니다.`);
        return value;
    };
    return {
        apiUrl: parseApiUrl(get("COMMENT_ADMIN_API_URL")),
        token: get("COMMENT_ADMIN_TOKEN"),
        gmailUser: get("GMAIL_USER"),
        gmailPassword: get("GMAIL_APP_PASSWORD").replace(/\s/g, ""),
        mailFrom: get("MAIL_FROM"),
    };
}

async function siteOrigin(): Promise<string> {
    return `https://${(await fs.readFile(CNAME_FILE, "utf8")).trim()}`;
}

async function adminFetch<T>(env: AdminEnv, method: string, pathname: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
        res = await fetch(env.apiUrl + pathname, {
            method,
            headers: {
                Authorization: `Bearer ${env.token}`,
                ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (error) {
        throw new HttpError(502, `댓글 API에 연결하지 못했습니다 (${env.apiUrl}): ${error instanceof Error ? error.message : error}`);
    }
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) throw new HttpError(res.status, `댓글 API 오류: ${data?.error ?? res.status}`);
    return data as T;
}

async function postIndex(): Promise<Map<string, PostInfo>> {
    const [{ posts }, origin] = await Promise.all([getTree(), siteOrigin()]);
    return new Map(posts.map((p) => [p.slug, { title: p.title, url: `${origin}/posts/${encodeURIComponent(p.slug)}/` }]));
}

async function postInfo(slug: string): Promise<PostInfo> {
    return (await postIndex()).get(slug) ?? { title: slug, url: `${await siteOrigin()}/posts/${encodeURIComponent(slug)}/` };
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function multiline(value: string): string {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

function buildMail(post: PostInfo, parent: AdminComment, reply: AdminComment) {
    const commentsUrl = `${post.url}#comments`;
    const subject = `[jaehee.dev] "${post.title}" 글에 남기신 댓글에 답글이 달렸습니다`;
    const section = (label: string, body: string, accent: boolean) =>
        `<tr><td style="padding:16px 0 0">
            <div style="font-size:13px;color:#59636e;margin-bottom:6px">${label}</div>
            <div style="padding:12px 14px;border-radius:8px;border-left:4px solid ${accent ? "#0969da" : "#d1d9e0"};background:#f6f8fa;font-size:15px;line-height:1.6;color:#1f2328">${body}</div>
        </td></tr>`;
    const html = `<!doctype html>
<html lang="ko"><body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR','Apple SD Gothic Neo',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
    <tr><td style="padding-bottom:8px;border-bottom:1px solid #d1d9e0">
        <a href="${escapeHtml(post.url)}" style="font-size:20px;font-weight:700;color:#0969da;text-decoration:none">${escapeHtml(post.title)}</a>
    </td></tr>
    ${section("답글", multiline(reply.content), true)}
    ${section(`${escapeHtml(parent.nickname)}님이 남긴 댓글`, multiline(parent.content), false)}
    <tr><td style="padding:24px 0 0;font-size:14px">
        <a href="${escapeHtml(commentsUrl)}" style="color:#0969da">글에서 댓글 보기 →</a>
    </td></tr>
</table>
</body></html>`;
    const text = [
        post.title,
        post.url,
        "",
        "[답글]",
        reply.content,
        "",
        `[${parent.nickname}님이 남긴 댓글]`,
        parent.content,
        "",
        `글에서 댓글 보기: ${commentsUrl}`,
    ].join("\n");
    return { subject, html, text };
}

async function sendReplyMail(env: AdminEnv, parent: AdminComment, reply: AdminComment): Promise<void> {
    if (parent.email === null) return;
    const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: env.gmailUser, pass: env.gmailPassword },
    });
    const mail = buildMail(await postInfo(parent.postSlug), parent, reply);
    await transport.sendMail({ from: env.mailFrom, to: parent.email, ...mail });
    await adminFetch(env, "POST", `/admin/comments/${reply.id}/notified`);
}

async function deliver(env: AdminEnv, parent: AdminComment, reply: AdminComment): Promise<ReplyResponse> {
    if (parent.email === null) return { reply, mail: "none" };
    try {
        await sendReplyMail(env, parent, reply);
        return { reply: { ...reply, notifiedAt: new Date().toISOString() }, mail: "sent" };
    } catch (error) {
        console.error("[editor] reply mail failed", error);
        return { reply, mail: "failed", error: error instanceof Error ? error.message : String(error) };
    }
}

export async function listAdminComments(): Promise<AdminCommentsResponse> {
    const env = await loadEnv();
    const [comments, posts] = await Promise.all([adminFetch<AdminComment[]>(env, "GET", "/admin/comments"), postIndex()]);
    return { apiUrl: env.apiUrl, comments, posts: Object.fromEntries(posts) };
}

export async function replyToComment(parentId: number, content: string): Promise<ReplyResponse> {
    const env = await loadEnv();
    const { reply, parent } = await adminFetch<{ reply: AdminComment; parent: AdminComment }>(
        env,
        "POST",
        `/admin/comments/${parentId}/replies`,
        { content },
    );
    return deliver(env, parent, reply);
}

export async function resendReplyMail(replyId: number): Promise<ReplyResponse> {
    const env = await loadEnv();
    const comments = await adminFetch<AdminComment[]>(env, "GET", "/admin/comments");
    const reply = comments.find((c) => c.id === replyId && c.isAdmin);
    const parent = reply && comments.find((c) => c.id === reply.parentId);
    if (!reply || !parent) throw new HttpError(404, "답글 또는 원 댓글을 찾을 수 없습니다.");
    if (parent.email === null) throw new HttpError(400, "원 댓글에 이메일이 없습니다.");
    return deliver(env, parent, reply);
}
