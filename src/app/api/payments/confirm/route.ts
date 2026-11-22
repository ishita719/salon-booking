import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { applyPaidSession } from "@/lib/payments";
import { retrieveCheckoutSession } from "@/lib/stripe";

// Stripe sends the client back here after paying. We ask Stripe directly whether the session is paid
// (never trusting the URL alone), record it, then show the client their appointments.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("session_id") ?? "";
  const back = (q: string) => NextResponse.redirect(new URL(`/account/appointments?${q}`, req.url));
  try {
    const session = await retrieveCheckoutSession(id);
    const apptId = await applyPaidSession(getDb(), session);
    return back(apptId ? "paid=1" : "payment=pending");
  } catch (e) {
    console.error("Payment confirm failed", e);
    return back("payment=pending");
  }
}
