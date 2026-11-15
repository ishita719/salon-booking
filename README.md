# Maple & Mane Studio — Salon Booking Website

A full-stack appointment booking site for a Vancouver salon that works **in-studio and at clients' homes**.
It's built with **Next.js 15 (React 19, TypeScript)**, a **Prisma** database layer (SQLite locally, Postgres in production), and secure cookie-based login.

---

## Three portals — one website

Everyone logs in on the same page; the site shows each person only what their role needs.

| | Client | Staff (stylist) | Owner |
|---|---|---|---|
| Lands on | `/account` — My appointments | `/staff` — My schedule | `/owner` — Dashboard |
| Book | for themselves | for a walk-in / phone client | for a walk-in / phone client |
| Sees appointments | only their own | only ones assigned to them | everyone's |
| Change status (confirm / done / no-show) | — | own appointments | all |
| Reschedule / cancel | own, up to 12 h before | own clients, any time | any, any time |
| Delete appointments | own cancelled/past ones | — (cancel instead) | any |
| Time off | — | own | anyone's |
| Team, staff logins, working days | — | — | ✓ |
| Clients list & history | — | — | ✓ |
| Services & prices | — | — | ✓ |
| Revenue & business stats | — | — | ✓ |

Every rule above is enforced **on the server** (API routes re-check the role from the database on every request), not just hidden in the menu.

## What it does

**Owner portal**
- **Dashboard**: revenue this month (completed visits), booked revenue ahead, today / next 7 days / upcoming counts, new clients, no-show rate, % booked online, at-home visits, today's schedule, team performance, top services
- **Appointments**: by day, upcoming, or last 60 days; filter by stylist and status; change status, move, delete
- **Team**: add staff (creates their login), set working days, edit bio/title, reset passwords, deactivate leavers (blocks login instantly; history kept), manage everyone's time off
- **Clients**: registered clients + walk-ins, with visits, upcoming, total spent, last visit, no-shows and full history; search
- **Services**: add / edit / hide services, prices, durations, at-home availability

