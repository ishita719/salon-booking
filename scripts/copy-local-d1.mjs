// OPTIONAL, for testing: copies everything from the OLD local database (Cloudflare D1, used before Supabase) into
// the database in DATABASE_URL — test clients, bookings, logins, settings. Rows that already exist are skipped.
// Don't run this against your live Supabase database unless you want the local test accounts there.
// Usage:  npm run db:copy-local
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing in .env.");
  process.exit(1);
}
const stateDir = join(homedir(), ".salon-booking-dev");
if (!existsSync(stateDir)) {
  console.error("No old local database found — nothing to copy.");
  process.exit(0);
}
const wrangler = join(dirname(createRequire(import.meta.url).resolve("wrangler/package.json")), "bin", "wrangler.js");
// The project no longer has a D1 database in wrangler.jsonc, so point Wrangler at a tiny config for the old one.
const oldConfig = join(mkdtempSync(join(tmpdir(), "old-d1-")), "wrangler.json");
writeFileSync(oldConfig, JSON.stringify({ name: "salon-booking-old", compatibility_date: "2026-11-01", d1_databases: [{ binding: "DB", database_name: "salon-db", database_id: "00000000-0000-0000-0000-000000000000" }] }));
function d1(query) {
  const r = spawnSync(process.execPath, [wrangler, "d1", "execute", "salon-db", "--local", "--persist-to", stateDir, "--config", oldConfig, "--json", "--command", query], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return JSON.parse(r.stdout)[0].results;
}

// Parents before children (foreign keys).
const TABLES = ["users", "services", "stylists", "time_off", "appointments", "appointment_items", "feedback", "products", "offers", "skin_profiles", "gallery", "page_views", "verification_codes", "login_tokens", "settings"];
const BOOL = new Set(["home_available", "active", "first_visit_only", "has_custom", "is_custom", "is_public", "used"]);
const TIME = new Set(["created_at", "updated_at", "cancelled_at", "paid_at", "expires_at", "used_at"]);
const KEY = { skin_profiles: "user_id", login_tokens: "token_hash", settings: "key" };

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : "require", onnotice: () => {} });
try {
  for (const table of TABLES) {
    const rows = d1(`SELECT * FROM ${table}`).map((r) => {
      const o = {};
      for (const [k, v] of Object.entries(r)) o[k] = v === null ? null : BOOL.has(k) ? !!v : TIME.has(k) ? new Date(Number(v)) : v;
      return o;
    });
    let added = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const res = await sql`INSERT INTO ${sql(table)} ${sql(chunk)} ON CONFLICT (${sql(KEY[table] ?? "id")}) DO NOTHING`;
      added += res.count;
    }
    console.log(`${table}: ${added} of ${rows.length} copied`);
  }
  await sql`SELECT setval(pg_get_serial_sequence('page_views', 'id'), GREATEST((SELECT max(id) FROM page_views), 1))`;
  console.log("✔ done");
} catch (e) {
  console.error("Copy failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
