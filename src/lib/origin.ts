import { headers } from "next/headers";

/** The PC's Wi-Fi/LAN address (e.g. 192.168.1.5) — only used while testing on your own computer. */
async function lanAddress(): Promise<string | null> {
  try {
    const os = await import("node:os");
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list ?? []) {
        if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) return a.address;
      }
    }
  } catch {}
  return null;
}

/**
 * The website address to put inside QR codes.
 * Live site: its real address. Local testing: "localhost" only works on the PC itself, so phones would fail —
 * we swap in the PC's Wi-Fi address so a phone on the same Wi-Fi can open it.
 */
export async function publicOrigin(): Promise<string> {
  const h = await headers();
  let host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  if (local && process.env.NODE_ENV !== "production") {
    const lan = await lanAddress();
    if (lan) host = host.replace(/^(\[::1\]|[^:]+)/, lan);
  }
  const proto = h.get("x-forwarded-proto") ?? (local || /^\d+\.\d+\.\d+\.\d+(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
