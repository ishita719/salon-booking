// Session token signing/verification. Used by middleware too, so no database imports here.

import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "./env";
import { parseRole, Role } from "./roles";

export const SESSION_COOKIE = "salon_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (clients, owner)
export const CLIENT_DEVICE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days — client signed in by QR / email code on their own phone
export const STAFF_SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours — staff re-enter the staff code each shift

function secretKey(): Uint8Array {
  const s = getEnv("AUTH_SECRET");
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short (needs 32+ characters). See .env.example.");
  }
  return new TextEncoder().encode(s);
}

export interface SessionClaims {
  sub: string;
  role: Role;
  scv?: string; // staff only: fingerprint of the staff code used at login
}

export async function signSession(userId: string, role: string, maxAgeSec: number, scv?: string): Promise<string> {
  return new SignJWT({ role: parseRole(role), ...(scv ? { scv } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub, role: parseRole(payload.role), scv: typeof payload.scv === "string" ? payload.scv : undefined };
  } catch {
    return null;
  }
}
