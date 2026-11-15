// Fills the database with services, the team (with staff logins) and the owner account.
// Safe to run more than once.  Run with:  npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";

// Load .env when run directly with tsx.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const prisma = new PrismaClient();

const services = [
  // category, name, minutes, price (CAD), at-home?, description
  ["Hair", "Women's Cut & Style", 60, 85, true, "Consultation, wash, precision cut and blow-dry."],
  ["Hair", "Men's Cut", 30, 45, true, "Classic or modern cut with a hot-towel finish."],
  ["Hair", "Kids' Cut (under 12)", 30, 30, true, "Gentle, quick cuts for little ones."],
  ["Hair", "Blow-dry & Style", 45, 55, true, "Wash and a smooth or voluminous blow-out."],
  ["Colour", "Root Touch-up", 90, 110, false, "Single-process colour on regrowth."],
  ["Colour", "Full Balayage", 180, 260, false, "Hand-painted, sun-kissed highlights incl. toner."],
  ["Colour", "Gloss / Toner", 45, 65, false, "Refresh tone and add shine."],
  ["Treatments", "Keratin Smoothing", 150, 290, false, "Frizz-free, smoother hair for up to 3 months."],
  ["Treatments", "Scalp & Hair Spa", 45, 70, true, "Deep-conditioning mask with scalp massage."],
  ["Nails", "Classic Manicure", 45, 40, true, "Shape, cuticle care and polish."],
  ["Nails", "Gel Pedicure", 60, 65, true, "Long-lasting gel polish with foot soak."],
  ["Skin", "Signature Facial", 60, 95, true, "Cleanse, exfoliate, mask and hydrate."],
  ["Bridal & Events", "Event Hair & Makeup", 120, 220, true, "Camera-ready look for weddings and events."],
] as const;

// name, title, bio, login email, work days (0 = Sun)
const team = [
  ["Aiko Tanaka", "Senior Colourist", "Balayage and lived-in colour specialist, 12 years experience.", "aiko@salon.test", "2,3,4,5,6"],
  ["Marco Silva", "Master Barber", "Fades, beard sculpting and classic men's grooming.", "marco@salon.test", "0,3,4,5,6"],
  ["Priya Sharma", "Stylist & Esthetician", "Bridal styling, facials and nail art.", "priya@salon.test", "0,2,3,4,6"],
] as const;

async function main() {
  // Starter menu — only when there are no services yet, so the owner's later edits are never overwritten
  // (this script runs on every Vercel deploy).
  if ((await prisma.service.count()) === 0) {
    for (const [category, name, durationMin, price, homeAvailable, description] of services) {
      await prisma.service.create({ data: { category, name, durationMin, priceCents: price * 100, homeAvailable, description } });
    }
    console.log(`Created ${services.length} starter services.`);
  }
  const firstRun = (await prisma.stylist.count()) === 0;

  // Older databases used role "ADMIN" for the owner.
  await prisma.user.updateMany({ where: { role: "ADMIN" }, data: { role: "OWNER" } });

  // Starter team — only on the very first run (the owner manages the team afterwards).
  const staffPassword = process.env.STAFF_PASSWORD;
  for (const [name, title, bio, email, workDays] of team) {
    let stylist = await prisma.stylist.findFirst({ where: { name } });
    if (!stylist && !firstRun) continue;
    if (!stylist) stylist = await prisma.stylist.create({ data: { name, title, bio, workDays } });
    if (staffPassword && !stylist.userId) {
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name, phone: "604-555-0100", role: "STAFF", passwordHash: await bcrypt.hash(staffPassword, 12) },
      });
      await prisma.stylist.update({ where: { id: stylist.id }, data: { userId: user.id } });
    }
  }
  if (staffPassword) console.log(`Staff logins ready: ${team.map((t) => t[3]).join(", ")}`);

  const email = (process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL)?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD || process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 10) throw new Error("OWNER_PASSWORD must be at least 10 characters.");
    await prisma.user.upsert({
      where: { email },
      update: { role: "OWNER", active: true },
      create: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: "OWNER",
        name: process.env.OWNER_NAME || "Salon Owner",
        phone: "604-555-0123",
      },
    });
    console.log(`Owner account ready: ${email}`);
  } else {
    console.log("OWNER_EMAIL / OWNER_PASSWORD not set — skipped owner account.");
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
