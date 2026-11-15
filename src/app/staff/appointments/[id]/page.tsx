import RescheduleView from "@/components/RescheduleView";
import { pageUser } from "@/lib/auth";
import { BOOKING_RULES } from "@/lib/config";
import { prisma } from "@/lib/db";
import { addDays, salonNow } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function StaffReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  await pageUser(["STAFF"]);
  const { id } = await params;
  const stylists = await prisma.stylist.findMany({ where: { active: true }, select: { id: true, name: true, title: true }, orderBy: { name: "asc" } });
  const today = salonNow().date;
  return <RescheduleView id={id} stylists={stylists} minDate={today} maxDate={addDays(today, BOOKING_RULES.maxDaysAhead)} backHref="/staff" asTeam />;
}
