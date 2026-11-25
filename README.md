# Maple & Mane Studio — Salon Booking Website

Appointment booking for a Vancouver salon that works **in the studio and at clients' homes**.
**Stack:** Next.js 15 (React 19, TypeScript) · Cloudflare Workers (via OpenNext) · **PostgreSQL database** (on your PC for development; Supabase or Neon when live) · Drizzle ORM.
Code lives on GitHub; Cloudflare rebuilds and publishes the site on every push.

---

## What's inside

**Public website:** home page (hero, services, online skin-check, at-home visits, team, **our work gallery**, member-offers teaser, reviews, hours), services with a **"How it's done"** step-by-step page for each, gallery.

**Clients (after login, `/login`):** *For you* home · **online skin, hair & nails check** (optional **camera scan** + 10 questions → skin profile, AM/PM routine, recommended treatments & products) · **personal offers** applied automatically · booking with **online payment (Stripe)** or pay at salon · appointments (reschedule, cancel, pay now, calendar) · feedback & ratings.

**Owner (`/team` → Owner):** dashboard · **Insights** (site visitors, bookings made, visit→booking rate, services booked & charges, payments online/at salon/outstanding, offers used, busiest days & times, repeat clients, skin-check trends, **CSV export**) · appointments (status, move, **mark paid / refunded**) · clients · team & **team secret code** · manage services (with *good for* tags + steps), **offers, products, gallery** (photo upload), feedback.

**Staff (`/team` → Staff + team secret code):** own schedule, take payment at the salon, time off, book walk-ins, own reviews.

## Easy sign-in

