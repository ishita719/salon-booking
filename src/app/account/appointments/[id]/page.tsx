import type { Metadata } from "next";
import RescheduleView from "@/components/RescheduleView";
import { BOOKING_RULES } from "@/lib/config";
import { prisma } from "@/lib/db";
import { addDays, salonNow } from "@/lib/time";

export const metadata: Metadata = { title: "Reschedule" };
export const dynamic = "force-dynamic";

export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stylists = await prisma.stylist.findMany({ where: { active: true }, select: { id: true, name: true, title: true }, orderBy: { name: "asc" } });
  const today = salonNow().date;
  return <RescheduleView id={id} stylists={stylists} minDate={today} maxDate={addDays(today, BOOKING_RULES.maxDaysAhead)} />;
}
