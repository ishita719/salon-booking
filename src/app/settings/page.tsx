import type { Metadata } from "next";
import SettingsView from "@/components/SettingsView";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await pageUser(["CUSTOMER", "STAFF", "OWNER"]);
  return <SettingsView />;
}