**Staff portal**
- **My schedule**: day view (← →) and upcoming list of *their own* appointments, with client phone, services, notes, home-visit address + directions link
- One-tap **Confirm / Done / No-show / Move / Cancel**
- **Time off**: block whole days or hours (can't block time that already has bookings)
- **Book a client** (walk-ins can be booked right away — no 2-hour notice)

**For clients**
- Create an account and log in (passwords hashed with bcrypt, sessions in secure httpOnly cookies)
- Book an appointment:
  - pick one or more services from the menu, **or type in a custom service** (the stylist quotes it at the visit)
  - choose **In studio** or **At my home** (address + postal code checked against the service area; $25 travel fee)
  - choose a stylist, or "any available"
  - see **live available times** only (no double-booking, respects opening hours, 2-hour notice, travel time between home visits)
  - add notes (allergies, buzzer code…)
- **My appointments**: upcoming / past & cancelled tabs
  - **Reschedule** (up to 12 h before, max 3 times)
  - **Cancel** (up to 12 h before)
  - **Delete** cancelled or past appointments from history
  - **Add to calendar** (.ics file for Google / Apple / Outlook)
- Edit profile and change password (everyone — also staff and owner under **Settings**)
- Confirmation emails for booking / reschedule / cancel (printed to the console locally; real email via Resend in production)
- Only stylists who **work that day** and aren't on **time off** are offered

Business rules (opening hours, notice period, travel fee, service area, cancellation window) live in one file: [`src/lib/config.ts`](src/lib/config.ts).

---

## Run it on your computer

You need **Node.js 20+** (https://nodejs.org) and **Git** (https://git-scm.com).

```bash
cd salon-booking
npm install
```

Create your settings file (first time only) — copy `.env.example` to `.env` and fill in `AUTH_SECRET` and `OWNER_PASSWORD` (and `STAFF_PASSWORD` if you want demo staff logins):

```bash
copy .env.example .env
```

Generate a strong `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Create the database and add the services, team and owner account:

```bash
npm run setup
```

Start the site:

```bash
npm run dev
```

Open http://localhost:3000.
- **Client**: click **Book now** → create an account → lands on **My appointments**.
- **Owner**: log in with `OWNER_EMAIL` / `OWNER_PASSWORD` from `.env` → lands on the **Owner dashboard**.
- **Staff**: `aiko@salon.test`, `marco@salon.test` or `priya@salon.test` with `STAFF_PASSWORD` from `.env` (demo only) → lands on **My schedule**. Real staff are added by the owner under **Team**.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the availability/time-slot tests |
| `npm run lint` | Type-checks the whole project |
| `npm run build` | Production build (what Vercel runs) |
| `npx prisma studio` | Opens a visual editor for the database |

---

## Put it on GitHub

1. On github.com create a **new private repository** (e.g. `salon-booking`). Don't add a README.
2. In the `salon-booking` folder:

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Initial salon booking website"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/YOUR-ACCOUNT/salon-booking.git
```

```bash
git push -u origin main
```

`.env` and the local database are in `.gitignore`, so **secrets are never uploaded**. Double-check with `git status` before your first push.

---

## Deploy to Vercel (production)

SQLite files don't persist on Vercel, so production uses a hosted **Postgres** database.

1. **Create the database** — in Vercel: *Storage → Create → Neon (Postgres)*, region close to Vancouver (e.g. `us-west-2` / Oregon). Copy its connection string.
2. **Switch Prisma to Postgres** — in `prisma/schema.prisma` change:
   ```prisma
   provider = "postgresql"
   ```
   Commit and push.
3. **Create the tables + seed data** (once, from your computer) — temporarily put the Neon URL in your `.env` as `DATABASE_URL`, then:

```bash
npm run setup
```

   Afterwards put your local `DATABASE_URL` back if you want to keep developing on SQLite (you'll need to switch the provider back too — or simply use a second free Neon database for development).
4. **Import the project** — Vercel → *Add New → Project* → pick the GitHub repo. Framework: Next.js (auto-detected).
5. **Environment variables** (Vercel → Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string (pooled) |
   | `AUTH_SECRET` | a **new** random 48-byte string (don't reuse your local one) |
   | `RESEND_API_KEY` | optional, from resend.com, for real emails |
   | `EMAIL_FROM` | e.g. `Maple & Mane <bookings@yourdomain.com>` (domain verified in Resend) |

6. **Deploy.** Every push to `main` redeploys automatically; pull requests get preview URLs.
7. Add the salon's domain in Vercel → *Domains* (HTTPS is automatic).

---

## Security checklist (already built in)

- Passwords hashed with **bcrypt (cost 12)**; never stored or logged in plain text
- Sessions are signed JWTs in **httpOnly, Secure, SameSite=Lax** cookies (not readable by page scripts)
- Every API route checks login and **ownership** — clients can only see/change their own appointments; admin routes re-check the role from the database
- **Input validation** on every request with Zod (lengths, formats, postal codes, dates)
- **Origin check** on all write requests + SameSite cookies → CSRF protection
- **Rate limiting** on login, sign-up and booking; generic login error so emails can't be enumerated
- **No open redirects** after login; React escapes output (XSS)
- Booking runs in a **serializable database transaction** so two people can't grab the same slot
- Security headers: Content-Security-Policy, HSTS, X-Frame-Options (no clickjacking), nosniff, Referrer-Policy
- Secrets only in environment variables; `.env` is git-ignored

**Before going live with real clients**
- Use a long unique `OWNER_PASSWORD` and a fresh `AUTH_SECRET` in production, and leave `STAFF_PASSWORD` empty (add real staff from **Owner → Team**; each one changes their temporary password under **Settings**)
- For high traffic, move rate limiting to a shared store (Upstash Redis) — see `src/lib/rate-limit.ts`
- Add a privacy policy page (BC's **PIPA** applies to personal info like names, phones and home addresses)
- Turn on GitHub **Dependabot** alerts and 2-factor auth on GitHub and Vercel

---

## Project structure

```
prisma/
  schema.prisma          database tables (User, Service, Stylist, Appointment, AppointmentItem)
  seed.ts                services, stylists, admin account
src/
  middleware.ts          redirects logged-out users / non-admins
  lib/
    config.ts            ← salon name, hours, rules, travel fee, service area
    availability.ts      free-slot calculation
    bookings.ts          booking logic shared by API routes
    auth.ts, session-token.ts   login sessions
    validation.ts        all input rules
  app/
    page.tsx             home
    services/            service menu
    book/                booking page
    account/             my appointments, reschedule, profile
    owner/               owner portal: dashboard, appointments, team, clients, services
    staff/               staff portal: my schedule, time off, move appointment
    settings/            profile + password (all roles)
    api/                 backend endpoints (auth, services, availability, appointments)
  components/            UI pieces (BookingForm, SlotPicker, AccountView, AdminDashboard…)
tests/                   unit tests
```

## Ideas for next versions
- SMS reminders (Twilio) the day before
- Online deposits / no-show fee with Stripe
- Stylist logins with their own schedules and days off
- Waitlist when a day is full; Google reviews link after a completed visit
