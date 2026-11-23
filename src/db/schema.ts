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
  pinHash: text("pin_hash"), // owner code (hashed); null = temporary code
  phoneDigits: text("phone_digits").notNull().default(""), // phone as digits only, for QR sign-in matching
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
  targets: text("targets").notNull().default(""), // comma list of skin/hair needs it helps (see lib/skin.ts)
  steps: text("steps").notNull().default(""), // "how it's done", one step per line
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
    discountCents: integer("discount_cents").notNull().default(0),
    offerId: text("offer_id"),
    offerTitle: text("offer_title"),
    paymentStatus: text("payment_status").notNull().default("UNPAID"), // UNPAID | PENDING | PAID_ONLINE | PAID_IN_SALON | REFUNDED
    paidCents: integer("paid_cents").notNull().default(0),
    stripeSessionId: text("stripe_session_id"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
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

// Retail products recommended after the skin check.
export const products = sqliteTable("products", {
  id: id(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default(""),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  howToUse: text("how_to_use").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  targets: text("targets").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

// Discounts the owner runs. Applied automatically at booking (best single offer wins).
export const offers = sqliteTable("offers", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  discountType: text("discount_type").notNull().default("PERCENT"), // PERCENT | AMOUNT
  value: integer("value").notNull(), // percent, or cents for AMOUNT
  serviceIds: text("service_ids").notNull().default(""),
  categories: text("categories").notNull().default(""),
  firstVisitOnly: integer("first_visit_only", { mode: "boolean" }).notNull().default(false),
  startsOn: text("starts_on"),
  endsOn: text("ends_on"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

// Result of the client's online skin & hair check.
export const skinProfiles = sqliteTable("skin_profiles", {
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
export const gallery = sqliteTable("gallery", {
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
export const pageViews = sqliteTable(
  "page_views",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    path: text("path").notNull(),
    visitor: text("visitor").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("page_views_date_idx").on(t.date)],
);

// 6-digit codes sent by email (owner sign-up / forgot code, client login). Stored hashed, 10-minute life, 5 tries.
export const verificationCodes = sqliteTable(
  "verification_codes",
  {
    id: id(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull(), // OWNER_SIGNUP | OWNER_RESET | CLIENT_LOGIN
    codeHash: text("code_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    used: integer("used", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("verification_codes_email_idx").on(t.email, t.purpose)],
);

// One-time "scan to log in" QR codes for clients (10 minutes, single use). Token stored hashed.
export const loginTokens = sqliteTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

// Small key/value store for salon settings (e.g. the staff access code).
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});
