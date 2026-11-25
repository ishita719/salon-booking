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
  const url = `${await publicOrigin()}/book`;

  return (
    <>
      <ManageTabs />
      <div className="container" style={{ paddingBottom: 48 }}>
        <h1>QR codes</h1>
        <p className="lead">Scanning the QR opens online booking. First-timers type just their name and phone, and their phone stays signed in — next time the scan goes straight to booking.</p>
        <div className="dash-cols" style={{ marginTop: 20 }}>
          <QrPoster url={url} />
          <div className="stack">
            <section className="card">
              <h3>How it works for clients</h3>
              <ol style={{ paddingLeft: 20, margin: 0 }}>
                <li>Scan the salon QR with the phone camera.</li>
                <li>Not signed in yet? Type name + mobile number (email optional).</li>
                <li>Booking opens: pick a service, stylist and time. They can also do the camera skin &amp; hair scan for recommendations.</li>
              </ol>
            </section>
            <section className="card">
              <h3>Returning client on a new phone?</h3>
              <p className="small muted">They type the first name they signed up with and their phone number. If the name doesn&apos;t match:</p>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                <li>Open <Link href="/owner/clients">Clients</Link> (or a staff member opens their appointment) and tap <strong>📱 Login QR</strong> — the client scans it once (valid 10 minutes).</li>
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
