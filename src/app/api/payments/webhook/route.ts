import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { applyPaidSession } from "@/lib/payments";
import { CheckoutSession, verifyWebhook } from "@/lib/stripe";

// Stripe → this site: "checkout.session.completed". Signature-checked with STRIPE_WEBHOOK_SECRET.
// In Stripe: Developers → Webhooks → Add endpoint → https://<your-site>/api/payments/webhook
export async function POST(req: NextRequest) {
  const payload = await req.text();
  if (!(await verifyWebhook(payload, req.headers.get("stripe-signature")))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: CheckoutSession } };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await applyPaidSession(getDb(), event.data.object);
  }
  return NextResponse.json({ received: true });
}
