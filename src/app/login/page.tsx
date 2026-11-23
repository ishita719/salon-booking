import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ClientQrLogin from "@/components/ClientQrLogin";
import { getSessionUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const metadata: Metadata = { title: "Client login" };
export const dynamic = "force-dynamic";

// Clients sign in with QR codes only.
export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return <ClientQrLogin welcomeUrl={`${proto}://${host}/welcome`} />;
}
