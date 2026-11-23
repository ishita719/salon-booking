import { z } from "zod";
import { ALL_STATUSES, BOOKING_RULES, HOME_VISITS } from "./config";
import { isValidDateString } from "./time";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(120);

export const phoneSchema = z
  .string({ required_error: "Phone is required" })
  .trim()
  .regex(/^[0-9+()\-.\s]{7,20}$/, "Enter a valid phone number");

export const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(/[A-Za-z]/, "Password needs at least one letter")
  .regex(/[0-9]/, "Password needs at least one number");

// Client sign-up (/register). Always creates a CLIENT account.
export const registerSchema = z.object({
  name: trimmed(2, 80, "Name"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

// Client login (/login).
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(100),
});

const codeField = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(4, `Enter the ${label.toLowerCase()}`).max(64);

// Team login (/team): owner = email + password; staff = email + password + staff code.
export const teamLoginSchema = z
  .object({
    as: z.enum(["OWNER", "STAFF"]),
    email: emailSchema,
    password: z.string().min(1, "Password is required").max(100),
    staffCode: z.string().trim().max(64).optional(),
    ownerCode: z.string().trim().max(64).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.as === "OWNER" && (!v.ownerCode || v.ownerCode.length < 4)) ctx.addIssue({ code: "custom", message: "Enter your owner code" });
    if (v.as === "STAFF" && (!v.staffCode || v.staffCode.length < 4)) ctx.addIssue({ code: "custom", message: "Enter the staff code from the owner" });
  });

// Staff sign-up (/team/join) — needs the owner's staff code.
export const staffJoinSchema = z.object({
  name: trimmed(2, 80, "Name"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  staffCode: codeField("Staff code"),
});

// Owner's personal code: 4–8 digits (like a bank card PIN).
export const ownerCodeSchema = z.string({ required_error: "Choose an owner code" }).trim().regex(/^\d{4,8}$/, "Owner code: use 4 to 8 digits");
const sixDigits = z.string({ required_error: "Enter the 6-digit code" }).trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email");

// QR sign-in for clients: just name + phone (email optional).
export const quickJoinSchema = z.object({
  name: trimmed(2, 80, "Name"),
  phone: phoneSchema,
  email: z.union([z.literal(""), emailSchema]).optional(),
});

export const emailCodeRequestSchema = z.object({
  email: emailSchema,
  purpose: z.enum(["CLIENT_LOGIN", "OWNER_RESET", "OWNER_SIGNUP"]),
});

export const emailLoginSchema = z.object({ email: emailSchema, code: sixDigits });

export const ownerResetSchema = z.object({
  email: emailSchema,
  code: sixDigits,
  newOwnerCode: ownerCodeSchema,
  newPassword: z.union([z.literal(""), passwordSchema]).optional(),
});

export const ownerSignupSchema = z.object({
  email: emailSchema,
  code: sixDigits,
  name: trimmed(2, 80, "Name"),
  phone: phoneSchema,
  password: passwordSchema,
  ownerCode: ownerCodeSchema,
  teamCode: z
    .string()
    .trim()
    .min(6, "Team secret code: use at least 6 characters")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "Team secret code: use letters, numbers and dashes only")
    .optional(),
  setupCode: z.string().trim().max(64).optional(),
});

export const ownerInviteSchema = z.object({ email: emailSchema });

// First-time owner setup (/team/setup) — only works while no owner exists, and needs SETUP_CODE.
export const ownerSetupSchema = z.object({
  name: trimmed(2, 80, "Name"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  setupCode: codeField("Setup code"),
  // The owner chooses the team secret code here; staff need it to join and at every login.
  teamCode: z
    .string({ required_error: "Choose a team secret code" })
    .trim()
    .min(6, "Team secret code: use at least 6 characters")
    .max(32, "Team secret code: use at most 32 characters")
    .regex(/^[A-Za-z0-9-]+$/, "Team secret code: use letters, numbers and dashes only"),
});

// Owner sets the staff code (or asks for a random one).
export const staffCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, "Use at least 6 characters")
    .max(32, "Use at most 32 characters")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes only")
    .optional(),
  generate: z.boolean().optional(),
});

