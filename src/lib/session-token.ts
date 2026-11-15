// Session token signing/verification. Edge-safe (used by middleware), so no database imports here.

import { SignJWT, jwtVerify } from "jose";
import { parseRole, Role } from "./roles";

export const SESSION_COOKIE = "salon_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short (needs 32+ characters). See .env.example.");
  }
  return new TextEncoder().encode(s);
}

export interface SessionClaims {
  sub: string;
  role: Role;
}

export async function signSession(userId: string, role: string): Promise<string> {
  return new SignJWT({ role: parseRole(role) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub, role: parseRole(payload.role) };
  } catch {
    return null;
  }
}
