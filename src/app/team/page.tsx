import type { Metadata } from "next";
import TeamAuth from "@/components/TeamAuth";

export const metadata: Metadata = { title: "Salon team login" };

export default function TeamLoginPage() {
  return <TeamAuth mode="login" />;
}
