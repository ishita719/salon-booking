import type { Metadata } from "next";
import Link from "next/link";
import ManageTabs from "@/components/ManageTabs";
import QrPoster from "@/components/QrPoster";
import { pageUser } from "@/lib/auth";
import { publicOrigin } from "@/lib/origin";

export const metadata: Metadata = { title: "QR codes" };
export const dynamic = "force-dynamic";

export default async function OwnerQrPage() {
  await pageUser(["OWNER"]);
  const url = `${await publicOrigin()}/welcome`;

  return (
    <>
      <ManageTabs />
      <div className="container" style={{ paddingBottom: 48 }}>
        <h1>QR codes</h1>
        <p className="lead">Clients don&apos;t need to create an account: they scan, type their name and phone, and they&apos;re in — and stay signed in on their phone.</p>
        <div className="dash-cols" style={{ marginTop: 20 }}>
          <QrPoster url={url} />
          <div className="stack">
            <section className="card">
              <h3>How it works for clients</h3>
              <ol style={{ paddingLeft: 20, margin: 0 }}>
                <li>Scan the salon QR with the phone camera.</li>
                <li>Type name + mobile number (email optional).</li>
                <li>Done — they can take the skin check, see offers and book.</li>
              </ol>
            </section>
            <section className="card">
              <h3>Returning client on a new phone?</h3>
              <p className="small muted">For safety, typing a phone number that already has an account never logs anyone in by itself.</p>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                <li>If they gave an email, they get a 6-digit code by email.</li>
                <li>Otherwise, open <Link href="/owner/clients">Clients</Link> (or a staff member opens their appointment) and tap <strong>📱 Login QR</strong> — the client scans it once (valid 10 minutes).</li>
              </ul>
            </section>
            <section className="card">
              <h3>Ideas</h3>
              <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
                <li>Frame it at reception and on each station mirror.</li>
                <li>Print it on receipts, flyers and business cards.</li>
                <li>Share the link on Instagram and Google Business.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
