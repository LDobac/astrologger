import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { slug as slugger } from "github-slugger";
import type {
    DraftSummary,
    EditorDoc,
    PostSummary,
    PublishRequest,
    PublishResponse,
    SaveRequest,
    TreeNode,
    TreeResponse,
} from "../types";
import { emptyMeta, parsePost, serializePost, type ParsedPost } from "./frontmatter";
import { notifyFileEvent } from "./watcher";
import {
    ATTACHMENT_DIR,
    DRAFT_ROOT,
    HttpError,
    POSTS_ROOT,
    POST_FILE,
    attachmentName,
    draftDirAbs,
    isValidSegment,
    postDirAbs,
    resolveInside,
    toPosix,
} from "./paths";

interface DraftInfo {
    sourceDir: string | null;
    createdAt: string;
    updatedAt: string;
}

const DRAFT_INFO = "draft.json";
const CONTENT_ASSETS = path.resolve(".astro/content-assets.mjs");
const CONVERT_TO_WEBP = new Set(["png", "jpg", "jpeg"]);
const ALLOWED_IMAGES = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"]);
const WEBP_SCRIPT = `import sharp from "sharp";
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
process.stdout.write(await sharp(Buffer.concat(chunks)).webp().toBuffer());`;

function toWebp(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const child = execFile(
            process.execPath,
            ["--input-type=module", "-e", WEBP_SCRIPT],
            { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 },
            (error, stdout, stderr) => {
                if (error) reject(new HttpError(500, `webp 변환 실패: ${stderr.toString() || error.message}`));
                else resolve(stdout);
            },
        );
        child.stdin?.end(data);
    });
}

export function nowKst(): string {
    return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 19) + "+09:00";
}

async function exists(p: string): Promise<boolean> {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function readPost(dirAbs: string): Promise<ParsedPost> {
    return parsePost(await fs.readFile(path.join(dirAbs, POST_FILE), "utf8"));
}

async function listFiles(dirAbs: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(dirAbs, { withFileTypes: true });
        return entries.filter((e) => e.isFile()).map((e) => e.name).sort();
    } catch {
        return [];
    }
}

function summarize(dir: string, parsed: ParsedPost): PostSummary {
    const { title, date, series, tags } = parsed.meta;
    return { dir, title, date, series, tags, slug: slugger(title) };
}

async function walk(abs: string, rel: string, all: PostSummary[]): Promise<TreeNode> {
    const node: TreeNode = { name: rel ? path.posix.basename(rel) : "posts", path: rel, trees: [], posts: [] };
    const entries = (await fs.readdir(abs, { withFileTypes: true }))
        .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        const childAbs = path.join(abs, entry.name);
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (await exists(path.join(childAbs, POST_FILE))) {
            const summary = summarize(childRel, await readPost(childAbs));
            node.posts.push(summary);
            all.push(summary);
        } else if (entry.name !== ATTACHMENT_DIR) {
            node.trees.push(await walk(childAbs, childRel, all));
        }
    }

    node.posts.sort((a, b) => b.date.localeCompare(a.date));
    return node;
}

async function collectPosts(): Promise<{ root: TreeNode; posts: PostSummary[] }> {
    const posts: PostSummary[] = [];
    const root = await walk(POSTS_ROOT, "", posts);
    return { root, posts };
}

async function readDraftInfo(draftAbs: string): Promise<DraftInfo> {
    try {
        return JSON.parse(await fs.readFile(path.join(draftAbs, DRAFT_INFO), "utf8")) as DraftInfo;
    } catch {
        throw new HttpError(404, "임시 저장 글을 찾을 수 없습니다.");
    }
}

