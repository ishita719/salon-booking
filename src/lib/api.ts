import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser, SessionUser } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler: origin check for writes + consistent JSON errors (no stack traces leak). */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const msg = e.issues[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      if (e instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

/** CSRF defence in depth: state-changing requests must come from our own site. */
function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; the SameSite cookie still protects sessions
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "Invalid origin");
  }
  if (originHost !== host) throw new ApiError(403, "Invalid origin");
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Please log in first.");
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new ApiError(403, "Only the owner can do this.");
  return user;
}

/** Staff or owner. Staff must be linked to a stylist profile. */
export async function requireTeam(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "OWNER") return user;
  if (user.role === "STAFF" && user.stylistId) return user;
  throw new ApiError(403, "Staff only.");
}

export const isTeam = (u: SessionUser) => u.role === "OWNER" || u.role === "STAFF";

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
