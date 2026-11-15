import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { homeFor, parseRole, Role } from "./roles";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  stylistId: string | null; // the staff member's bookable profile
}

export async function startSession(user: { id: string; role: string }) {
  const token = await signSession(user.id, user.role);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable by JavaScript → protects against token theft via XSS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // blocks cross-site POSTs carrying the cookie (CSRF)
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Current logged-in user, always re-read from the database, so a deactivated staff member or a
 * changed role takes effect immediately even if their cookie is still valid.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, name: true, email: true, phone: true, role: true, active: true, stylist: { select: { id: true } } },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: parseRole(user.role),
    stylistId: user.stylist?.id ?? null,
  };
}

/** For server pages: require one of the given roles, otherwise send the visitor somewhere sensible. */
export async function pageUser(roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
