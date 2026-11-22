import type { Metadata } from "next";
import AccountView from "@/components/AccountView";
import { pageUser } from "@/lib/auth";
import { stripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = { title: "My appointments" };
export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  await pageUser(["CUSTOMER"]);
  return <AccountView payOnline={stripeEnabled()} />;
}
