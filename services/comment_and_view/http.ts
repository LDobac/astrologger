export type AppEnv = Env & { TURNSTILE_SECRET?: string };

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export const MAX_BODY_BYTES = 16 * 1024;

export function json(data: unknown, status = 200): Response {
    return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function error(status: number, code: string): Response {
    return json({ error: code }, status);
}

export function fail<T>(status: number, code: string): Result<T> {
    return { ok: false, status, error: code };
}

export function parseOrigins(value: string): Set<string> {
    return new Set(value.split(",").map((s) => s.trim()).filter((s) => s.length > 0));
}

export function corsHeaders(origin: string | null, allowed: Set<string>): Headers {
    const headers = new Headers({ Vary: "Origin" });
    if (origin !== null && allowed.has(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        headers.set("Access-Control-Max-Age", "7200");
    }
    return headers;
}

export function withHeaders(res: Response, extra: Headers): Response {
    const out = new Response(res.body, res);
    extra.forEach((value, key) => out.headers.set(key, value));
    return out;
}

export async function readJsonBody(req: Request): Promise<Result<unknown>> {
    const type = req.headers.get("Content-Type") ?? "";
    if (type.split(";")[0]?.trim().toLowerCase() !== "application/json") {
        return fail(415, "unsupported_media_type");
    }
    const declared = Number(req.headers.get("Content-Length") ?? "0");
    if (declared > MAX_BODY_BYTES) {
        return fail(413, "payload_too_large");
    }
    if (req.body === null) {
        return fail(400, "invalid_request");
    }
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
            await reader.cancel();
            return fail(413, "payload_too_large");
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes)) };
    } catch {
        return fail(400, "invalid_json");
    }
}
