// Password hashing with PBKDF2-SHA256 (built into Cloudflare Workers via Web Crypto — fast, no extra libraries).
// Stored format: pbkdf2$<iterations>$<salt base64>$<hash base64>

const ITERATIONS = 100_000; // Cloudflare's maximum for PBKDF2
const enc = new TextEncoder();

const toB64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Compares two byte arrays without leaking timing information. */
export function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  const n = Number(iter);
  if (!Number.isInteger(n) || n < 1 || n > ITERATIONS) return false;
  const actual = await derive(password, fromB64(salt), n);
  return safeEqual(actual, fromB64(hash));
}

/** A fixed hash used when the email doesn't exist, so login takes the same time either way. */
export const DUMMY_HASH = "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** SHA-256 of a string, as hex. */
export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison for codes (staff code, setup code). Not case-sensitive. */
export async function codesMatch(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(given.trim().toUpperCase()), sha256Hex(expected.trim().toUpperCase())]);
  return safeEqual(enc.encode(a), enc.encode(b));
}
