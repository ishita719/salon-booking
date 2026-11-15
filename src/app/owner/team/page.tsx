import type { Metadata } from "next";
import TeamManager from "@/components/TeamManager";
import { pageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function OwnerTeamPage() {
  await pageUser(["OWNER"]);
  return <TeamManager />;
}
