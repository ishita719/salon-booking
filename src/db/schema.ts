// Database tables (Supabase = PostgreSQL). Keep in sync with the SQL files in /supabase/migrations.

import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date());
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// Everyone who can log in: clients, staff and the owner.
export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("CUSTOMER"), // CUSTOMER | STAFF | OWNER
  active: boolean("active").notNull().default(true),
  pinHash: text("pin_hash"), // owner code (hashed); null = temporary code
  phoneDigits: text("phone_digits").notNull().default(""), // phone as digits only, for QR sign-in matching
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const services = pgTable("services", {
  id: id(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull(),
  priceCents: integer("price_cents").notNull(),
  homeAvailable: boolean("home_available").notNull().default(true),
  active: boolean("active").notNull().default(true),
  targets: text("targets").notNull().default(""), // comma list of skin/hair needs it helps (see lib/skin.ts)
  steps: text("steps").notNull().default(""), // "how it's done", one step per line
  createdAt: createdAt(),
});

// A bookable team member, linked to a STAFF login through userId.
export const stylists = pgTable("stylists", {
  id: id(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  bio: text("bio").notNull().default(""),
  active: boolean("active").notNull().default(true),
  workDays: text("work_days").notNull().default("0,2,3,4,5,6"), // weekdays worked, 0 = Sunday
  userId: text("user_id").unique().references(() => users.id, { onDelete: "set null" }),
});

// Staff unavailability (vacation, appointment, sick day). Blocks booking.
export const timeOff = pgTable(
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

export const appointments = pgTable(
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
    hasCustom: boolean("has_custom").notNull().default(false),
    rescheduleCount: integer("reschedule_count").notNull().default(0),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    discountCents: integer("discount_cents").notNull().default(0),
    offerId: text("offer_id"),
    offerTitle: text("offer_title"),
    paymentStatus: text("payment_status").notNull().default("UNPAID"), // UNPAID | PENDING | PAID_ONLINE | PAID_IN_SALON | REFUNDED
    paidCents: integer("paid_cents").notNull().default(0),
    stripeSessionId: text("stripe_session_id"),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
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
export const appointmentItems = pgTable(
  "appointment_items",
  {
    id: id(),
    appointmentId: text("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    durationMin: integer("duration_min").notNull(),
    priceCents: integer("price_cents"), // null = custom service, priced at the visit
    isCustom: boolean("is_custom").notNull().default(false),
  },
  (t) => [index("appointment_items_appt_idx").on(t.appointmentId)],
);

// Client reviews. One per appointment (or general feedback without an appointment).
export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    stylistId: text("stylist_id").references(() => stylists.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(), // 1–5
    comment: text("comment").notNull().default(""),
    isPublic: boolean("is_public").notNull().default(false), // owner chooses to show it on the home page
    ownerReply: text("owner_reply"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("feedback_appointment_uq").on(t.appointmentId), index("feedback_stylist_idx").on(t.stylistId)],
);

// Retail products recommended after the skin check.
export const products = pgTable("products", {
  id: id(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default(""),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  howToUse: text("how_to_use").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  targets: text("targets").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

// Discounts the owner runs. Applied automatically at booking (best single offer wins).
export const offers = pgTable("offers", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  discountType: text("discount_type").notNull().default("PERCENT"), // PERCENT | AMOUNT
  value: integer("value").notNull(), // percent, or cents for AMOUNT
  serviceIds: text("service_ids").notNull().default(""),
  categories: text("categories").notNull().default(""),
  firstVisitOnly: boolean("first_visit_only").notNull().default(false),
  startsOn: text("starts_on"),
  endsOn: text("ends_on"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

// Result of the client's online skin & hair check.
export const skinProfiles = pgTable("skin_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  answers: text("answers").notNull(), // JSON
  skinType: text("skin_type").notNull(),
  sensitivity: text("sensitivity").notNull(),
  concerns: text("concerns").notNull().default(""),
  hairType: text("hair_type").notNull().default(""),
  hairConcerns: text("hair_concerns").notNull().default(""),
  updatedAt: updatedAt(),
});

// "Our work" photos.
export const gallery = pgTable("gallery", {
  id: id(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  image: text("image"), // compressed JPEG data URL
  stylistId: text("stylist_id").references(() => stylists.id, { onDelete: "set null" }),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
});

// Anonymous page views for the owner's visitor stats (random visitor id, no personal data).
export const pageViews = pgTable(
  "page_views",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    path: text("path").notNull(),
    visitor: text("visitor").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("page_views_date_idx").on(t.date)],
);

// 6-digit codes sent by email (owner sign-up / forgot code, client login). Stored hashed, 10-minute life, 5 tries.
export const verificationCodes = pgTable(
  "verification_codes",
  {
    id: id(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull(), // OWNER_SIGNUP | OWNER_RESET | CLIENT_LOGIN
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    used: boolean("used").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("verification_codes_email_idx").on(t.email, t.purpose)],
);

// One-time "scan to log in" QR codes for clients (10 minutes, single use). Token stored hashed.
export const loginTokens = pgTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
});

// Small key/value store for salon settings (e.g. the staff access code).
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});