// Client feedback.
export const feedbackSchema = z.object({
  rating: z.number({ required_error: "Choose a rating" }).int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().max(1000, "Please keep it under 1000 characters").default(""),
  appointmentId: z.string().min(1).max(64).nullable().optional(),
});

export const feedbackUpdateSchema = z.object({
  isPublic: z.boolean().optional(),
  ownerReply: z.string().trim().max(1000).nullable().optional(),
});

export const profileSchema = z.object({
  name: trimmed(2, 80, "Name"),
  phone: phoneSchema,
  email: z.union([z.literal(""), emailSchema]).optional(), // clients only: add/change email
});

export const dateSchema = z.string().refine(isValidDateString, "Choose a valid date");
export const startMinSchema = z.number().int().min(0).max(1439);
export const locationSchema = z.enum(["SALON", "HOME"]);

export const postalCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((s) => s.replace(/\s+/g, ""))
  .refine((s) => /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(s), "Enter a valid Canadian postal code (e.g. V6B 1A1)")
  .refine(
    (s) => HOME_VISITS.postalPrefixes.some((p) => s.startsWith(p)),
    `Sorry, at-home visits are only available in ${HOME_VISITS.areaLabel}.`,
  )
  .transform((s) => `${s.slice(0, 3)} ${s.slice(3)}`);

export const bookingSchema = z
  .object({
    serviceIds: z.array(z.string().min(1).max(40)).max(BOOKING_RULES.maxServicesPerBooking).default([]),
    customServices: z.array(trimmed(2, 80, "Custom service name")).max(3, "Up to 3 custom services").default([]),
    date: dateSchema,
    startMin: startMinSchema,
    stylistId: z.string().min(1).max(40).nullable().optional(),
    locationType: locationSchema,
    address: z.string().trim().max(200).optional(),
    postalCode: z.string().optional(),
    notes: z.string().trim().max(500, "Notes must be under 500 characters").optional(),
    payOnline: z.boolean().optional(), // client chose "Pay online now" (Stripe)
    // Only used when staff/owner book on behalf of a client (walk-in or phone booking).
    client: z
      .object({
        name: trimmed(2, 80, "Client name"),
        phone: phoneSchema,
        email: z.union([z.literal(""), emailSchema]).optional(),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    const total = new Set(v.serviceIds).size + v.customServices.length;
    if (total === 0) ctx.addIssue({ code: "custom", message: "Choose at least one service" });
    if (total > BOOKING_RULES.maxServicesPerBooking)
      ctx.addIssue({ code: "custom", message: `Up to ${BOOKING_RULES.maxServicesPerBooking} services per visit` });
    if (v.locationType === "HOME" && (!v.address || v.address.length < 5))
      ctx.addIssue({ code: "custom", message: "Enter the street address for your at-home visit" });
  })
  .transform((v, ctx) => {
    if (v.locationType !== "HOME") return { ...v, serviceIds: [...new Set(v.serviceIds)], address: undefined, postalCode: undefined };
    const pc = postalCodeSchema.safeParse(v.postalCode ?? "");
    if (!pc.success) {
      ctx.addIssue({ code: "custom", message: pc.error.issues[0].message });
      return z.NEVER;
    }
    return { ...v, serviceIds: [...new Set(v.serviceIds)], postalCode: pc.data };
  });

export const rescheduleSchema = z.object({
  action: z.literal("reschedule"),
  date: dateSchema,
  startMin: startMinSchema,
  stylistId: z.string().min(1).max(40).nullable().optional(),
});

export const cancelSchema = z.object({ action: z.literal("cancel") });

export const statusSchema = z.object({
  action: z.literal("status"),
  status: z.enum(ALL_STATUSES),
});

// Salon records a payment taken at the counter (cash / card machine), or the owner marks a refund.
export const paymentSchema = z.object({
  action: z.literal("payment"),
  paymentStatus: z.enum(["PAID_IN_SALON", "UNPAID", "REFUNDED"]),
  paidCents: z.number().int().min(0).max(10_000_000).optional(),
});

export const appointmentPatchSchema = z.discriminatedUnion("action", [rescheduleSchema, cancelSchema, statusSchema, paymentSchema]);

const targetList = z.array(z.string().max(30)).max(30).transform((a) => [...new Set(a)].join(","));

export const productSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  brand: z.string().trim().max(60).default(""),
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(400).default(""),
  howToUse: z.string().trim().max(400).default(""),
  priceCents: z.number().int().min(0).max(1_000_000),
  targets: targetList.default([]),
  active: z.boolean().default(true),
});

