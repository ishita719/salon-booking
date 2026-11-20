import type { Metadata } from "next";
import TeamAuth from "@/components/TeamAuth";

export const metadata: Metadata = { title: "Join the team" };

export default function StaffJoinPage() {
  return <TeamAuth mode="join" />;
}
