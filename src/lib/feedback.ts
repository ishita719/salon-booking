// Client feedback: shared queries for the API and pages.

import { and, desc, eq, inArray, SQL } from "drizzle-orm";
import { DB, schema } from "@/db";
import { formatDate } from "./time";

const { feedback, users, stylists, appointments } = schema;

/** "Priya S." — reviews never show a full surname or contact details publicly. */
export function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export async function listFeedback(db: DB, where?: SQL, limit = 200) {
  const rows = await db.select().from(feedback).where(where).orderBy(desc(feedback.createdAt)).limit(limit);
  if (!rows.length) return [];
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const stylistIds = [...new Set(rows.map((r) => r.stylistId).filter(Boolean))] as string[];
  const apptIds = [...new Set(rows.map((r) => r.appointmentId).filter(Boolean))] as string[];
  const [us, ss, as] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds.slice(0, 90))),
    stylistIds.length ? db.select({ id: stylists.id, name: stylists.name }).from(stylists).where(inArray(stylists.id, stylistIds.slice(0, 90))) : [],
    apptIds.length ? db.select({ id: appointments.id, date: appointments.date }).from(appointments).where(inArray(appointments.id, apptIds.slice(0, 90))) : [],
  ]);
  return rows.map((r) => {
    const u = us.find((x) => x.id === r.userId);
    const a = as.find((x) => x.id === r.appointmentId);
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      isPublic: r.isPublic,
      ownerReply: r.ownerReply,
      createdAt: r.createdAt.toISOString(),
      dateLabel: formatDate(r.createdAt.toISOString().slice(0, 10)),
      clientName: u?.name ?? "Client",
      clientShortName: shortName(u?.name ?? "Client"),
      clientEmail: u?.email && !u.email.endsWith("@no-email.invalid") ? u.email : null,
      stylistId: r.stylistId,
      stylistName: ss.find((s) => s.id === r.stylistId)?.name ?? null,
      appointmentId: r.appointmentId,
      visitLabel: a ? formatDate(a.date) : null,
    };
  });
}

export type FeedbackDTO = Awaited<ReturnType<typeof listFeedback>>[number];

/** Reviews the owner chose to show on the home page (no contact details). */
export async function publicReviews(db: DB, limit = 6) {
  const list = await listFeedback(db, and(eq(feedback.isPublic, true)), limit);
  return list.map((f) => ({ id: f.id, rating: f.rating, comment: f.comment, name: f.clientShortName, stylistName: f.stylistName, ownerReply: f.ownerReply }));
}
