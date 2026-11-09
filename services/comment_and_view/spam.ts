const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function clientIp(req: Request): string {
    return req.headers.get("CF-Connecting-IP") ?? "unknown";
}

function ipv6Prefix64(ip: string): string {
    const [head = "", tail] = ip.split("::");
    const left = head.length > 0 ? head.split(":") : [];
    const right = tail !== undefined && tail.length > 0 ? tail.split(":") : [];
    const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
    return `${groups.slice(0, 4).map((g) => g.toLowerCase().padStart(4, "0")).join(":")}::/64`;
}

export function rateKey(req: Request): string {
    const ip = clientIp(req);
    return ip.includes(":") ? ipv6Prefix64(ip) : ip;
}

export async function withinLimit(limiter: RateLimit, key: string): Promise<boolean> {
    const { success } = await limiter.limit({ key });
    return success;
}

export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip !== "unknown") form.append("remoteip", ip);
    try {
        const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
        if (!res.ok) return false;
        const data = await res.json<{ success?: unknown }>();
        return data.success === true;
    } catch {
        return false;
    }
}