- **Clients — QR first, name + phone as backup (no passwords, no sign-up forms):**
  - **Scanning the salon QR opens online booking** (print it from **Owner → Manage → QR codes**). Not signed in yet → type name + phone (email optional, only for confirmations) → straight on to booking, and that phone stays signed in for 6 months. Next time the scan goes directly to booking.
  - **On a computer:** the Client login page (`/login`) shows the QR. While testing locally the QR uses your PC's network address (e.g. `http://192.168.x.x:3000`), so a phone on the same Wi-Fi can open it.
  - **QR not working?** "Log in with name & phone": a returning client types their first name + phone number. The first name must match the account; 5 tries per number per hour, and a "new sign-in" email is sent if the client has an email. (Weaker than the QR — anyone who knows a client's name and number could log in.)
  - **Front-desk login QR** (one-time, 10 minutes) still works: Owner → Clients or staff on an appointment → **📱 Login QR**.
- **Owner:** **secret code only** (Team login → Owner). Temporary code until changed: **0092** — short and easy to guess, so change it right away in **Settings → Secret code** (6–32 letters, numbers or dashes; every owner's code must be different).
  - 10 wrong codes in 15 minutes locks owner login for 15 minutes (for everyone).
  - **Forgot secret code?** → owner email → 6-digit code → set a new secret code.
  - **New owner account** (`/team/setup`): name + email + secret code — no invite needed. The very first owner is active at once (and also sets the staff team code, plus `SETUP_CODE` if configured). Every later owner account **waits for approval**: existing owners see it on the dashboard and approve or decline it on **Owner → Team → Co-owners** (they also get an email). Until then that secret code can't log in.
- **Staff:** email + password + the team secret code (unchanged).
- Owner email codes need `RESEND_API_KEY` in production. In local development without it, the code is shown on screen in a yellow "Test mode" box.

## Camera skin, hair & nails scan

Clients → **Skin check** → "📷 Start with a camera scan" (or "Answer questions only").

- Three scans, each optional: **Face** (oval guide), **Hair** and **Hands & nails** (box guide). Live camera, or "Take or upload a photo" (which opens the phone camera too).
- **Runs on the phone** (`src/lib/scan.ts`): the photo is analysed in the browser and **never uploaded or saved**.
- What it measures:
  - **Face:** shine on the T-zone vs cheeks → oily / combination / dry / normal; pores & texture, redness, red or dark spots, radiance.
  - **Hair:** strand direction → straight / wavy / curly / coily; frizz, shine (dryness/damage), grey or fashion colour, scalp showing.
  - **Hands:** dry skin & cuticles, nail polish.
- Rejects photos that are too dark, too bright, blurry, or don't show a face/hair/hand.
- The results **pre-fill the quiz** (marked "📷 from your scan"). The client confirms or changes them, then gets their profile, routine, treatments (one pick per area first: skin, hair, colour, nails…), products and offers.
- It's an estimate from simple image measurements (lighting matters), not a medical diagnosis — the page says so, and the stylist confirms at the visit.
- The **live camera needs https** (works on the Cloudflare site). On the local Wi-Fi address (`http://192.168…`) phones block the live camera, so use "Take or upload a photo" there.

## Who uses it

| | **Client** | **Staff** | **Owner** |
|---|---|---|---|
| Login page | `/login` (client login) | `/team` → **Staff** | `/team` → **Owner** |
| Sign up | scan the QR, or name + phone | `/team/join` — needs the **staff code** | `/team/setup` — name + email + secret code (approved by an existing owner) |
| At every login | QR, or first name + phone | email + password + **staff code** | **secret code** only |
| Can do | book, reschedule/cancel own bookings, **send feedback** | own schedule, confirm/done/no-show, move/cancel own bookings, time off, book walk-ins, read own reviews | everything: dashboard, all appointments, team, **staff code**, clients, feedback, services |

**Staff code:** the owner sets it on **Owner → Team**. Staff need it to create an account *and* every time they log in.
When the owner changes it, **every staff member is logged out** immediately (useful when someone leaves). Staff sessions also expire after 12 hours.

**Feedback:** clients rate a finished visit (1–5 ★) or send general feedback from **Feedback** in their menu.
The owner sees all of it, can reply, and can choose reviews to **show on the home page** (first name + initial only). Staff see reviews about their own visits, without the client's contact details.

Everything is enforced **on the server** (every API route re-checks the user's role in the database), not just hidden in the menu.

---

## Run it on your computer

Needs **Node.js 20+** and **Git**.

```bash
cd salon-booking
npm install
```

Create your local secrets (first time only): copy `.env.example` to **both** `.env` and `.dev.vars`, then fill in `AUTH_SECRET`, `SETUP_CODE` and `DATABASE_URL` (see **PostgreSQL on your PC** below).

```bash
copy .env.example .env
```

```bash
copy .env.example .dev.vars
```

### PostgreSQL on your PC
Install PostgreSQL 17 (it runs as the Windows service `postgresql-x64-17` and starts with Windows):

```powershell
winget install --id PostgreSQL.PostgreSQL.17 -e
```

Create a database and a user for the website (in **SQL Shell (psql)** as `postgres`), choosing your own password:

```sql
CREATE ROLE salon_app LOGIN PASSWORD 'choose-a-password';
CREATE DATABASE salon OWNER salon_app;
```

Then in `.env` and `.dev.vars`: `DATABASE_URL="postgresql://salon_app:choose-a-password@localhost:5432/salon"`.

Create the tables and starter services/team/products/offers (safe to run again):

```bash
npm run db:setup
```

Start the site:

```bash
npm run dev
```

Open http://localhost:3000, go to **/team/setup** and create the owner account with your `SETUP_CODE`. Then on **Owner → Team** generate a staff code.

| Command | What it does |
|---|---|
| `npm run dev` | Local site with hot reload (uses the database in `DATABASE_URL`) |
| `npm run preview` | Builds for Cloudflare and runs it in Cloudflare's real runtime locally |
| `npm test` | Time-slot / availability tests |
| `npm run lint` | Type-checks the project |
| `npm run db:setup` | Creates/updates the tables (`supabase/migrations`) and adds the starter data (`supabase/seed.sql`) |
| `npm run db:offline` | Optional: a PostgreSQL database on your own PC for testing without internet (`localhost:5433`) |
| `npm run db:copy-local` | Optional: copies the old local test data (from before Supabase) into `DATABASE_URL` |

---

## Supabase database (for the live site — optional for now)

The website's data (clients, bookings, team, services, offers, feedback, payments, settings) lives in **Supabase**,
which runs a PostgreSQL database for you. Only the website's **server** talks to it, using `DATABASE_URL`:
the browser never connects to the database, and the Supabase API keys are **not** used.

1. Sign up at **supabase.com** → **New project** → name `salon-booking`, region **West US (North California)**
   (closest to Vancouver) → choose a strong **database password** and save it in your password manager.
2. In the project, click **Connect** → **Transaction pooler** → copy the URI. It looks like
   `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`.
   Replace `[YOUR-PASSWORD]` with your database password.
3. Put it in `.env` **and** `.dev.vars` as `DATABASE_URL="…"`, then run `npm run db:setup`.
4. Check it in Supabase → **Table Editor**: you'll see the tables and the starter services.

Security: every table has **Row Level Security switched on with no policies**, and the public `anon`/`authenticated`
roles have no access — so Supabase's public API can't read or change anything, even if someone finds the project URL.
Keep `DATABASE_URL` secret (it contains the database password).

---

## Deploy on Cloudflare (connected to GitHub)

### 1. Set up the database
Do the **Supabase database** steps above (once). New tables or columns go in a new file in `supabase/migrations/`;
run `npm run db:setup` before deploying a change that needs them.

### 2. Connect the GitHub repo
**Workers & Pages → Create → Import a repository** → connect GitHub → pick **salon-booking**. Settings:

| Setting | Value |
|---|---|
| Project name | `salon-booking` (must match `name` in `wrangler.jsonc`) |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Root directory | `/` |

Click **Deploy**. Every push to `main` now rebuilds and publishes automatically.

### 3. Add the secrets
**salon-booking → Settings → Variables and Secrets** → add as type **Secret**:

| Name | Value |
|---|---|
| `DATABASE_URL` | your Supabase **Transaction pooler** connection string (with the password filled in) |
| `AUTH_SECRET` | long random string (48+ characters) |
| `SETUP_CODE` | private one-time code for creating the owner account |
| `STRIPE_SECRET_KEY` | optional — Stripe secret key (start with `sk_test_…`) to accept online payments |
| `STRIPE_WEBHOOK_SECRET` | optional — from Stripe → Webhooks (endpoint `https://<your-site>/api/payments/webhook`, event `checkout.session.completed`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional, for real confirmation emails via resend.com |

Then **Deployments → Retry/Redeploy** so the secrets are picked up.

### 4. Create the owner, then the team
1. Open `https://<your-site>.workers.dev/team/setup` → create the owner account with `SETUP_CODE` (works only once) and **choose the team secret code** there.
2. Give the team secret code privately to staff (you can change it any time on **Owner → Team**).
3. Staff create their accounts at `/team/join`.
4. Optional: add your own domain under **salon-booking → Settings → Domains & Routes**.

---

## Security built in

- Passwords hashed with **PBKDF2-SHA256 (100,000 rounds, random salt)** — never stored in plain text
- Sessions: signed tokens in **httpOnly, Secure, SameSite=Lax** cookies; staff sessions are tied to the current staff code and last 12 h
- Separate client and team logins; each login refuses the wrong kind of account
- Owner setup closes permanently once an owner exists; codes are compared in constant time and are not case-sensitive
- Every API route checks login, role and ownership (clients only see their own bookings, staff only theirs)
- Input validation (Zod) on every request, rate limiting on logins, sign-ups, staff code attempts and bookings
- CSRF protection (origin check + SameSite cookies), no open redirects, security headers (CSP, HSTS, X-Frame-Options…)
- Double-booking guard: after saving, the booking is re-checked; if two people grabbed the same slot, the later one is asked to pick again
- Secrets only in Cloudflare secrets / local `.env` + `.dev.vars` (all git-ignored)
- Database: Supabase tables have Row Level Security on with no policies, so only the website's server can read or write them

---

## Project structure

```
supabase/migrations/   SQL for the Supabase (PostgreSQL) tables
supabase/seed.sql      starter menu, team, products, offers, gallery
scripts/               db-setup (create tables), db-offline (optional local PostgreSQL), copy-local-d1
wrangler.jsonc         Cloudflare Worker configuration
open-next.config.ts    Next.js → Cloudflare adapter
src/
  db/schema.ts         tables (users, services, stylists, time_off, appointments, appointment_items, feedback, settings)
  middleware.ts        sends each role to its own portal / login
  lib/                 auth, sessions, staff code, passwords, bookings, availability, feedback, stats, validation
  app/
    page.tsx           home page
    login, register    CLIENT login / sign-up
    team/              TEAM login, staff join (/team/join), owner setup (/team/setup)
    account/           client: appointments, feedback, reschedule
    staff/             staff: schedule, time off, reviews
    owner/             owner: dashboard, appointments, team (+ staff code), clients, feedback, services
    api/               backend endpoints
  components/          UI (forms, boards, cards, icons)
tests/                 unit tests
```
