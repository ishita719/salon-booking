// Online payments with Stripe Checkout (card, Apple Pay, Google Pay).
// Talks to Stripe's REST API with fetch, so it works on Cloudflare Workers without extra libraries.
// Card details are entered on Stripe's own secure page — they never touch this website.
//
// Needs (Cloudflare secrets / local .env): STRIPE_SECRET_KEY, and for the webhook STRIPE_WEBHOOK_SECRET.

import { getEnv } from "./env";
import { safeEqual } from "./password";

export function stripeEnabled(): boolean {
  const k = getEnv("STRIPE_SECRET_KEY");
  return !!k && /^(sk|rk)_(test|live)_/.test(k);
}

async function stripe<T>(path: string, init?: { method?: string; form?: Record<string, string> }): Promise<T> {
  const key = getEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Online payment is not set up.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  client_reference_id: string | null;
  metadata?: Record<string, string>;
}

export function createCheckoutSession(o: { appointmentId: string; amountCents: number; description: string; email?: string | null; origin: string }) {
  const form: Record<string, string> = {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "cad",
    "line_items[0][price_data][unit_amount]": String(o.amountCents),
    "line_items[0][price_data][product_data][name]": "Maple & Mane appointment",
    "line_items[0][price_data][product_data][description]": o.description.slice(0, 480),
    client_reference_id: o.appointmentId,
    "metadata[appointment_id]": o.appointmentId,
    success_url: `${o.origin}/api/payments/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${o.origin}/account/appointments?payment=cancelled`,
    expires_at: String(Math.floor(Date.now() / 1000) + 60 * 60), // 1 hour to pay
  };
  if (o.email) form.customer_email = o.email;
  return stripe<CheckoutSession>("checkout/sessions", { method: "POST", form });
}

export function retrieveCheckoutSession(id: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new Error("Invalid session id");
  return stripe<CheckoutSession>(`checkout/sessions/${id}`);
}

/** Verifies a Stripe webhook signature (header "Stripe-Signature": t=...,v1=...). Rejects events older than 5 minutes. */
export async function verifyWebhook(payload: string, header: string | null): Promise<boolean> {
  const secret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => safeEqual(enc.encode(s), enc.encode(expected)));
}
