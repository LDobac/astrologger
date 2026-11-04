import { slug as slugger } from "github-slugger";
import { EditorView, basicSetup } from "codemirror";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import type { EditorDoc, PostMeta, PostSummary, TreeNode, TreeResponse } from "../types";
import { api } from "./api";
import { insertCodeBlock, insertLink, insertText, setHeading, toggleWrap } from "./commands";
import { $, esc } from "./dom";
import { PreviewBridge } from "./preview";

const DEFAULT_OFFSET = "+09:00";
const REDIRECT_KEY = "editor:redirect";

const params = new URLSearchParams(location.search);
let doc: EditorDoc;
let tree: TreeResponse;
let tags: string[] = [];
let savedSnapshot = "";
let saving: Promise<void> | null = null;
let renderSeq = 0;
let renderTimer: number | undefined;
const dateOffsets = { date: DEFAULT_OFFSET, editDate: DEFAULT_OFFSET };

const bridge = new PreviewBridge($<HTMLIFrameElement>("#preview"));
const themeCompartment = new Compartment();
const isDark = () => document.documentElement.classList.contains("dark");

const inputs = {
    title: $<HTMLInputElement>("#m-title"),
    date: $<HTMLInputElement>("#m-date"),
    editDate: $<HTMLInputElement>("#m-edit"),
    description: $<HTMLTextAreaElement>("#m-desc"),
    series: $<HTMLInputElement>("#m-series"),
    tagInput: $<HTMLInputElement>("#m-tag-input"),
    ogImg: $<HTMLSelectElement>("#m-og"),
    ogAlt: $<HTMLInputElement>("#m-og-alt"),
};

function toast(message: string, isError = false) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.toggle("bg-red-600", isError);
    el.classList.toggle("bg-fg", !isError);
    el.classList.remove("hidden");
    window.clearTimeout(Number(el.dataset.timer));
    el.dataset.timer = String(window.setTimeout(() => el.classList.add("hidden"), isError ? 6000 : 2500));
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function splitDate(value: string): { local: string; offset: string } {
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(value.trim());
    if (!match) return { local: "", offset: DEFAULT_OFFSET };
    const offset = !match[2] || match[2] === "Z" ? (match[2] === "Z" ? "+00:00" : DEFAULT_OFFSET) : match[2];
    return { local: match[1].length === 16 ? `${match[1]}:00` : match[1], offset };
}

function joinDate(local: string, offset: string): string {
    if (!local) return "";
    return `${local.length === 16 ? `${local}:00` : local}${offset}`;
}

function readMeta(): PostMeta {
    const ogImg = inputs.ogImg.value;
    return {
        title: inputs.title.value.trim(),
        description: inputs.description.value.trim(),
        date: joinDate(inputs.date.value, dateOffsets.date),
        editDate: joinDate(inputs.editDate.value, dateOffsets.editDate),
        series: inputs.series.value.trim(),
        tags: [...tags],
        og: ogImg ? { img: ogImg, alt: inputs.ogAlt.value.trim() } : null,
    };
}

function snapshot(): string {
    return JSON.stringify({ meta: readMeta(), body: view.state.doc.toString() });
}

function isDirty(): boolean {
    return snapshot() !== savedSnapshot;
}

function updateStatus(text?: string) {
    const status = $("#status");
    if (text) status.textContent = text;
    else if (isDirty()) status.textContent = "● 저장되지 않은 변경";
    else if (doc.updatedAt) status.textContent = `임시 저장됨 ${doc.updatedAt.slice(11, 19)}`;
    else status.textContent = doc.sourceDir ? "원본" : "새 글";
}

function renderTags() {
    const container = $("#m-tags");
    container.querySelectorAll("[data-tag]").forEach((el) => el.remove());
    for (const tag of tags) {
        const chip = document.createElement("span");
        chip.dataset.tag = tag;
        chip.className = "flex items-center gap-1 rounded-2xl border border-line px-2 text-sm";
        chip.innerHTML = `${esc(tag)}<button type="button" class="text-fg-muted hover:text-red-500" aria-label="${esc(tag)} 제거">×</button>`;
        container.insertBefore(chip, inputs.tagInput);
    }
}

function addTag(raw: string) {
    const tag = raw.trim().replace(/,$/, "").trim();
    if (tag && !tags.includes(tag)) {
        tags.push(tag);
        renderTags();
        onChange();
    }
    inputs.tagInput.value = "";
}

