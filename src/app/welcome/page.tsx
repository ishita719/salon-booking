import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QuickJoin from "@/components/QuickJoin";
import { getSessionUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const metadata: Metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

// The page the salon's QR code opens.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role)); // already signed in on this phone
  return <QuickJoin expired={(await searchParams).expired === "1"} />;
}
