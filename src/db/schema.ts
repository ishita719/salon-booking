// Database tables (Cloudflare D1 = SQLite). Keep in sync with the SQL files in /migrations.

import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// Everyone who can log in: clients, staff and the owner.
export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("CUSTOMER"), // CUSTOMER | STAFF | OWNER
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const services = sqliteTable("services", {
  id: id(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull(),
  priceCents: integer("price_cents").notNull(),
  homeAvailable: integer("home_available", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

// A bookable team member, linked to a STAFF login through userId.
export const stylists = sqliteTable("stylists", {
  id: id(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  bio: text("bio").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  workDays: text("work_days").notNull().default("0,2,3,4,5,6"), // weekdays worked, 0 = Sunday
  userId: text("user_id").unique().references(() => users.id, { onDelete: "set null" }),
});

// Staff unavailability (vacation, appointment, sick day). Blocks booking.
export const timeOff = sqliteTable(
  "time_off",
  {
    id: id(),
    stylistId: text("stylist_id").notNull().references(() => stylists.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("time_off_date_idx").on(t.date)],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: id(),
    // Registered client. Null for walk-in / phone bookings made by the salon (guest* fields used instead).
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestName: text("guest_name"),
    guestPhone: text("guest_phone"),
    guestEmail: text("guest_email"),
    source: text("source").notNull().default("ONLINE"), // ONLINE | STAFF
    stylistId: text("stylist_id").references(() => stylists.id, { onDelete: "set null" }),
    date: text("date").notNull(), // salon-local YYYY-MM-DD
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    status: text("status").notNull().default("BOOKED"), // BOOKED | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
    locationType: text("location_type").notNull().default("SALON"), // SALON | HOME
    address: text("address"),
    postalCode: text("postal_code"),
    notes: text("notes"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    travelFeeCents: integer("travel_fee_cents").notNull().default(0),
    hasCustom: integer("has_custom", { mode: "boolean" }).notNull().default(false),
    rescheduleCount: integer("reschedule_count").notNull().default(0),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointments_date_status_idx").on(t.date, t.status),
    index("appointments_user_idx").on(t.userId),
    index("appointments_stylist_date_idx").on(t.stylistId, t.date),
  ],
);

// One line per service on an appointment; name/price copied at booking time. serviceId null = custom service.
export const appointmentItems = sqliteTable(
  "appointment_items",
  {
    id: id(),
    appointmentId: text("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    durationMin: integer("duration_min").notNull(),
    priceCents: integer("price_cents"), // null = custom service, priced at the visit
    isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("appointment_items_appt_idx").on(t.appointmentId)],
);

// Client reviews. One per appointment (or general feedback without an appointment).
export const feedback = sqliteTable(
  "feedback",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    stylistId: text("stylist_id").references(() => stylists.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(), // 1–5
    comment: text("comment").notNull().default(""),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false), // owner chooses to show it on the home page
    ownerReply: text("owner_reply"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("feedback_appointment_uq").on(t.appointmentId), index("feedback_stylist_idx").on(t.stylistId)],
);

// Small key/value store for salon settings (e.g. the staff access code).
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});