function fillOgOptions(selected: string) {
    const options = [`<option value="">(자동 생성 썸네일)</option>`];
    for (const ref of doc.attachments) {
        options.push(`<option value="${esc(ref)}">${esc(ref.replace("./attachments/", ""))}</option>`);
    }
    if (selected && !doc.attachments.includes(selected)) {
        options.push(`<option value="${esc(selected)}">${esc(selected)} (없음)</option>`);
    }
    inputs.ogImg.innerHTML = options.join("");
    inputs.ogImg.value = selected;
}

function fillMeta(meta: PostMeta) {
    inputs.title.value = meta.title;
    inputs.description.value = meta.description;
    const date = splitDate(meta.date);
    const editDate = splitDate(meta.editDate);
    inputs.date.value = date.local;
    inputs.editDate.value = editDate.local;
    dateOffsets.date = date.offset;
    dateOffsets.editDate = editDate.offset;
    inputs.series.value = meta.series;
    tags = [...meta.tags];
    renderTags();
    fillOgOptions(meta.og?.img ?? "");
    inputs.ogAlt.value = meta.og?.alt ?? "";
}

function fillDatalist(id: string, values: string[]) {
    $(id).innerHTML = values.map((v) => `<option value="${esc(v)}"></option>`).join("");
}

function collectTrees(node: TreeNode, out: string[] = []): string[] {
    for (const child of node.trees) {
        out.push(child.path);
        collectTrees(child, out);
    }
    return out;
}

function updateSlugHint() {
    const title = inputs.title.value.trim();
    const slug = title ? slugger(title) : "";
    const hint = $("#m-slug");
    if (!slug) {
        hint.textContent = "";
        return;
    }
    const conflict = tree?.posts.find((p) => p.slug === slug && p.dir !== doc.sourceDir);
    const changed = doc.sourceTitle && slugger(doc.sourceTitle) !== slug;
    hint.textContent = `/posts/${slug}${conflict ? ` — ⚠ ${conflict.dir}와 URL 충돌` : changed ? " — ⚠ 제목 변경으로 URL이 바뀝니다" : ""}`;
    hint.classList.toggle("text-red-500", !!conflict);
}

function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderPreview, 250);
}

async function renderPreview() {
    const seq = ++renderSeq;
    const meta = readMeta();
    const target = { draft: doc.draftId, source: doc.sourceDir };
    try {
        const { html } = await api.render(target, view.state.doc.toString(), meta);
        if (seq !== renderSeq) return;
        bridge.post({
            type: "render",
            html,
            meta,
            ogUrl: meta.og ? api.fileUrl(target, meta.og.img) : null,
            thumbUrl: doc.sourceTitle && doc.sourceTitle === meta.title ? `/image/thumbnail/${slugger(meta.title)}.svg` : null,
            dark: isDark(),
        });
    } catch (error) {
        if (seq === renderSeq) toast(`미리보기 실패: ${errorMessage(error)}`, true);
    }
}

function onChange() {
    updateStatus();
    updateSlugHint();
    scheduleRender();
}

function setDraftId(id: string) {
    doc.draftId = id;
    const url = new URL(location.href);
    url.search = new URLSearchParams({ draft: id }).toString();
    history.replaceState(null, "", url);
    updateHeader();
}

function updateHeader() {
    $("#doc-kind").textContent = doc.sourceDir ? "수정" : "신규";
    $("#doc-source").textContent = doc.sourceDir ?? (doc.draftId ? `_draft/${doc.draftId}` : "저장 전");
    $<HTMLButtonElement>("#btn-discard").disabled = !doc.draftId;
    $("#btn-delete").classList.toggle("hidden", !doc.sourceDir);
}

async function save(): Promise<void> {
    if (saving) await saving;
    saving = (async () => {
        const current = snapshot();
        const result = await api.save({
            draftId: doc.draftId,
            sourceDir: doc.sourceDir,
            meta: readMeta(),
            body: view.state.doc.toString(),
        });
        doc.updatedAt = result.updatedAt;
        savedSnapshot = current;
        if (doc.draftId !== result.draftId) setDraftId(result.draftId);
        updateStatus();
    })();
    try {
        await saving;
    } finally {
        saving = null;
    }
}

async function saveWithToast() {
    try {
        await save();
        toast("임시 저장했습니다.");
    } catch (error) {
        toast(`임시 저장 실패: ${errorMessage(error)}`, true);
    }
}

async function uploadFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    try {
        if (!doc.draftId) await save();
        const inserted: string[] = [];
        for (const file of images) {
            const { path } = await api.upload(doc.draftId!, file);
            if (!doc.attachments.includes(path)) doc.attachments.push(path);
            const alt = file.name.replace(/\.[^.]*$/, "");
            inserted.push(`![${alt}](${path})`);
        }
        doc.attachments.sort();
        fillOgOptions(inputs.ogImg.value);
        insertText(view, inserted.join("\n\n"));
        toast(`이미지 ${inserted.length}개를 첨부했습니다.`);
    } catch (error) {
        toast(`이미지 첨부 실패: ${errorMessage(error)}`, true);
    }
}

