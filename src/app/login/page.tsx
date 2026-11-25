import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ClientQrLogin from "@/components/ClientQrLogin";
import { getSessionUser } from "@/lib/auth";
import { publicOrigin } from "@/lib/origin";
import { homeFor } from "@/lib/roles";

export const metadata: Metadata = { title: "Client login" };
export const dynamic = "force-dynamic";

// Client login: the QR (opens booking on the phone) or name + phone on this device.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  const next = (await searchParams).next;
  const safe = next && /^\/(?!\/)[\w\-/?=&.%]*$/.test(next) ? next : "/book";
  return <ClientQrLogin welcomeUrl={`${await publicOrigin()}/book`} next={safe} />;
}
