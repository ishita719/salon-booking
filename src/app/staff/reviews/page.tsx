import type { Metadata } from "next";
import FeedbackBoard from "@/components/FeedbackBoard";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "My reviews" };
export const dynamic = "force-dynamic";

export default async function StaffReviewsPage() {
  await pageUser(["STAFF"]);
  return <FeedbackBoard mode="staff" />;
}