function openFilePicker() {
    $<HTMLInputElement>("#file-input").click();
    return true;
}

function renderLinkResults(term: string) {
    const lower = term.trim().toLowerCase();
    const results = tree.posts
        .filter((p) => p.dir !== doc.sourceDir && (!lower || p.title.toLowerCase().includes(lower)))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 50);
    $("#link-results").innerHTML = results.length
        ? results
              .map(
                  (p, i) => `<li><button type="button" data-slug="${esc(p.slug)}" data-title="${esc(p.title)}" class="flex w-full justify-between gap-3 rounded px-3 py-2 text-left hover:bg-canvas-subtle ${i === 0 ? "bg-canvas-subtle" : ""}">
                    <span class="truncate">${esc(p.title)}</span><span class="shrink-0 text-xs text-fg-muted">${esc(p.date.slice(0, 10))}</span></button></li>`,
              )
              .join("")
        : `<li class="px-3 py-2 text-fg-muted">결과 없음</li>`;
}

function openLinkDialog() {
    const dialog = $<HTMLDialogElement>("#link-dialog");
    const search = $<HTMLInputElement>("#link-search");
    search.value = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
    renderLinkResults(search.value);
    dialog.showModal();
    search.select();
    return true;
}

function pickLink(post: Pick<PostSummary, "slug" | "title">) {
    $<HTMLDialogElement>("#link-dialog").close();
    const { from, to } = view.state.selection.main;
    const label = from === to ? post.title : view.state.sliceDoc(from, to);
    insertLink(view, label, `/posts/${post.slug}`);
}

const commands: Record<string, () => boolean> = {
    bold: () => toggleWrap(view, "**"),
    italic: () => toggleWrap(view, "*"),
    strike: () => toggleWrap(view, "~~"),
    code: () => toggleWrap(view, "`"),
    h2: () => setHeading(view, 2),
    h3: () => setHeading(view, 3),
    h4: () => setHeading(view, 4),
    link: () => insertLink(view),
    "post-link": openLinkDialog,
    image: openFilePicker,
    codeblock: () => insertCodeBlock(view),
};

const view = new EditorView({
    parent: $("#editor"),
    state: EditorState.create({
        doc: "",
        extensions: [
            Prec.highest(
                keymap.of([
                    { key: "Mod-b", run: commands.bold },
                    { key: "Mod-i", run: commands.italic },
                    { key: "Mod-Shift-x", run: commands.strike },
                    { key: "Mod-`", run: commands.code },
                    { key: "Mod-k", run: commands.link },
                    { key: "Mod-Alt-k", run: commands["post-link"] },
                    { key: "Mod-Alt-i", run: commands.image },
                    { key: "Mod-Alt-c", run: commands.codeblock },
                    { key: "Mod-Alt-2", run: commands.h2 },
                    { key: "Mod-Alt-3", run: commands.h3 },
                    { key: "Mod-Alt-4", run: commands.h4 },
                ]),
            ),
            basicSetup,
            markdown({ base: markdownLanguage, codeLanguages: languages }),
            EditorView.lineWrapping,
            themeCompartment.of(isDark() ? oneDark : []),
            EditorView.theme({
                "&": { height: "100%", fontSize: "14px" },
                ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace" },
                ".cm-content": { paddingBottom: "40vh" },
            }),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) onChange();
            }),
            EditorView.domEventHandlers({
                paste(event) {
                    const files = [...(event.clipboardData?.files ?? [])];
                    if (!files.some((f) => f.type.startsWith("image/"))) return false;
                    event.preventDefault();
                    void uploadFiles(files);
                    return true;
                },
                drop(event, editor) {
                    const files = [...(event.dataTransfer?.files ?? [])];
                    if (!files.some((f) => f.type.startsWith("image/"))) return false;
                    event.preventDefault();
                    const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY });
                    if (pos != null) editor.dispatch({ selection: { anchor: pos } });
                    void uploadFiles(files);
                    return true;
                },
            }),
        ],
    }),
});

view.scrollDOM.addEventListener("scroll", () => {
    const el = view.scrollDOM;
    const max = el.scrollHeight - el.clientHeight;
    bridge.post({ type: "scroll", ratio: max > 0 ? el.scrollTop / max : 0 });
});

function defaultFolder(): string {
    const date = (readMeta().date || "").slice(0, 10);
    const title = slugger(inputs.title.value.trim());
    return [date, title].filter(Boolean).join("-");
}

