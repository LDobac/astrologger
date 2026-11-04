import path from "node:path";

export const POSTS_ROOT = path.resolve("src/content/posts");
export const DRAFT_ROOT = path.join(POSTS_ROOT, "_draft");
export const ATTACHMENT_DIR = "attachments";
export const POST_FILE = "index.md";

export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

export function toPosix(p: string): string {
    return p.split(path.sep).join("/");
}

export function resolveInside(root: string, rel: string): string {
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) {
        throw new HttpError(400, `잘못된 경로: ${rel}`);
    }
    return abs;
}

export function postDirAbs(dir: string): string {
    const abs = resolveInside(POSTS_ROOT, dir);
    if (abs === POSTS_ROOT || abs === DRAFT_ROOT || abs.startsWith(DRAFT_ROOT + path.sep)) {
        throw new HttpError(400, `잘못된 게시글 경로: ${dir}`);
    }
    return abs;
}

export function draftDirAbs(id: string): string {
    if (!/^(new|edit)-[^/\\]+$/.test(id) || id.includes("..")) {
        throw new HttpError(400, `잘못된 임시 저장 ID: ${id}`);
    }
    return resolveInside(DRAFT_ROOT, id);
}

export function attachmentName(ref: string): string | null {
    const m = /^\.\/attachments\/([^/\\]+)$/.exec(ref);
    return m ? m[1] : null;
}

export function isValidSegment(name: string): boolean {
    return /^[^/\\:*?"<>|]+$/.test(name) && !name.startsWith(".") && !name.startsWith("_") && name !== ATTACHMENT_DIR;
}
