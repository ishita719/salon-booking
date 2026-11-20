import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TeamAuth from "@/components/TeamAuth";
import { getDb, schema } from "@/db";

export const metadata: Metadata = { title: "Owner setup" };
export const dynamic = "force-dynamic";

// One-time owner account creation. Once an owner exists, this page just sends you to the team login.
export default async function OwnerSetupPage() {
  const owner = await getDb().query.users.findFirst({ where: eq(schema.users.role, "OWNER"), columns: { id: true } });
  if (owner) redirect("/team?as=owner");
  return <TeamAuth mode="setup" />;
}
