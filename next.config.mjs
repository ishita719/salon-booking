import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { homedir } from "node:os";
import { join } from "node:path";

// Lets `next dev` use Cloudflare bindings (the local D1 database) exactly like production.
// Local data is kept in ~/.salon-booking-dev (same place as `npm run db:migrate:local`).
initOpenNextCloudflareForDev({ persist: { path: join(homedir(), ".salon-booking-dev", "v3") } });

const isDev = process.env.NODE_ENV !== "production";

// Security headers applied to every response.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Clients sign in with the salon QR code only — the old sign-up page now points to the QR login page.
  async redirects() {
    return [{ source: "/register", destination: "/login", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
