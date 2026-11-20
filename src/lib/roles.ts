// Roles, their portals and their login pages. No database imports (used by middleware).

export const ROLES = ["CUSTOMER", "STAFF", "OWNER"] as const;
export type Role = (typeof ROLES)[number];

export function parseRole(v: unknown): Role {
  return v === "OWNER" || v === "STAFF" ? v : "CUSTOMER";
}

/** Where each role lands after logging in. */
export function homeFor(role: Role): string {
  if (role === "OWNER") return "/owner";
  if (role === "STAFF") return "/staff";
  return "/account";
}

/** Clients log in at /login; the salon team (owner + staff) at /team. */
export function loginFor(role: Role): string {
  return role === "CUSTOMER" ? "/login" : "/team";
}

export const ROLE_LABEL: Record<Role, string> = { CUSTOMER: "Client", STAFF: "Staff", OWNER: "Owner" };
