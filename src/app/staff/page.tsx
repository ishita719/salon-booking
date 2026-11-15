import type { Metadata } from "next";
import StaffSchedule from "@/components/StaffSchedule";
import { pageUser } from "@/lib/auth";
import { worksOn } from "@/lib/bookings";
import { prisma } from "@/lib/db";
import { salonNow } from "@/lib/time";

export const metadata: Metadata = { title: "My schedule" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await pageUser(["STAFF"]);
  const today = salonNow().date;
  const stylist = user.stylistId ? await prisma.stylist.findUnique({ where: { id: user.stylistId } }) : null;
  if (!stylist) {
    return (
      <div className="container section">
        <div className="alert alert-info">Your login isn&apos;t linked to a stylist profile yet. Please ask the owner.</div>
      </div>
    );
  }
  return <StaffSchedule name={user.name} today={today} worksToday={worksOn(stylist.workDays, today)} />;
}
