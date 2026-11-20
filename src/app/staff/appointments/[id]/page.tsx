import RescheduleView from "@/components/RescheduleView";
import { pageUser } from "@/lib/auth";
import { BOOKING_RULES } from "@/lib/config";
import { getDb } from "@/db";
import { stylistOptions } from "@/lib/bookings";
import { addDays, salonNow } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function StaffReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  await pageUser(["STAFF"]);
  const { id } = await params;
  const stylists = await stylistOptions(getDb());
  const today = salonNow().date;
  return <RescheduleView id={id} stylists={stylists} minDate={today} maxDate={addDays(today, BOOKING_RULES.maxDaysAhead)} backHref="/staff" asTeam />;
}
