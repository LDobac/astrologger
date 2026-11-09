const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 100_000;
const MAX_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

function fromBase64(value: string): Uint8Array | null {
    try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    } catch {
        return null;
    }
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, HASH_BITS);
    return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const derived = await derive(password, salt, ITERATIONS);
    return { hash: `${ALGORITHM}$${ITERATIONS}$${toBase64(derived)}`, salt: toBase64(salt) };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
    const [algorithm, iterationText, hashText, ...rest] = storedHash.split("$");
    if (algorithm !== ALGORITHM || iterationText === undefined || hashText === undefined || rest.length > 0) return false;
    const iterations = Number(iterationText);
    if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return false;
    const expected = fromBase64(hashText);
    const salt = fromBase64(storedSalt);
    if (expected === null || salt === null) return false;
    const actual = await derive(password, salt, iterations);
    if (actual.byteLength !== expected.byteLength) return false;
    return crypto.subtle.timingSafeEqual(actual, expected);
}
