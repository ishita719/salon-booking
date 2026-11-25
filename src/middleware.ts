import { NextRequest, NextResponse } from "next/server";
import { homeFor } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

// Page-level guard. Each portal is only for its role:
//   /account (+ booking, feedback) → clients   — login at /login
//   /staff                          → staff     — login at /team
//   /owner                          → owner     — login at /team
// Every API route and page also re-checks permissions against the database — this is just for redirects.
const PORTALS: { prefix: string; roles: string[]; login: string }[] = [
  { prefix: "/owner", roles: ["OWNER"], login: "/team" },
  { prefix: "/staff", roles: ["STAFF"], login: "/team" },
  { prefix: "/account", roles: ["CUSTOMER"], login: "/login" },
  { prefix: "/book", roles: ["CUSTOMER", "STAFF", "OWNER"], login: "/welcome" }, // the salon QR opens /book
  { prefix: "/settings", roles: ["CUSTOMER", "STAFF", "OWNER"], login: "/login" },
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const portal = PORTALS.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  if (!portal) return NextResponse.next();

  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) {
    const url = new URL(portal.login, req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (!portal.roles.includes(claims.role)) {
    return NextResponse.redirect(new URL(homeFor(claims.role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/book/:path*", "/account/:path*", "/owner/:path*", "/staff/:path*", "/settings/:path*"],
};
