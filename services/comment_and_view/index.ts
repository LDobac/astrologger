import { routeAdmin } from "./admin";
import { createComment, deleteComment, listComments, updateComment } from "./comments";
import { corsHeaders, error, parseOrigins, withHeaders, type AppEnv } from "./http";
import { parseId, parseSlug } from "./validate";
import { getViews, recordView } from "./views";

const ITEM_PATH = /^\/comments\/([^/]+)$/;
const VIEW_PATH = /^\/views\/([^/]+)$/;

function decodeSlug(raw: string): string | null {
    try {
        return parseSlug(decodeURIComponent(raw));
    } catch {
        return null;
    }
}

async function route(req: Request, env: AppEnv, origin: string | null, allowed: Set<string>): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/admin/")) return routeAdmin(req, env, url);

    if (req.method === "OPTIONS") {
        return origin !== null && allowed.has(origin) ? new Response(null, { status: 204 }) : error(403, "forbidden_origin");
    }

    if (req.method !== "GET" && origin !== null && !allowed.has(origin)) {
        return error(403, "forbidden_origin");
    }

    if (url.pathname === "/comments") {
        if (req.method === "GET") {
            const slug = parseSlug(url.searchParams.get("slug"));
            return slug === null ? error(400, "invalid_slug") : listComments(req, env, slug);
        }
        if (req.method === "POST") return createComment(req, env);
        return error(405, "method_not_allowed");
    }

    const match = ITEM_PATH.exec(url.pathname);
    if (match?.[1] !== undefined) {
        const id = parseId(match[1]);
        if (id === null) return error(404, "not_found");
        if (req.method === "PATCH") return updateComment(req, env, id);
        if (req.method === "DELETE") return deleteComment(req, env, id);
        return error(405, "method_not_allowed");
    }

    const view = VIEW_PATH.exec(url.pathname);
    if (view?.[1] !== undefined) {
        const slug = decodeSlug(view[1]);
        if (slug === null) return error(400, "invalid_slug");
        if (req.method === "GET") return getViews(req, env, slug);
        if (req.method === "POST") {
            return origin !== null && allowed.has(origin) ? recordView(req, env, slug) : error(403, "forbidden_origin");
        }
        return error(405, "method_not_allowed");
    }

    return error(404, "not_found");
}

export default {
    async fetch(req, env): Promise<Response> {
        const origin = req.headers.get("Origin");
        const allowed = parseOrigins(env.ALLOWED_ORIGINS);
        const cors = corsHeaders(origin, allowed);
        try {
            return withHeaders(await route(req, env, origin, allowed), cors);
        } catch (e) {
            console.error(e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
            return withHeaders(error(500, "internal_error"), cors);
        }
    },
} satisfies ExportedHandler<AppEnv>;
