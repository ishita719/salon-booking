import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { salonNow } from "@/lib/time";

const COOKIE = "mm_vid";
const bodySchema = z.object({ path: z.string().max(200) });

// Records one anonymous page view for the owner's "visitors" stats.
// Visitor id = random value in a first-party cookie. No names, emails or IP addresses are stored.
export const POST = route(async (req) => {
  const { path } = bodySchema.parse(await req.json());
  const clean = path.split("?")[0].replace(/[^\w\-/]/g, "").slice(0, 120) || "/";
  // The salon team's own pages aren't counted as visitors.
  if (/^\/(owner|staff|team|api)(\/|$)/.test(clean)) return NextResponse.json({ ok: true });
  if (/bot|crawl|spider|preview/i.test(req.headers.get("user-agent") ?? "")) return NextResponse.json({ ok: true });

  const jar = await cookies();
  let visitor = jar.get(COOKIE)?.value;
  if (!visitor || !/^[a-f0-9-]{36}$/.test(visitor)) {
    visitor = crypto.randomUUID();
    jar.set(COOKIE, visitor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  rateLimit(`track:${visitor}`, 120, 60 * 60 * 1000);
  await getDb().insert(schema.pageViews).values({ date: salonNow().date, path: clean, visitor });
  return NextResponse.json({ ok: true });
});
