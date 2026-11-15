import { NextRequest, NextResponse } from "next/server";
import { homeFor } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

// Page-level guard: each portal is only for its role. Logged-out visitors go to /login.
// (Every API route and page also re-checks permissions against the database — this is just for redirects.)
const PORTALS: { prefix: string; roles: string[] }[] = [
  { prefix: "/owner", roles: ["OWNER"] },
  { prefix: "/staff", roles: ["STAFF"] },
  { prefix: "/account", roles: ["CUSTOMER"] },
];

export async function middleware(req: NextRequest) {
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = req.nextUrl;

  if (!claims) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  const portal = PORTALS.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  if (portal && !portal.roles.includes(claims.role)) {
    return NextResponse.redirect(new URL(homeFor(claims.role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/book/:path*", "/account/:path*", "/owner/:path*", "/staff/:path*", "/settings/:path*"],
};
