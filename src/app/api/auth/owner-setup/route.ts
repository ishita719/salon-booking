import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { NO_PASSWORD, ownerCodeInUse, realEmail } from "@/lib/identity";
import { codesMatch, hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { getPendingOwnerIds, getStaffCode, setPendingOwnerIds, setStaffCode } from "@/lib/settings";
import { ownerSignupSchema } from "@/lib/validation";

async function ownerExists() {
  return !!(await getDb().query.users.findFirst({ where: eq(schema.users.role, "OWNER"), columns: { id: true } }));
}

// Is this the very first owner? (The sign-up page asks for the team secret code only then.)
export const GET = route(async () => {
  return NextResponse.json({ needed: !(await ownerExists()), teamCodeSet: !!(await getStaffCode()) });
});

// New owner account: name + email + secret code (the secret code is their login).
//  • First owner: active straight away (plus SETUP_CODE if that secret is configured); also sets the staff team code.
//  • More owners: the account is created but stays PENDING until an existing owner approves it on Owner → Team.
//    Otherwise anyone on the internet could make themselves owner and see every client's details.
export const POST = route(async (req) => {
  rateLimit(`owner-signup:${clientIp(req)}`, 5, 60 * 60 * 1000);
  const data = ownerSignupSchema.parse(await req.json());
  const db = getDb();
  const first = !(await ownerExists());

  if (first) {
    const setup = getEnv("SETUP_CODE");
    if (setup && !(data.setupCode && (await codesMatch(data.setupCode, setup)))) throw new ApiError(403, "Enter the setup code from the website settings.");
    if (!data.teamCode) throw new ApiError(400, "Choose a team secret code for your staff.");
  } else if ((await getPendingOwnerIds()).length >= 20) {
    throw new ApiError(429, "Too many owner requests are waiting. Ask an existing owner to review them first.");
  }
  if (await db.query.users.findFirst({ where: eq(schema.users.email, data.email), columns: { id: true } })) {
    throw new ApiError(409, "That email already has an account.");
  }
  if (await ownerCodeInUse(db, data.ownerCode)) throw new ApiError(409, "That secret code can't be used — please choose a different one.");

  const [user] = await db
    .insert(schema.users)
    .values({ name: data.name, email: data.email, phone: "", phoneDigits: "", passwordHash: NO_PASSWORD, pinHash: await hashPassword(data.ownerCode), role: "OWNER", active: first })
    .returning({ id: schema.users.id, role: schema.users.role });

  if (first) {
    if (data.teamCode) await setStaffCode(data.teamCode);
    await startSession(user);
    return NextResponse.json({ ok: true, home: "/owner" }, { status: 201 });
  }

  await setPendingOwnerIds([...(await getPendingOwnerIds()), user.id]);
  const owners = await db.select({ email: schema.users.email }).from(schema.users).where(and(eq(schema.users.role, "OWNER"), eq(schema.users.active, true)));
  for (const o of owners) {
    const to = realEmail(o.email);
    if (to) {
      await sendEmail(
        to,
        "New owner account request",
        `${data.name} (${data.email}) asked for an owner account on the salon website.\n\nApprove or decline it on Owner → Team → Co-owners. If you don't know this person, decline it.`,
      ).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true, pending: true }, { status: 202 });
});
