import type { Metadata } from "next";
import AccountView from "@/components/AccountView";

export const metadata: Metadata = { title: "My appointments" };

export default function AccountPage() {
  return <AccountView />;
}
