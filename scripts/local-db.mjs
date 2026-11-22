// Runs Wrangler D1 commands against the LOCAL development database.
// The data lives in ~/.salon-booking-dev (short path, outside OneDrive/long folders, which Windows needs).
// Usage: node scripts/local-db.mjs migrate         -> apply migrations
//        node scripts/local-db.mjs sql "SELECT 1"  -> run a SQL command
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const LOCAL_STATE_DIR = join(homedir(), ".salon-booking-dev");

const [cmd, ...rest] = process.argv.slice(2);
// Run Wrangler's own script with Node directly (no shell → SQL like "a > b" is passed safely).
const wrangler = join(dirname(createRequire(import.meta.url).resolve("wrangler/package.json")), "bin", "wrangler.js");
const base = [wrangler, "d1"];
const args =
  cmd === "migrate"
    ? [...base, "migrations", "apply", "salon-db", "--local", "--persist-to", LOCAL_STATE_DIR]
    : cmd === "sql"
      ? [...base, "execute", "salon-db", "--local", "--persist-to", LOCAL_STATE_DIR, "--command", rest.join(" ")]
      : null;
if (!args) {
  console.error('Usage: node scripts/local-db.mjs migrate | sql "<SQL>"');
  process.exit(1);
}
const r = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(r.status ?? 1);
