// Runs Wrangler D1 commands against the LOCAL development database.
// The data lives in ~/.salon-booking-dev (short path, outside OneDrive/long folders, which Windows needs).
// Usage: node scripts/local-db.mjs migrate         -> apply migrations
//        node scripts/local-db.mjs sql "SELECT 1"  -> run a SQL command
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export const LOCAL_STATE_DIR = join(homedir(), ".salon-booking-dev");

const [cmd, ...rest] = process.argv.slice(2);
const base = ["wrangler", "d1"];
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
const r = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
