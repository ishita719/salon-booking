// Easy sign-in helpers: phone matching, passwordless accounts, owner code, emailed codes and one-time login QR tokens.

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { DB, schema } from "@/db";
import { ApiError } from "./api";
import { SALON } from "./config";
import { sendEmail } from "./email";
import { getEnv } from "./env";
import { codesMatch, safeEqual, sha256Hex, verifyPassword } from "./password";

/** Temporary owner code until the owner sets their own (Settings → Owner code). */
export const TEMP_OWNER_CODE = "0092";

/** Phone as digits only, without the North American leading 1 (604-555-0123, +1 (604) 555 0123 → 6045550123). */
export function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/** Accounts created by scanning the salon QR have no password (they can add one later). */
export const NO_PASSWORD = "!passwordless";
export const hasPassword = (hash: string) => hash.startsWith("pbkdf2$");

/** Clients who skip email get a hidden placeholder address (never shown or emailed). */
export const placeholderEmail = () => `client-${crypto.randomUUID()}@no-email.invalid`;
export const isPlaceholderEmail = (e: string | null | undefined) => !!e && e.endsWith("@no-email.invalid");
export const realEmail = (e: string | null | undefined) => (e && !isPlaceholderEmail(e) ? e : null);

/** "j***@gmail.com" */
export function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  return `${u[0]}${"*".repeat(Math.max(2, Math.min(6, u.length - 1)))}@${d}`;
}

export async function ownerCodeMatches(user: { pinHash: string | null }, code: string): Promise<boolean> {
  if (!user.pinHash) return codesMatch(code, TEMP_OWNER_CODE);
  return verifyPassword(code.trim(), user.pinHash);
}

// ---------- Emailed 6-digit codes ----------

export type CodePurpose = "OWNER_SIGNUP" | "OWNER_RESET";
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (id: string, code: string) => sha256Hex(`${id}:${code}`);

/** Creates a code, emails it, and (only in local development without an email service) returns it so you can test. */
export async function sendVerificationCode(db: DB, email: string, purpose: CodePurpose): Promise<{ devCode?: string }> {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  const code = String(n).padStart(6, "0");
  const id = crypto.randomUUID();
  await db.insert(schema.verificationCodes).values({ id, email, purpose, codeHash: await hashCode(id, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  const what = purpose === "OWNER_RESET" ? "reset your owner code" : "create your owner account";
  await sendEmail(email, `${code} is your ${SALON.name} code`, `Your verification code to ${what} is:\n\n    ${code}\n\nIt expires in 10 minutes. If you didn't ask for this, you can ignore this email.`);
  const devMode = process.env.NODE_ENV !== "production" && !getEnv("RESEND_API_KEY");
  return devMode ? { devCode: code } : {};
}

/** Checks a code (single use, 10 minutes, 5 tries). Throws a friendly error if wrong. */
export async function checkVerificationCode(db: DB, email: string, purpose: CodePurpose, code: string): Promise<void> {
  const v = schema.verificationCodes;
  const row = await db.query.verificationCodes.findFirst({
    where: and(eq(v.email, email), eq(v.purpose, purpose), eq(v.used, false), gt(v.expiresAt, new Date())),
    orderBy: desc(v.createdAt),
  });
  if (!row) throw new ApiError(400, "That code has expired. Please request a new one.");
  if (row.attempts >= MAX_ATTEMPTS) throw new ApiError(429, "Too many wrong tries. Please request a new code.");
  await db.update(v).set({ attempts: row.attempts + 1 }).where(eq(v.id, row.id));
  const enc = new TextEncoder();
  if (!/^\d{6}$/.test(code.trim()) || !safeEqual(enc.encode(await hashCode(row.id, code.trim())), enc.encode(row.codeHash))) {
    throw new ApiError(400, `That code isn't right. ${MAX_ATTEMPTS - row.attempts - 1} tries left.`);
  }
  await db.update(v).set({ used: true }).where(eq(v.id, row.id));
}

// ---------- One-time "scan to log in" QR tokens ----------

const TOKEN_TTL_MS = 10 * 60 * 1000;

export async function createLoginToken(db: DB, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.insert(schema.loginTokens).values({ tokenHash: await sha256Hex(token), userId, expiresAt });
  return { token, expiresAt };
}

/** Returns the user id if the token is valid, and marks it used (works once). */
export async function consumeLoginToken(db: DB, token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const t = schema.loginTokens;
  const tokenHash = await sha256Hex(token);
  const [row] = await db
    .update(t)
    .set({ usedAt: new Date() })
    .where(and(eq(t.tokenHash, tokenHash), isNull(t.usedAt), gt(t.expiresAt, new Date())))
    .returning({ userId: t.userId });
  return row?.userId ?? null;
}
