import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

// The database is Supabase (PostgreSQL). The server connects with DATABASE_URL — Supabase's connection pooler
// ("Transaction pooler", port 6543). The browser never talks to the database directly.

function connect(url: string) {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url); // optional offline database (npm run db:offline)
  const client = postgres(url, {
    prepare: false, // required by Supabase's transaction pooler
    max: local ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : "require",
  });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof connect>;
// On Cloudflare a connection can't be shared between requests, so we keep one per request.
// In local development (plain Node) one shared connection pool is fine.
const perRequest = new WeakMap<object, Db>();
const g = globalThis as unknown as { __salonDb?: Db };

export function getDb(): Db {
  const url = getEnv("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is missing. Add your Supabase connection string to .env (see .env.example).");
  if (process.env.NODE_ENV !== "production") return (g.__salonDb ??= connect(url));
  let key: object | undefined;
  try {
    key = getCloudflareContext().ctx as unknown as object;
  } catch {
    key = undefined;
  }
  if (!key) return (g.__salonDb ??= connect(url));
  let db = perRequest.get(key);
  if (!db) perRequest.set(key, (db = connect(url)));
  return db;
}

export type DB = Db;
export { schema };
