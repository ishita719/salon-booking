import type { Metadata } from "next";
import ClientFeedback from "@/components/ClientFeedback";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Feedback" };
export const dynamic = "force-dynamic";

export default async function ClientFeedbackPage() {
  await pageUser(["CUSTOMER"]);
  return <ClientFeedback />;
}
