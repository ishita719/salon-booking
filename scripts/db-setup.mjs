// Creates the tables in your Supabase database and adds the starter menu/team/products/offers.
// Usage:  npm run db:setup          (reads DATABASE_URL from .env)
// Safe to run again: each file in supabase/migrations runs only once, and the starter data never overwrites edits.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Put your Supabase connection string in .env first (see .env.example).");
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : "require", onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS _salon_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE _salon_migrations ENABLE ROW LEVEL SECURITY`;
  const done = new Set((await sql`SELECT name FROM _salon_migrations`).map((r) => r.name));
  const dir = join("supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, file), "utf8"));
      await tx`INSERT INTO _salon_migrations (name) VALUES (${file})`;
    });
    console.log(`✔ applied ${file}`);
  }
  await sql.unsafe(readFileSync(join("supabase", "seed.sql"), "utf8"));
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM services`;
  console.log(`✔ starter data ready (${n} services). Database is set up.`);
} catch (e) {
  console.error("Database setup failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
