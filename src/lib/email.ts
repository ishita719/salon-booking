// Email notifications. With RESEND_API_KEY set, sends real email through Resend's API.
// Without it (local dev), the email is printed to the server console so you can see it.

import { SALON } from "./config";

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[email → ${to}] ${subject}\n${text}\n`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${SALON.name} <onboarding@resend.dev>`,
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) console.error("Email send failed:", res.status, await res.text());
  } catch (e) {
    // Never fail a booking because email is down.
    console.error("Email send error:", e);
  }
}
