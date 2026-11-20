import type { Metadata } from "next";
import FeedbackBoard from "@/components/FeedbackBoard";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Client feedback" };
export const dynamic = "force-dynamic";

export default async function OwnerFeedbackPage() {
  await pageUser(["OWNER"]);
  return <FeedbackBoard mode="owner" />;
}
