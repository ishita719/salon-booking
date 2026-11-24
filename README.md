# Maple & Mane Studio — Salon Booking Website

Appointment booking for a Vancouver salon that works **in the studio and at clients' homes**.
**Stack:** Next.js 15 (React 19, TypeScript) · Cloudflare Workers (via OpenNext) · Cloudflare D1 database · Drizzle ORM.
Code lives on GitHub; Cloudflare rebuilds and publishes the site on every push.

---

## What's inside

**Public website:** home page (hero, services, online skin-check, at-home visits, team, **our work gallery**, member-offers teaser, reviews, hours), services with a **"How it's done"** step-by-step page for each, gallery.

**Clients (after login, `/login`):** *For you* home · **online skin & hair check** (9 questions → skin profile, AM/PM routine, recommended treatments & products) · **personal offers** applied automatically · booking with **online payment (Stripe)** or pay at salon · appointments (reschedule, cancel, pay now, calendar) · feedback & ratings.

**Owner (`/team` → Owner):** dashboard · **Insights** (site visitors, bookings made, visit→booking rate, services booked & charges, payments online/at salon/outstanding, offers used, busiest days & times, repeat clients, skin-check trends, **CSV export**) · appointments (status, move, **mark paid / refunded**) · clients · team & **team secret code** · manage services (with *good for* tags + steps), **offers, products, gallery** (photo upload), feedback.

**Staff (`/team` → Staff + team secret code):** own schedule, take payment at the salon, time off, book walk-ins, own reviews.

## Easy sign-in

- **Clients — QR first, name + phone as backup (no passwords, no sign-up forms):**
  - **New client:** scan the salon QR (print it from **Owner → Manage → QR codes**) → type name + phone (email optional, only for confirmations) → signed in on that phone for 6 months.
  - **On a computer:** the Client login page (`/login`) shows the QR. While testing locally the QR uses your PC's network address (e.g. `http://192.168.x.x:3000`), so a phone on the same Wi-Fi can open it.
  - **QR not working?** "Log in with name & phone": a returning client types their first name + phone number. The first name must match the account; 5 tries per number per hour, and a "new sign-in" email is sent if the client has an email. (Weaker than the QR — anyone who knows a client's name and number could log in.)
  - **Front-desk login QR** (one-time, 10 minutes) still works: Owner → Clients or staff on an appointment → **📱 Login QR**.
- **Owner:** **secret code only** (Team login → Owner). Temporary code until changed: **0092** — short and easy to guess, so change it right away in **Settings → Secret code** (6–32 letters, numbers or dashes; every owner's code must be different).
  - 10 wrong codes in 15 minutes locks owner login for 15 minutes (for everyone).
  - **Forgot secret code?** → owner email → 6-digit code → set a new secret code.
  - **New owner account** (`/team/setup`): name + email + secret code. The first owner also sets the staff team code (and `SETUP_CODE` if configured); later owners must first be **invited by an existing owner** (Owner → Team → Co-owners).
- **Staff:** email + password + the team secret code (unchanged).
- Owner email codes need `RESEND_API_KEY` in production. In local development without it, the code is shown on screen in a yellow "Test mode" box.

## Who uses it

| | **Client** | **Staff** | **Owner** |
|---|---|---|---|
| Login page | `/login` (client login) | `/team` → **Staff** | `/team` → **Owner** |
| Sign up | scan the QR, or name + phone | `/team/join` — needs the **staff code** | `/team/setup` — name + email + secret code (invite needed after the first owner) |
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

Create your local secrets (first time only): copy `.env.example` to **both** `.env` and `.dev.vars`, then fill in `AUTH_SECRET` and `SETUP_CODE`.

```bash
copy .env.example .env
```

```bash
copy .env.example .dev.vars
```

Create the local database (tables + starter services/team). Data is stored in `%USERPROFILE%\.salon-booking-dev`:

```bash
npm run setup
```

Start the site:

```bash
npm run dev
```

Open http://localhost:3000, go to **/team/setup** and create the owner account with your `SETUP_CODE`. Then on **Owner → Team** generate a staff code.

| Command | What it does |
|---|---|
| `npm run dev` | Local site with hot reload (uses the local D1 database) |
| `npm run preview` | Builds for Cloudflare and runs it in Cloudflare's real runtime locally |
| `npm test` | Time-slot / availability tests |
| `npm run lint` | Type-checks the project |
| `npm run db:migrate:local` | Applies new SQL files in `migrations/` to the local database |
| `npm run db:sql:local "SELECT * FROM users"` | Run SQL on the local database |

---

## Deploy on Cloudflare (connected to GitHub)

### 1. Create the database
Cloudflare dashboard → **Storage & Databases → D1 → Create database** → name it **`salon-db`** (location: Western North America).
Copy its **Database ID** and put it in `wrangler.jsonc` → `d1_databases[0].database_id`, then commit and push.

### 2. Connect the GitHub repo
**Workers & Pages → Create → Import a repository** → connect GitHub → pick **salon-booking**. Settings:

| Setting | Value |
|---|---|
| Project name | `salon-booking` (must match `name` in `wrangler.jsonc`) |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler d1 migrations apply salon-db --remote && npx opennextjs-cloudflare deploy` |
| Root directory | `/` |

Click **Deploy**. Every push to `main` now rebuilds and publishes automatically, and new database migrations are applied first.

### 3. Add the secrets
**salon-booking → Settings → Variables and Secrets** → add as type **Secret**:

| Name | Value |
|---|---|
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

---

## Project structure

```
migrations/            SQL for the D1 database (0001 tables, 0002 starter menu & team)
wrangler.jsonc         Cloudflare Worker + D1 configuration
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
