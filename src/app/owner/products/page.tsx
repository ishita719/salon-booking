import type { Metadata } from "next";
import ManageTabs from "@/components/ManageTabs";
import ProductsManager from "@/components/ProductsManager";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function OwnerProductsPage() {
  await pageUser(["OWNER"]);
  return (
    <>
      <ManageTabs />
      <ProductsManager />
    </>
  );
}
