// Creates prisma/dev/schema.prisma: a SQLite copy of the real (Postgres) schema for local development.
// Run automatically by `npm run dev` / `npm run setup`. The generated file is git-ignored.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("prisma/schema.prisma", "utf8");
const out = src
  .replace('provider  = "postgresql"', 'provider  = "sqlite"')
  .replace(/^\s*directUrl\s*=.*$/m, "");

if (!out.includes('provider  = "sqlite"')) {
  console.error("dev-schema: could not find the postgresql provider line in prisma/schema.prisma");
  process.exit(1);
}

mkdirSync("prisma/dev", { recursive: true });
writeFileSync(
  "prisma/dev/schema.prisma",
  "// AUTO-GENERATED from prisma/schema.prisma by scripts/dev-schema.mjs — do not edit.\n" + out,
);
