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
  const what = purpose === "OWNER_RESET" ? "reset your owner secret code" : "create your owner account";
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

// ---------- Owner login by secret code ----------

/** The active owner whose secret code matches (owners still on the temporary code match TEMP_OWNER_CODE). */
export async function findOwnerByCode(db: DB, code: string) {
  const owners = await db.select().from(schema.users).where(and(eq(schema.users.role, "OWNER"), eq(schema.users.active, true)));
  for (const o of owners) if (await ownerCodeMatches(o, code)) return o;
  return null;
}

/** Secret codes must be unique between owners (the code alone identifies who is logging in). */
export async function ownerCodeInUse(db: DB, code: string, exceptUserId?: string): Promise<boolean> {
  if (await codesMatch(code, TEMP_OWNER_CODE)) return true;
  const owners = await db.select().from(schema.users).where(eq(schema.users.role, "OWNER"));
  for (const o of owners) if (o.id !== exceptUserId && o.pinHash && (await ownerCodeMatches(o, code))) return true;
  return false;
}

// Lockout across ALL devices (stored in the database): 10 wrong secret codes within 15 minutes → owner login closed for 15 minutes.
const GUARD_KEY = "owner_login_guard";
const GUARD_WINDOW = 15 * 60 * 1000;
const GUARD_MAX = 10;
type Guard = { fails: number; since: number; lockedUntil: number };

async function readGuard(db: DB): Promise<Guard> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, GUARD_KEY) });
  try {
    const g = JSON.parse(row?.value ?? "{}") as Partial<Guard>;
    return { fails: g.fails ?? 0, since: g.since ?? 0, lockedUntil: g.lockedUntil ?? 0 };
  } catch {
    return { fails: 0, since: 0, lockedUntil: 0 };
  }
}
async function writeGuard(db: DB, g: Guard) {
  const value = JSON.stringify(g);
  await db.insert(schema.settings).values({ key: GUARD_KEY, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

export async function assertOwnerLoginOpen(db: DB) {
  const g = await readGuard(db);
  if (g.lockedUntil > Date.now()) {
    const mins = Math.ceil((g.lockedUntil - Date.now()) / 60000);
    throw new ApiError(429, `Too many wrong secret codes. Owner login is locked for ${mins} more minute(s). Forgot your code? Use “Forgot secret code”.`);
  }
}

export async function recordOwnerLoginFailure(db: DB) {
  const now = Date.now();
  const g = await readGuard(db);
  const fresh = now - g.since > GUARD_WINDOW;
  const fails = (fresh ? 0 : g.fails) + 1;
  await writeGuard(db, { fails, since: fresh ? now : g.since, lockedUntil: fails >= GUARD_MAX ? now + GUARD_WINDOW : 0 });
}

export async function clearOwnerLoginFailures(db: DB) {
  await writeGuard(db, { fails: 0, since: 0, lockedUntil: 0 });
}
