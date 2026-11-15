import { ApiError, requireUser, route } from "@/lib/api";
import { canAccess } from "@/lib/bookings";
import { SALON } from "@/lib/config";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const pad = (n: number) => String(n).padStart(2, "0");
const localStamp = (date: string, min: number) =>
  `${date.replace(/-/g, "")}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

// "Add to calendar" file (works with Google, Apple and Outlook calendars).
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const id = (await params).id;
  const a = await prisma.appointment.findUnique({ where: { id }, include: { items: true, stylist: true } });
  if (!a || !canAccess(user, a)) throw new ApiError(404, "Appointment not found.");

  const where = a.locationType === "HOME" ? `${a.address}, ${a.postalCode}` : SALON.address;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Salon Booking//EN",
    "BEGIN:VEVENT",
    `UID:${a.id}@salon-booking`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=${SALON.timeZone}:${localStamp(a.date, a.startMin)}`,
    `DTEND;TZID=${SALON.timeZone}:${localStamp(a.date, a.endMin)}`,
    `SUMMARY:${esc(`${SALON.name}: ${a.items.map((i) => i.name).join(", ")}`)}`,
    `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(`Stylist: ${a.stylist?.name ?? "TBA"}. Questions? ${SALON.phone}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointment-${a.date}.ics"`,
    },
  });
});
