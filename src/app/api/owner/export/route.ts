import { and, asc, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireOwner, route } from "@/lib/api";
import { amountDue, hydrate, PAYMENT_LABEL } from "@/lib/bookings";
import { addDays, formatTime, salonNow } from "@/lib/time";

// Owner: download appointments as a CSV file (opens in Excel / Google Sheets).
export const GET = route(async (req) => {
  await requireOwner();
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 366);
  const today = salonNow().date;
  const from = addDays(today, -(days - 1));
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.appointments)
    .where(and(gte(schema.appointments.date, from), lte(schema.appointments.date, addDays(today, 90))))
    .orderBy(asc(schema.appointments.date), asc(schema.appointments.startMin));
  const full = await hydrate(db, rows);
  // Quote every cell, and neutralise spreadsheet formulas (=, +, -, @) for safety.
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [
    ["Date", "Time", "Client", "Phone", "Email", "Services", "Stylist", "Where", "Status", "Subtotal", "Travel fee", "Discount", "Offer", "Amount due", "Payment", "Paid", "Booked by"].map(cell).join(","),
    ...full.map((a) =>
      [
        a.date,
        formatTime(a.startMin),
        a.user?.name ?? a.guestName ?? "Walk-in",
        a.user?.phone ?? a.guestPhone ?? "",
        a.user?.email ?? a.guestEmail ?? "",
        a.items.map((i) => i.name).join(" + "),
        a.stylist?.name ?? "",
        a.locationType === "HOME" ? `Home ${a.postalCode ?? ""}` : "Studio",
        a.status,
        (a.subtotalCents / 100).toFixed(2),
        (a.travelFeeCents / 100).toFixed(2),
        (a.discountCents / 100).toFixed(2),
        a.offerTitle ?? "",
        (amountDue(a) / 100).toFixed(2),
        PAYMENT_LABEL[a.paymentStatus] ?? a.paymentStatus,
        (a.paidCents / 100).toFixed(2),
        a.source === "ONLINE" ? "Client online" : "Salon",
      ]
        .map(cell)
        .join(","),
    ),
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="appointments-${from}-to-${today}.csv"` },
  });
});
