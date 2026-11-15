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

export const registerSchema = z.object({
  name: trimmed(2, 80, "Name"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(100),
});

export const profileSchema = z.object({
  name: trimmed(2, 80, "Name"),
  phone: phoneSchema,
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

export const appointmentPatchSchema = z.discriminatedUnion("action", [rescheduleSchema, cancelSchema, statusSchema]);

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
});
