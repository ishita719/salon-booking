// Roles and where each one lands after login. Edge-safe (used by middleware).

export const ROLES = ["CUSTOMER", "STAFF", "OWNER"] as const;
export type Role = (typeof ROLES)[number];

export function parseRole(v: unknown): Role {
  return v === "OWNER" || v === "STAFF" ? v : "CUSTOMER";
}

export function homeFor(role: Role): string {
  if (role === "OWNER") return "/owner";
  if (role === "STAFF") return "/staff";
  return "/account";
}

export const ROLE_LABEL: Record<Role, string> = { CUSTOMER: "Client", STAFF: "Staff", OWNER: "Owner" };
