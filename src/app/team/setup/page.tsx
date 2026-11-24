import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import OwnerAccountFlow from "@/components/OwnerAccountFlow";
import { getDb, schema } from "@/db";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Create owner account" };
export const dynamic = "force-dynamic";

// New owner account. The first owner is active at once; later owners wait for an existing owner to approve them.
export default async function OwnerSignupPage() {
  const owner = await getDb().query.users.findFirst({ where: eq(schema.users.role, "OWNER"), columns: { id: true } });
  return <OwnerAccountFlow mode="signup" firstOwner={!owner} setupCodeRequired={!!getEnv("SETUP_CODE")} />;
}
