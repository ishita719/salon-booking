// OPTIONAL: a small PostgreSQL database that runs on your own PC (no internet, no Supabase account), for testing.
// Usage:  npm run db:offline   then in .env:  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres"
// Data is kept in ~/.salon-booking-dev/postgres. Stop with Ctrl+C. The real website uses Supabase.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const dir = join(homedir(), ".salon-booking-dev", "postgres");
mkdirSync(dir, { recursive: true });
const db = await PGlite.create(dir);
const server = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await server.start();
console.log("Offline PostgreSQL running on localhost:5433 (data in " + dir + "). Press Ctrl+C to stop.");
const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
