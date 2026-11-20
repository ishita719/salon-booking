import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sha256Hex } from "./password";

const STAFF_CODE = "staff_code";

/** The owner-set code staff must enter to create an account and every time they log in. */
export async function getStaffCode(): Promise<string | null> {
  const row = await getDb().query.settings.findFirst({ where: eq(schema.settings.key, STAFF_CODE) });
  return row?.value ?? null;
}

export async function setStaffCode(code: string): Promise<void> {
  await getDb()
    .insert(schema.settings)
    .values({ key: STAFF_CODE, value: code })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: code, updatedAt: new Date() } });
}

/** Short fingerprint of the staff code, stored in staff sessions: changing the code logs every staff member out. */
export async function staffCodeFingerprint(code: string): Promise<string> {
  return (await sha256Hex(`staff-code:${code.trim()}`)).slice(0, 16);
}

/** A readable random code like "MM-7K4Q-92XD" (no 0/O/1/I to avoid mix-ups). */
export function generateStaffCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `MM-${chars.slice(0, 4)}-${chars.slice(4)}`;
}