function updatePublishPreview() {
    const slug = slugger(inputs.title.value.trim());
    const path = doc.sourceDir
        ? doc.sourceDir
        : [$<HTMLInputElement>("#pub-tree").value.trim().replace(/^\/+|\/+$/g, ""), $<HTMLInputElement>("#pub-folder").value.trim()]
              .filter(Boolean)
              .join("/");
    $("#pub-path").textContent = `src/content/posts/${path}/index.md`;
    $("#pub-url").textContent = `/posts/${slug}`;

    const warnings: string[] = [];
    const conflict = tree.posts.find((p) => p.slug === slug && p.dir !== doc.sourceDir);
    if (conflict) warnings.push(`같은 URL을 쓰는 게시글이 있습니다: ${conflict.dir}`);
    if (doc.sourceTitle && slugger(doc.sourceTitle) !== slug) warnings.push("제목이 바뀌어 기존 URL이 더 이상 동작하지 않습니다.");
    const warn = $("#pub-warn");
    warn.textContent = warnings.join(" ");
    warn.classList.toggle("hidden", warnings.length === 0);
}

function openPublishDialog() {
    if (!inputs.title.value.trim()) {
        toast("제목을 입력하세요.", true);
        inputs.title.focus();
        return;
    }
    if (!inputs.date.value) {
        toast("작성일을 입력하세요.", true);
        inputs.date.focus();
        return;
    }
    $("#pub-new").classList.toggle("hidden", !!doc.sourceDir);
    $("#pub-edit").classList.toggle("hidden", !doc.sourceDir);
    $("#pub-error").classList.add("hidden");
    if (!doc.sourceDir) $<HTMLInputElement>("#pub-folder").value = defaultFolder();
    updatePublishPreview();
    $<HTMLDialogElement>("#publish-dialog").showModal();
}

