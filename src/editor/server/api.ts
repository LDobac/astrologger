import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PostMeta, PublishRequest, SaveRequest } from "../types";
import { HttpError } from "./paths";
import { listAdminComments, replyToComment, resendReplyMail } from "./comments";
import { renderMarkdown } from "./render";
import { addAttachment, deleteDraft, deletePost, getDoc, getTree, publish, resolveAttachment, saveDraft } from "./store";

const MIME: Record<string, string> = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
};

async function readBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
    return JSON.parse((await readBody(req)).toString("utf8")) as T;
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(data));
}

function fileUrl(draft: string | null, source: string | null) {
    return (ref: string) => {
        const params = new URLSearchParams({ path: ref });
        if (draft) params.set("draft", draft);
        if (source) params.set("source", source);
        return `/__editor/api/file?${params}`;
    };
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const q = url.searchParams;
    const key = `${req.method} ${url.pathname}`;

    switch (key) {
        case "GET /tree":
            sendJson(res, 200, await getTree());
            return true;
        case "GET /doc":
            sendJson(res, 200, await getDoc({ draft: q.get("draft"), source: q.get("source") }));
            return true;
        case "PUT /draft":
            sendJson(res, 200, await saveDraft(await readJson<SaveRequest>(req)));
            return true;
        case "DELETE /draft":
            await deleteDraft(q.get("id") ?? "");
            sendJson(res, 200, { ok: true });
            return true;
        case "POST /attachment": {
            const ref = await addAttachment(q.get("draft") ?? "", q.get("name") ?? "", await readBody(req));
            sendJson(res, 200, { path: ref });
            return true;
        }
        case "GET /file": {
            const file = await resolveAttachment({ draft: q.get("draft"), source: q.get("source"), ref: q.get("path") ?? "" });
            res.statusCode = 200;
            res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
            res.setHeader("Cache-Control", "no-store");
            res.end(await fs.readFile(file));
            return true;
        }
        case "POST /render": {
            const { body, meta } = await readJson<{ body: string; meta: PostMeta }>(req);
            const html = await renderMarkdown(body, meta, fileUrl(q.get("draft"), q.get("source")));
            sendJson(res, 200, { html });
            return true;
        }
        case "DELETE /post":
            sendJson(res, 200, await deletePost(q.get("dir") ?? ""));
            return true;
        case "GET /comments":
            sendJson(res, 200, await listAdminComments());
            return true;
        case "POST /comments/reply": {
            const { content } = await readJson<{ content: string }>(req);
            sendJson(res, 200, await replyToComment(Number(q.get("id")), content));
            return true;
        }
        case "POST /comments/resend":
            sendJson(res, 200, await resendReplyMail(Number(q.get("id"))));
            return true;
        case "POST /publish":
            sendJson(res, 200, await publish(await readJson<PublishRequest>(req)));
            return true;
        default:
            return false;
    }
}

export async function handleApi(req: IncomingMessage, res: ServerResponse) {
    try {
        if (!(await route(req, res))) {
            sendJson(res, 404, { error: `알 수 없는 API: ${req.method} ${req.url}` });
        }
    } catch (error) {
        const status = error instanceof HttpError ? error.status : 500;
        const message = error instanceof Error ? error.message : String(error);
        if (status === 500) console.error("[editor]", error);
        sendJson(res, status, { error: message });
    }
}
