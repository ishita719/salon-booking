import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { homeFor, loginFor, parseRole, Role } from "./roles";
import { CLIENT_DEVICE_MAX_AGE, SESSION_COOKIE, SESSION_MAX_AGE, signSession, STAFF_SESSION_MAX_AGE, verifySession } from "./session-token";
import { getStaffCode, staffCodeFingerprint } from "./settings";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  stylistId: string | null; // the staff member's bookable profile
}

/** rememberDevice: clients who sign in by QR / email code stay signed in on that phone for 6 months. */
export async function startSession(user: { id: string; role: string }, staffCode?: string, rememberDevice = false) {
  const role = parseRole(user.role);
  const maxAge = role === "STAFF" ? STAFF_SESSION_MAX_AGE : role === "CUSTOMER" && rememberDevice ? CLIENT_DEVICE_MAX_AGE : SESSION_MAX_AGE;
  const scv = role === "STAFF" && staffCode ? await staffCodeFingerprint(staffCode) : undefined;
  const token = await signSession(user.id, role, maxAge, scv);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable by JavaScript → protects against token theft via XSS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // blocks cross-site POSTs carrying the cookie (CSRF)
    path: "/",
    maxAge,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Current logged-in user, always re-read from the database, so deactivated accounts and role changes apply at once.
 * Staff sessions are also tied to the staff code: when the owner changes the code, all staff must log in again.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, claims.sub) });
  if (!user || !user.active) return null;
  const role = parseRole(user.role);
  if (role !== claims.role) return null;

  let stylistId: string | null = null;
  if (role === "STAFF") {
    const code = await getStaffCode();
    if (!code || !claims.scv || claims.scv !== (await staffCodeFingerprint(code))) return null;
    const stylist = await db.query.stylists.findFirst({ where: eq(schema.stylists.userId, user.id), columns: { id: true } });
    stylistId = stylist?.id ?? null;
  }
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role, stylistId };
}

/** For server pages: require one of the given roles, otherwise send the visitor to the right login or portal. */
export async function pageUser(roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginFor(roles[0]));
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
