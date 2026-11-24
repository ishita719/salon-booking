import type { Metadata } from "next";
import OwnerAccountFlow from "@/components/OwnerAccountFlow";

export const metadata: Metadata = { title: "Forgot secret code" };

export default function OwnerRecoverPage() {
  return <OwnerAccountFlow mode="recover" />;
}
