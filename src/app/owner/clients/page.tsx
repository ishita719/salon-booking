import type { Metadata } from "next";
import ClientsList from "@/components/ClientsList";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function OwnerClientsPage() {
  await pageUser(["OWNER"]);
  return <ClientsList />;
}
