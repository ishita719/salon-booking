import type { Metadata } from "next";
import ManageTabs from "@/components/ManageTabs";
import OffersManager from "@/components/OffersManager";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Offers" };
export const dynamic = "force-dynamic";

export default async function OwnerOffersPage() {
  await pageUser(["OWNER"]);
  return (
    <>
      <ManageTabs />
      <OffersManager />
    </>
  );
}