export const offerSchema = z
  .object({
    title: z.string().trim().min(3, "Title is too short").max(80),
    description: z.string().trim().max(300).default(""),
    discountType: z.enum(["PERCENT", "AMOUNT"]),
    value: z.number().int().min(1),
    serviceIds: z.array(z.string().max(64)).max(60).transform((a) => a.join(",")).default([]),
    categories: z.array(z.string().max(40)).max(20).transform((a) => a.join(",")).default([]),
    firstVisitOnly: z.boolean().default(false),
    startsOn: dateSchema.nullable().optional(),
    endsOn: dateSchema.nullable().optional(),
    active: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === "PERCENT" && v.value > 90) ctx.addIssue({ code: "custom", message: "Percent discount can be at most 90%" });
    if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) ctx.addIssue({ code: "custom", message: "End date must be after the start date" });
  });

export const galleryItemSchema = z.object({
  title: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(300).default(""),
  stylistId: z.string().max(64).nullable().optional(),
  // Compressed in the browser before upload; ~700 KB max as text.
  image: z
    .string()
    .max(950_000, "Image is too large — please use a smaller photo")
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Please upload a JPG, PNG or WebP image")
    .nullable()
    .optional(),
  sort: z.number().int().min(0).max(10_000).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(100),
  newPassword: passwordSchema,
});

const workDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .max(7)
  .transform((d) => [...new Set(d)].sort().join(","));

export const teamCreateSchema = z.object({
  name: trimmed(2, 80, "Name"),
  title: trimmed(2, 60, "Job title"),
  bio: z.string().trim().max(300).default(""),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  workDays: workDaysSchema,
});

export const teamUpdateSchema = z.object({
  name: trimmed(2, 80, "Name").optional(),
  title: trimmed(2, 60, "Job title").optional(),
  bio: z.string().trim().max(300).optional(),
  phone: phoneSchema.optional(),
  workDays: workDaysSchema.optional(),
  active: z.boolean().optional(),
  newPassword: passwordSchema.optional(), // owner resets a staff password
});

export const timeOffSchema = z
  .object({
    stylistId: z.string().min(1).max(40).optional(), // owner only; staff always use their own
    date: dateSchema,
    allDay: z.boolean().default(true),
    startMin: startMinSchema.optional(),
    endMin: z.number().int().min(1).max(1440).optional(),
    reason: z.string().trim().max(120).default(""),
  })
  .transform((v, ctx) => {
    if (v.allDay) return { ...v, startMin: 0, endMin: 1440 };
    if (v.startMin == null || v.endMin == null || v.endMin <= v.startMin) {
      ctx.addIssue({ code: "custom", message: "End time must be after start time" });
      return z.NEVER;
    }
    return { ...v, startMin: v.startMin, endMin: v.endMin };
  });

export const serviceSchema = z.object({
  name: trimmed(2, 80, "Name"),
  category: trimmed(2, 40, "Category"),
  description: z.string().trim().max(300).default(""),
  durationMin: z.number().int().min(15, "Minimum 15 minutes").max(480, "Maximum 8 hours"),
  priceCents: z.number().int().min(0).max(1_000_000),
  homeAvailable: z.boolean().default(true),
  active: z.boolean().default(true),
  targets: targetList.default([]),
  steps: z.string().trim().max(2000).default(""), // "how it's done", one step per line
});
