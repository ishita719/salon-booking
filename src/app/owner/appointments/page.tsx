import type { Metadata } from "next";
import AppointmentsBoard from "@/components/AppointmentsBoard";
import { pageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { salonNow } from "@/lib/time";

export const metadata: Metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

export default async function OwnerAppointmentsPage() {
  await pageUser(["OWNER"]);
  const stylists = await prisma.stylist.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <AppointmentsBoard today={salonNow().date} stylists={stylists} />;
}
