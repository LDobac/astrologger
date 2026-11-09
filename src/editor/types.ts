export interface PostMeta {
    title: string;
    description: string;
    date: string;
    editDate: string;
    series: string;
    tags: string[];
    og: { img: string; alt: string } | null;
}

export interface PostSummary {
    dir: string;
    title: string;
    date: string;
    slug: string;
    series: string;
    tags: string[];
}

export interface TreeNode {
    name: string;
    path: string;
    trees: TreeNode[];
    posts: PostSummary[];
}

export interface DraftSummary {
    id: string;
    sourceDir: string | null;
    title: string;
    updatedAt: string;
}

export interface TreeResponse {
    root: TreeNode;
    posts: PostSummary[];
    drafts: DraftSummary[];
    tags: string[];
    series: string[];
}

export interface EditorDoc {
    draftId: string | null;
    sourceDir: string | null;
    sourceTitle: string | null;
    meta: PostMeta;
    body: string;
    attachments: string[];
    updatedAt: string | null;
}

export interface SaveRequest {
    draftId: string | null;
    sourceDir: string | null;
    meta: PostMeta;
    body: string;
}

export interface PublishRequest {
    draftId: string;
    tree: string;
    folder: string;
    touchEditDate: boolean;
}

export interface PublishResponse {
    dir: string;
    slug: string;
}

export interface AdminComment {
    id: number;
    parentId: number | null;
    nickname: string;
    content: string;
    createdAt: string;
    updatedAt: string | null;
    isAdmin: boolean;
    postSlug: string;
    email: string | null;
    notifiedAt: string | null;
}

export interface AdminCommentsResponse {
    apiUrl: string;
    comments: AdminComment[];
    posts: Record<string, { title: string; url: string }>;
}

export interface ReplyResponse {
    reply: AdminComment;
    mail: "sent" | "none" | "failed";
    error?: string;
}
