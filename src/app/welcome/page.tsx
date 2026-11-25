import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QuickJoin from "@/components/QuickJoin";
import { getSessionUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const metadata: Metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

/** Only allow going on to a page on this site (never an outside address). */
function safeNext(next?: string): string | undefined {
  return next && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : undefined;
}

// Name + phone sign-in. The salon QR opens /book; anyone not signed in yet lands here and then goes on to booking.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ expired?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const user = await getSessionUser();
  if (user) redirect(user.role === "CUSTOMER" && next ? next : homeFor(user.role)); // already signed in on this phone
  return <QuickJoin expired={sp.expired === "1"} next={next} />;
}
