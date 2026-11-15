import type { Metadata } from "next";
import BookingForm from "@/components/BookingForm";
import { pageUser } from "@/lib/auth";
import { BOOKING_RULES, HOME_VISITS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { addDays, salonNow } from "@/lib/time";

export const metadata: Metadata = { title: "Book an appointment" };
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const user = await pageUser(["CUSTOMER", "STAFF", "OWNER"]);
  const team = user.role !== "CUSTOMER";
  const [services, stylists] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { priceCents: "asc" }] }),
    prisma.stylist.findMany({ where: { active: true }, select: { id: true, name: true, title: true }, orderBy: { name: "asc" } }),
  ]);
  const today = salonNow().date;

  return (
    <div className="container section">
      <h1>{team ? "Book for a client" : "Book an appointment"}</h1>
      <p className="muted">
        {team
          ? "Phone or walk-in booking. If the client has an account, use their email and it will appear in their account."
          : "Choose your services, where you'd like them, and a time that works for you."}
      </p>
      <BookingForm
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          durationMin: s.durationMin,
          priceCents: s.priceCents,
          homeAvailable: s.homeAvailable,
        }))}
        stylists={stylists}
        minDate={today}
        maxDate={addDays(today, BOOKING_RULES.maxDaysAhead)}
        teamMode={team}
        defaultStylistId={user.role === "STAFF" ? (user.stylistId ?? "") : ""}
        doneHref={user.role === "OWNER" ? "/owner/appointments" : user.role === "STAFF" ? "/staff" : "/account?booked=1"}
        rules={{
          customDurationMin: BOOKING_RULES.customServiceDurationMin,
          maxServices: BOOKING_RULES.maxServicesPerBooking,
          travelFeeCents: HOME_VISITS.travelFeeCents,
          areaLabel: HOME_VISITS.areaLabel,
          cutoffHours: BOOKING_RULES.changeCutoffHours,
        }}
      />
    </div>
  );
}
