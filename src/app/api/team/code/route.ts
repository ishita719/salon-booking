import { NextResponse } from "next/server";
import { ApiError, requireOwner, route } from "@/lib/api";
import { generateStaffCode, getStaffCode, setStaffCode } from "@/lib/settings";
import { staffCodeSchema } from "@/lib/validation";

// Owner only: see the current staff code.
export const GET = route(async () => {
  await requireOwner();
  return NextResponse.json({ code: await getStaffCode() });
});

// Owner only: set a new staff code (your own or a random one). Changing it logs out every staff member;
// they need the new code to log in or to create an account.
export const PUT = route(async (req) => {
  await requireOwner();
  const body = staffCodeSchema.parse(await req.json());
  const code = body.generate ? generateStaffCode() : body.code;
  if (!code) throw new ApiError(400, "Enter a code or choose Generate.");
  await setStaffCode(code);
  return NextResponse.json({ code });
});