async function waitForPage(url: string) {
    for (let i = 0; i < 20; i++) {
        try {
            if ((await fetch(url, { method: "HEAD" })).ok) return;
        } catch {
            continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

async function publish() {
    const submit = $<HTMLButtonElement>("#pub-submit");
    const errorBox = $("#pub-error");
    submit.disabled = true;
    errorBox.classList.add("hidden");
    try {
        await save();
        sessionStorage.setItem(REDIRECT_KEY, `/posts/${slugger(readMeta().title)}`);
        const result = await api.publish({
            draftId: doc.draftId!,
            tree: $<HTMLInputElement>("#pub-tree").value.trim().replace(/^\/+|\/+$/g, ""),
            folder: $<HTMLInputElement>("#pub-folder").value.trim(),
            touchEditDate: $<HTMLInputElement>("#pub-touch").checked,
        });
        savedSnapshot = snapshot();
        $("#pub-submit").textContent = "페이지 생성 대기 중…";
        const url = `/posts/${result.slug}`;
        sessionStorage.setItem(REDIRECT_KEY, url);
        await waitForPage(url);
        sessionStorage.removeItem(REDIRECT_KEY);
        location.href = url;
    } catch (error) {
        sessionStorage.removeItem(REDIRECT_KEY);
        errorBox.textContent = errorMessage(error);
        errorBox.classList.remove("hidden");
        submit.disabled = false;
    }
}

async function discard() {
    if (!doc.draftId) return;
    const message = doc.sourceDir
        ? "임시 저장본을 폐기하고 원본 게시글로 되돌릴까요?"
        : "임시 저장 글을 폐기할까요? 업로드한 첨부파일도 함께 삭제됩니다.";
    if (!confirm(message)) return;
    try {
        await api.discard(doc.draftId);
        savedSnapshot = snapshot();
        location.href = doc.sourceDir ? `/__editor/edit?source=${encodeURIComponent(doc.sourceDir)}` : "/__editor";
    } catch (error) {
        toast(`폐기 실패: ${errorMessage(error)}`, true);
    }
}

async function deletePost() {
    if (!doc.sourceDir) return;
    const title = doc.sourceTitle ?? doc.sourceDir;
    if (!confirm(`'${title}' 게시글을 삭제할까요?\n\n${doc.sourceDir} 폴더와 첨부파일, 임시 저장본이 모두 삭제되며 되돌릴 수 없습니다.`)) return;
    try {
        await api.deletePost(doc.sourceDir);
        savedSnapshot = snapshot();
        sessionStorage.setItem(REDIRECT_KEY, "/__editor");
        location.href = "/__editor";
    } catch (error) {
        sessionStorage.removeItem(REDIRECT_KEY);
        toast(`삭제 실패: ${errorMessage(error)}`, true);
    }
}

function bindEvents() {
    for (const el of [inputs.title, inputs.date, inputs.editDate, inputs.description, inputs.series, inputs.ogImg, inputs.ogAlt]) {
        el.addEventListener("input", onChange);
    }

    inputs.tagInput.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTag(inputs.tagInput.value);
        } else if (event.key === "Backspace" && !inputs.tagInput.value && tags.length > 0) {
            tags.pop();
            renderTags();
            onChange();
        }
    });
    inputs.tagInput.addEventListener("input", (event) => {
        const inputType = (event as InputEvent).inputType;
        if ((!inputType || inputType === "insertReplacementText") && tree.tags.includes(inputs.tagInput.value)) {
            addTag(inputs.tagInput.value);
        }
    });
    inputs.tagInput.addEventListener("blur", () => {
        if (inputs.tagInput.value.trim()) addTag(inputs.tagInput.value);
    });
    $("#m-tags").addEventListener("click", (event) => {
        const chip = (event.target as Element).closest<HTMLElement>("[data-tag]");
        if (chip && (event.target as Element).closest("button")) {
            tags = tags.filter((t) => t !== chip.dataset.tag);
            renderTags();
            onChange();
        } else {
            inputs.tagInput.focus();
        }
    });

    $("#toolbar").addEventListener("click", (event) => {
        const button = (event.target as Element).closest<HTMLElement>("[data-cmd]");
        if (button) commands[button.dataset.cmd!]?.();
    });

    $<HTMLInputElement>("#file-input").addEventListener("change", (event) => {
        const input = event.target as HTMLInputElement;
        void uploadFiles([...(input.files ?? [])]);
        input.value = "";
    });

    $("#link-search").addEventListener("input", (event) => renderLinkResults((event.target as HTMLInputElement).value));
    $("#link-search").addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const first = $("#link-results").querySelector<HTMLElement>("[data-slug]");
        if (first) pickLink({ slug: first.dataset.slug!, title: first.dataset.title! });
    });
    $("#link-results").addEventListener("click", (event) => {
        const button = (event.target as Element).closest<HTMLElement>("[data-slug]");
        if (button) pickLink({ slug: button.dataset.slug!, title: button.dataset.title! });
    });
    $("#link-dialog").addEventListener("close", () => view.focus());

    $("#btn-meta").addEventListener("click", () => $("#meta").classList.toggle("hidden"));
    $("#btn-save").addEventListener("click", () => void saveWithToast());
    $("#btn-discard").addEventListener("click", () => void discard());
    $("#btn-delete").addEventListener("click", () => void deletePost());
    $("#btn-publish").addEventListener("click", openPublishDialog);
    $("#pub-cancel").addEventListener("click", () => $<HTMLDialogElement>("#publish-dialog").close());
    $("#pub-tree").addEventListener("input", updatePublishPreview);
    $("#pub-folder").addEventListener("input", updatePublishPreview);
    $("#publish-form").addEventListener("submit", (event) => {
        event.preventDefault();
        void publish();
    });

    window.addEventListener(
        "keydown",
        (event) => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void saveWithToast();
            }
        },
        true,
    );

    window.addEventListener("beforeunload", (event) => {
        if (isDirty()) event.preventDefault();
    });

    new MutationObserver(() => {
        view.dispatch({ effects: themeCompartment.reconfigure(isDark() ? oneDark : []) });
        scheduleRender();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

async function init() {
    const redirect = sessionStorage.getItem(REDIRECT_KEY);
    if (redirect) {
        sessionStorage.removeItem(REDIRECT_KEY);
        updateStatus("페이지 생성 대기 중…");
        await waitForPage(redirect);
        location.replace(redirect);
        return;
    }

    const source = params.get("source");
    const draft = params.get("draft");
    [doc, tree] = await Promise.all([api.doc({ draft, source }), api.tree()]);

    fillDatalist("#tag-list", tree.tags);
    fillDatalist("#series-list", tree.series);
    fillDatalist("#tree-list", collectTrees(tree.root));
    fillMeta(doc.meta);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc.body } });
    savedSnapshot = snapshot();

    if (doc.draftId && doc.draftId !== draft) setDraftId(doc.draftId);
    if (source && doc.draftId) toast("이어서 편집할 임시 저장본을 불러왔습니다.");

    updateHeader();
    updateStatus();
    updateSlugHint();
    bindEvents();
    await renderPreview();
    view.focus();
}

init().catch((error) => {
    updateStatus(`불러오기 실패: ${errorMessage(error)}`);
    toast(`불러오기 실패: ${errorMessage(error)}`, true);
});
