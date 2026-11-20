import type { Metadata } from "next";
import AppointmentsBoard from "@/components/AppointmentsBoard";
import { getDb, schema } from "@/db";
import { pageUser } from "@/lib/auth";
import { salonNow } from "@/lib/time";

export const metadata: Metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

export default async function OwnerAppointmentsPage() {
  await pageUser(["OWNER"]);
  const stylists = await getDb().select({ id: schema.stylists.id, name: schema.stylists.name }).from(schema.stylists).orderBy(schema.stylists.name);
  return <AppointmentsBoard today={salonNow().date} stylists={stylists} />;
}
