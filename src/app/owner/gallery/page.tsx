import type { Metadata } from "next";
import ManageTabs from "@/components/ManageTabs";
import GalleryManager from "@/components/GalleryManager";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

export default async function OwnerGalleryPage() {
  await pageUser(["OWNER"]);
  return (
    <>
      <ManageTabs />
      <GalleryManager />
    </>
  );
}
