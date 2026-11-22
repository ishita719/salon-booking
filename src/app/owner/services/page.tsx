import type { Metadata } from "next";
import ManageTabs from "@/components/ManageTabs";
import ServicesManager from "@/components/ServicesManager";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function OwnerServicesPage() {
  await pageUser(["OWNER"]);
  return (
    <>
      <ManageTabs />
      <ServicesManager />
    </>
  );
}
