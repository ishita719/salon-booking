import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { NO_PASSWORD, ownerCodeInUse } from "@/lib/identity";
import { codesMatch, hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { getOwnerInvites, getStaffCode, setOwnerInvites, setStaffCode } from "@/lib/settings";
import { ownerSignupSchema } from "@/lib/validation";

async function ownerExists() {
  return !!(await getDb().query.users.findFirst({ where: eq(schema.users.role, "OWNER"), columns: { id: true } }));
}

// Is this the very first owner? (The sign-up page asks for the team secret code only then.)
export const GET = route(async () => {
  return NextResponse.json({ needed: !(await ownerExists()), teamCodeSet: !!(await getStaffCode()) });
});

// New owner account: name + email + secret code (the secret code is their login).
//  • First owner: allowed (plus SETUP_CODE if that secret is configured) and also sets the staff team code.
//  • More owners: the email must first be invited by an existing owner — otherwise anyone could make
//    themselves owner and see every client's details.
export const POST = route(async (req) => {
  rateLimit(`owner-signup:${clientIp(req)}`, 8, 60 * 60 * 1000);
  const data = ownerSignupSchema.parse(await req.json());
  const db = getDb();
  const first = !(await ownerExists());

  if (first) {
    const setup = getEnv("SETUP_CODE");
    if (setup && !(data.setupCode && (await codesMatch(data.setupCode, setup)))) throw new ApiError(403, "Enter the setup code from the website settings.");
    if (!data.teamCode) throw new ApiError(400, "Choose a team secret code for your staff.");
  } else if (!(await getOwnerInvites()).includes(data.email)) {
    throw new ApiError(403, "This email hasn't been invited. Ask an existing owner to invite you on Owner → Team → Co-owners.");
  }
  if (await db.query.users.findFirst({ where: eq(schema.users.email, data.email), columns: { id: true } })) {
    throw new ApiError(409, "That email already has an account.");
  }
  if (await ownerCodeInUse(db, data.ownerCode)) throw new ApiError(409, "That secret code can't be used — please choose a different one.");

  const [user] = await db
    .insert(schema.users)
    .values({ name: data.name, email: data.email, phone: "", phoneDigits: "", passwordHash: NO_PASSWORD, pinHash: await hashPassword(data.ownerCode), role: "OWNER" })
    .returning({ id: schema.users.id, role: schema.users.role });

  if (first && data.teamCode) await setStaffCode(data.teamCode);
  if (!first) await setOwnerInvites((await getOwnerInvites()).filter((e) => e !== data.email));
  await startSession(user);
  return NextResponse.json({ ok: true, home: "/owner" }, { status: 201 });
});
