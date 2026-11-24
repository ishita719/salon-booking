import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ClientQrLogin from "@/components/ClientQrLogin";
import { getSessionUser } from "@/lib/auth";
import { publicOrigin } from "@/lib/origin";
import { homeFor } from "@/lib/roles";

export const metadata: Metadata = { title: "Client login" };
export const dynamic = "force-dynamic";

// Clients sign in with QR codes only.
export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  return <ClientQrLogin welcomeUrl={`${await publicOrigin()}/welcome`} />;
}