async function listDrafts(): Promise<DraftSummary[]> {
    if (!(await exists(DRAFT_ROOT))) return [];
    const drafts: DraftSummary[] = [];
    for (const entry of await fs.readdir(DRAFT_ROOT, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const abs = path.join(DRAFT_ROOT, entry.name);
        try {
            const info = await readDraftInfo(abs);
            const parsed = await readPost(abs);
            drafts.push({ id: entry.name, sourceDir: info.sourceDir, title: parsed.meta.title, updatedAt: info.updatedAt });
        } catch {
            continue;
        }
    }
    return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTree(): Promise<TreeResponse> {
    const { root, posts } = await collectPosts();
    const sorted = [...posts].sort((a, b) => a.dir.localeCompare(b.dir));
    const tags = [...new Set(sorted.flatMap((p) => p.tags))];
    const series = [...new Set(sorted.map((p) => p.series).filter(Boolean))];
    return { root, posts, drafts: await listDrafts(), tags, series };
}

function draftIdFor(sourceDir: string | null): string {
    if (sourceDir) return `edit-${sourceDir.split("/").join("__")}`;
    return `new-${nowKst().slice(0, 19).replace(/\D/g, "")}`;
}

async function attachmentsOf(draftAbs: string | null, sourceAbs: string | null): Promise<string[]> {
    const names = new Set<string>();
    if (sourceAbs) (await listFiles(path.join(sourceAbs, ATTACHMENT_DIR))).forEach((n) => names.add(n));
    if (draftAbs) (await listFiles(path.join(draftAbs, ATTACHMENT_DIR))).forEach((n) => names.add(n));
    return [...names].sort().map((n) => `./${ATTACHMENT_DIR}/${n}`);
}

async function loadDraft(id: string): Promise<EditorDoc> {
    const draftAbs = draftDirAbs(id);
    const info = await readDraftInfo(draftAbs);
    const parsed = await readPost(draftAbs);
    const sourceAbs = info.sourceDir ? postDirAbs(info.sourceDir) : null;
    const sourceTitle = sourceAbs && (await exists(path.join(sourceAbs, POST_FILE))) ? (await readPost(sourceAbs)).meta.title : null;
    return {
        draftId: id,
        sourceDir: info.sourceDir,
        sourceTitle,
        meta: parsed.meta,
        body: parsed.body,
        attachments: await attachmentsOf(draftAbs, sourceAbs),
        updatedAt: info.updatedAt,
    };
}

export async function getDoc(params: { draft?: string | null; source?: string | null }): Promise<EditorDoc> {
    if (params.draft) return loadDraft(params.draft);

    if (params.source) {
        const sourceAbs = postDirAbs(params.source);
        if (!(await exists(path.join(sourceAbs, POST_FILE)))) throw new HttpError(404, "게시글을 찾을 수 없습니다.");
        const id = draftIdFor(params.source);
        if (await exists(draftDirAbs(id))) return loadDraft(id);
        const parsed = await readPost(sourceAbs);
        return {
            draftId: null,
            sourceDir: params.source,
            sourceTitle: parsed.meta.title,
            meta: parsed.meta,
            body: parsed.body,
            attachments: await attachmentsOf(null, sourceAbs),
            updatedAt: null,
        };
    }

    return {
        draftId: null,
        sourceDir: null,
        sourceTitle: null,
        meta: emptyMeta(nowKst()),
        body: "",
        attachments: [],
        updatedAt: null,
    };
}

export async function saveDraft(req: SaveRequest): Promise<{ draftId: string; updatedAt: string }> {
    const sourceAbs = req.sourceDir ? postDirAbs(req.sourceDir) : null;
    let id = req.draftId;
    if (!id) {
        id = draftIdFor(req.sourceDir);
        if (!req.sourceDir) {
            let candidate = id;
            for (let i = 1; await exists(draftDirAbs(candidate)); i++) candidate = `${id}-${i}`;
            id = candidate;
        }
    }

    const draftAbs = draftDirAbs(id);
    const draftFile = path.join(draftAbs, POST_FILE);
    const base = (await exists(draftFile))
        ? (await readPost(draftAbs)).doc
        : sourceAbs
          ? (await readPost(sourceAbs)).doc
          : undefined;

    const now = nowKst();
    const info: DraftInfo = (await exists(path.join(draftAbs, DRAFT_INFO)))
        ? { ...(await readDraftInfo(draftAbs)), updatedAt: now }
        : { sourceDir: req.sourceDir, createdAt: now, updatedAt: now };

    await fs.mkdir(draftAbs, { recursive: true });
    await fs.writeFile(draftFile, serializePost(req.meta, req.body, base), "utf8");
    await fs.writeFile(path.join(draftAbs, DRAFT_INFO), JSON.stringify(info, null, 4), "utf8");
    return { draftId: id, updatedAt: now };
}

export async function deleteDraft(id: string): Promise<void> {
    await fs.rm(draftDirAbs(id), { recursive: true, force: true });
}

function sanitizeBaseName(name: string): string {
    const base = name
        .replace(/\.[^.]*$/, "")
        .trim()
        .replace(/[\s/\\:*?"<>|#%()[\]]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return base || "image";
}

export async function addAttachment(id: string, fileName: string, data: Buffer): Promise<string> {
    const draftAbs = draftDirAbs(id);
    const info = await readDraftInfo(draftAbs);
    let ext = (/\.([^.]+)$/.exec(fileName)?.[1] ?? "").toLowerCase();
    if (!ALLOWED_IMAGES.has(ext)) throw new HttpError(400, `지원하지 않는 이미지 형식입니다: ${fileName}`);

    let output = data;
    if (CONVERT_TO_WEBP.has(ext)) {
        output = await toWebp(data);
        ext = "webp";
    }

    const taken = new Set(
        (await attachmentsOf(draftAbs, info.sourceDir ? postDirAbs(info.sourceDir) : null)).map((r) => attachmentName(r)),
    );
    const base = sanitizeBaseName(fileName);
    let name = `${base}.${ext}`;
    for (let i = 1; taken.has(name); i++) name = `${base}-${i}.${ext}`;

    const dir = path.join(draftAbs, ATTACHMENT_DIR);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), output);
    return `./${ATTACHMENT_DIR}/${name}`;
}

export async function resolveAttachment(params: { draft?: string | null; source?: string | null; ref: string }): Promise<string> {
    const name = attachmentName(params.ref);
    if (!name) throw new HttpError(400, `잘못된 첨부 경로: ${params.ref}`);

    const dirs: string[] = [];
    let source = params.source ?? null;
    if (params.draft) {
        const draftAbs = draftDirAbs(params.draft);
        dirs.push(draftAbs);
        source ??= (await readDraftInfo(draftAbs)).sourceDir;
    }
    if (source) dirs.push(postDirAbs(source));

    for (const dir of dirs) {
        const file = path.join(dir, ATTACHMENT_DIR, name);
        if (await exists(file)) return file;
    }
    throw new HttpError(404, `첨부파일을 찾을 수 없습니다: ${params.ref}`);
}

function referencedAttachments(body: string, og: { img: string } | null): Set<string> {
    const refs = new Set<string>();
    const text = `${body}\n${og?.img ?? ""}`;
    for (const m of text.matchAll(/\.\/attachments\/([^\s)"'<>]+)/g)) {
        try {
            refs.add(decodeURI(m[1]));
        } catch {
            refs.add(m[1]);
        }
    }
    return refs;
}

async function moveFile(from: string, to: string): Promise<void> {
    await fs.rm(to, { force: true });
    try {
        await fs.rename(from, to);
    } catch {
        await fs.copyFile(from, to);
        await fs.rm(from, { force: true });
    }
}

async function resolveNewTarget(tree: string, folder: string): Promise<{ abs: string; rel: string }> {
    const segments = tree.split("/").map((s) => s.trim()).filter(Boolean);
    const folderName = folder.trim();
    if (![...segments, folderName].every(isValidSegment)) {
        throw new HttpError(400, "트리/폴더 이름에 사용할 수 없는 문자가 있습니다. ('_', '.' 시작 및 attachments 불가)");
    }

    let cursor = POSTS_ROOT;
    for (const segment of segments) {
        cursor = path.join(cursor, segment);
        if (await exists(path.join(cursor, POST_FILE))) {
            throw new HttpError(400, `'${segment}'는 게시글 폴더라서 트리로 사용할 수 없습니다.`);
        }
    }

    const rel = [...segments, folderName].join("/");
    const abs = resolveInside(POSTS_ROOT, rel);
    if (await exists(abs)) throw new HttpError(409, `이미 존재하는 폴더입니다: ${rel}`);
    return { abs, rel };
}

export async function deletePost(dir: string): Promise<{ dir: string }> {
    const abs = postDirAbs(dir);
    if (!(await exists(path.join(abs, POST_FILE)))) throw new HttpError(404, "게시글을 찾을 수 없습니다.");

    const nested = (await fs.readdir(abs, { withFileTypes: true })).filter(
        (e) => e.isDirectory() && e.name !== ATTACHMENT_DIR,
    );
    if (nested.length > 0) {
        throw new HttpError(409, `게시글 폴더 안에 예상하지 못한 폴더가 있어 삭제하지 않았습니다: ${nested.map((e) => e.name).join(", ")}`);
    }

    await fs.rm(abs, { recursive: true, force: true });
    notifyFileEvent("unlink", path.join(abs, POST_FILE));
    await deleteDraft(draftIdFor(dir));

    for (let parent = path.dirname(abs); parent !== POSTS_ROOT && parent.startsWith(POSTS_ROOT + path.sep); parent = path.dirname(parent)) {
        if ((await fs.readdir(parent)).length > 0) break;
        await fs.rmdir(parent);
    }

    await dropStaleContentAssets();
    return { dir };
}

export async function dropStaleContentAssets(): Promise<void> {
    let code: string;
    try {
        code = await fs.readFile(CONTENT_ASSETS, "utf8");
    } catch {
        return;
    }

    const stale = new Set<string>();
    for (const match of code.matchAll(/^import (\w+) from "([^"]+)";$/gm)) {
        const [spec, query = ""] = match[2].split("?");
        const importer = new URLSearchParams(query).get("importer");
        if (!importer || !spec.startsWith(".")) continue;
        if (!(await exists(path.resolve(path.dirname(importer), spec)))) stale.add(match[1]);
    }
    if (stale.size === 0) return;

    const next = code
        .split("\n")
        .filter((line) => !stale.has(/^import (\w+) from /.exec(line)?.[1] ?? ""))
        .join("\n")
        .replace(/\["[^"]*", (\w+)\](?:, )?/g, (entry, symbol: string) => (stale.has(symbol) ? "" : entry));
    await fs.writeFile(CONTENT_ASSETS, next, "utf8");
}

export async function publish(req: PublishRequest): Promise<PublishResponse> {
    const draftAbs = draftDirAbs(req.draftId);
    const info = await readDraftInfo(draftAbs);
    const parsed = await readPost(draftAbs);
    const meta = { ...parsed.meta };

    if (!meta.title.trim()) throw new HttpError(400, "제목을 입력하세요.");
    if (!meta.date.trim() || Number.isNaN(Date.parse(meta.date))) throw new HttpError(400, "작성일이 올바르지 않습니다.");
    if (meta.editDate.trim() && Number.isNaN(Date.parse(meta.editDate))) throw new HttpError(400, "수정일이 올바르지 않습니다.");

    const slug = slugger(meta.title);
    const { posts } = await collectPosts();
    const conflict = posts.find((p) => p.slug === slug && p.dir !== info.sourceDir);
    if (conflict) throw new HttpError(409, `같은 URL(/posts/${slug})을 쓰는 게시글이 있습니다: ${conflict.dir}`);

    let target: { abs: string; rel: string };
    if (info.sourceDir) {
        target = { abs: postDirAbs(info.sourceDir), rel: info.sourceDir };
        if (!(await exists(path.join(target.abs, POST_FILE)))) throw new HttpError(404, "원본 게시글을 찾을 수 없습니다.");
        if (req.touchEditDate) meta.editDate = nowKst();
    } else {
        target = await resolveNewTarget(req.tree, req.folder);
    }

    const refs = referencedAttachments(parsed.body, meta.og);
    const draftAttachments = path.join(draftAbs, ATTACHMENT_DIR);
    const targetAttachments = path.join(target.abs, ATTACHMENT_DIR);
    const draftFiles = new Set(await listFiles(draftAttachments));
    const targetFiles = new Set(await listFiles(targetAttachments));
    const missing = [...refs].filter((name) => !draftFiles.has(name) && !targetFiles.has(name));
    if (missing.length > 0) throw new HttpError(400, `존재하지 않는 첨부파일을 참조합니다: ${missing.join(", ")}`);

    await fs.mkdir(targetAttachments, { recursive: true });
    for (const name of draftFiles) {
        if (refs.has(name)) await moveFile(path.join(draftAttachments, name), path.join(targetAttachments, name));
    }

    await fs.writeFile(path.join(target.abs, POST_FILE), serializePost(meta, parsed.body, parsed.doc), "utf8");
    notifyFileEvent(info.sourceDir ? "change" : "add", path.join(target.abs, POST_FILE));

    let pruned = false;
    for (const name of await listFiles(targetAttachments)) {
        if (refs.has(name)) continue;
        await fs.rm(path.join(targetAttachments, name), { force: true });
        pruned = true;
    }
    if ((await fs.readdir(targetAttachments)).length === 0) await fs.rmdir(targetAttachments);
    if (pruned) await dropStaleContentAssets();

    await deleteDraft(req.draftId);
    return { dir: toPosix(target.rel), slug };
}
