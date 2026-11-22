import type { Metadata } from "next";
import ManageTabs from "@/components/ManageTabs";
import FeedbackBoard from "@/components/FeedbackBoard";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Client feedback" };
export const dynamic = "force-dynamic";

export default async function OwnerFeedbackPage() {
  await pageUser(["OWNER"]);
  return (
    <>
      <ManageTabs />
      <FeedbackBoard mode="owner" />
    </>
  );
}
