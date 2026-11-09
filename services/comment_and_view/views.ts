import { error, json, type AppEnv } from "./http";
import { rateKey, withinLimit } from "./spam";

const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|scrape|monitor|headless|phantom|selenium|puppeteer|playwright|lighthouse|curl|wget|httpie|python|java\/|go-http|okhttp|axios|node-fetch|undici|libwww|postman|insomnia/i;
const UA_MAX = 512;
const V6_BITS = 56;
const FEED_TTL_MS = 5 * 60_000;
const FEED_REFRESH_ON_MISS_MS = 60_000;
const FEED_MAX_BYTES = 2 * 1024 * 1024;
const POST_PATH = /^\/posts\/([^/]+)\/?$/;

let cachedSalt: { day: string; salt: string } | null = null;
let cachedFeed: { slugs: Set<string>; fetchedAt: number } | null = null;
let cachedPepper: { secret: string; key: CryptoKey } | null = null;

function utcDay(now = new Date()): string {
    return now.toISOString().slice(0, 10);
}

function isLikelyBot(req: Request): boolean {
    const ua = req.headers.get("User-Agent") ?? "";
    return ua.length === 0 || ua.length > UA_MAX || BOT_UA.test(ua);
}

async function readCount(env: AppEnv, slug: string): Promise<number | null> {
    const row = await env.DB.prepare("SELECT count FROM views WHERE post_slug = ?").bind(slug).first<{ count: number }>();
    return row?.count ?? null;
}

async function daySalt(env: AppEnv, day: string): Promise<string> {
    if (cachedSalt?.day === day) return cachedSalt.salt;
    await env.DB.batch([
        env.DB.prepare("INSERT INTO view_salts (day, salt) VALUES (?1, lower(hex(randomblob(32)))) ON CONFLICT (day) DO NOTHING").bind(day),
        env.DB.prepare("DELETE FROM view_hits WHERE day < ?").bind(day),
        env.DB.prepare("DELETE FROM view_salts WHERE day < ?").bind(day),
    ]);
    const row = await env.DB.prepare("SELECT salt FROM view_salts WHERE day = ?").bind(day).first<{ salt: string }>();
    if (row === null) throw new Error("view salt missing");
    cachedSalt = { day, salt: row.salt };
    return row.salt;
}

async function pepperKey(secret: string): Promise<CryptoKey> {
    if (cachedPepper?.secret === secret) return cachedPepper.key;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    cachedPepper = { secret, key };
    return key;
}

async function visitorHash(env: AppEnv, salt: string, visitor: string, slug: string): Promise<string> {
    const secret = env.VIEW_PEPPER;
    if (typeof secret !== "string" || secret.length < 32) throw new Error("VIEW_PEPPER missing or too short");
    const data = new TextEncoder().encode(`${salt}\u0000${visitor}\u0000${slug}`);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await pepperKey(secret), data));
    return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

function parseFeedSlugs(xml: string, feedUrl: string): Set<string> {
    const slugs = new Set<string>();
    const origin = new URL(feedUrl).origin;
    for (const match of xml.matchAll(/<link>([^<]+)<\/link>/g)) {
        try {
            const url = new URL(match[1]!.trim().replaceAll("&amp;", "&"));
            if (url.origin !== origin) continue;
            const path = POST_PATH.exec(url.pathname);
            if (path?.[1] !== undefined) slugs.add(decodeURIComponent(path[1]).normalize("NFC"));
        } catch {
            continue;
        }
    }
    return slugs;
}

async function fetchFeed(feedUrl: string): Promise<Set<string> | null> {
    try {
        const res = await fetch(feedUrl, { cf: { cacheTtlByStatus: { "200-299": 60, "300-599": 0 } } });
        if (!res.ok) return null;
        const declared = Number(res.headers.get("Content-Length") ?? "0");
        if (declared > FEED_MAX_BYTES) return null;
        const text = await res.text();
        if (text.length > FEED_MAX_BYTES) return null;
        return parseFeedSlugs(text, feedUrl);
    } catch {
        return null;
    }
}

async function postExists(env: AppEnv, slug: string): Promise<boolean> {
    const feedUrl = env.POST_FEED_URL.trim();
    if (feedUrl.length === 0) return false;
    const now = Date.now();
    const age = cachedFeed === null ? Infinity : now - cachedFeed.fetchedAt;
    if (cachedFeed !== null && age < FEED_TTL_MS && cachedFeed.slugs.has(slug)) return true;
    if (cachedFeed !== null && age < FEED_REFRESH_ON_MISS_MS) return false;
    const slugs = await fetchFeed(feedUrl);
    if (slugs === null) return cachedFeed?.slugs.has(slug) ?? false;
    cachedFeed = { slugs, fetchedAt: now };
    return slugs.has(slug);
}

export async function getViews(req: Request, env: AppEnv, slug: string): Promise<Response> {
    if (!(await withinLimit(env.READ_LIMITER, rateKey(req)))) return error(429, "rate_limited");
    return json({ count: (await readCount(env, slug)) ?? 0 });
}

export async function recordView(req: Request, env: AppEnv, slug: string): Promise<Response> {
    const key = rateKey(req, V6_BITS);
    if (!(await withinLimit(env.VIEW_LIMITER, key))) return error(429, "rate_limited");

    const current = await readCount(env, slug);
    if (isLikelyBot(req)) return json({ count: current ?? 0, counted: false });
    if (current === null && !(await postExists(env, slug))) return error(404, "not_found");

    const day = utcDay();
    const visitor = await visitorHash(env, await daySalt(env, day), key, slug);
    const [, upsert] = await env.DB.batch<{ count: number }>([
        env.DB.prepare("INSERT INTO view_hits (day, visitor) VALUES (?, ?) ON CONFLICT (day, visitor) DO NOTHING").bind(day, visitor),
        env.DB.prepare(
            `INSERT INTO views (post_slug, count) SELECT ?, 1 WHERE changes() > 0
             ON CONFLICT (post_slug) DO UPDATE SET count = count + 1
             RETURNING count`,
        ).bind(slug),
    ]);
    const counted = upsert?.results[0];
    if (counted !== undefined) return json({ count: counted.count, counted: true });
    return json({ count: (await readCount(env, slug)) ?? 0, counted: false });
}
