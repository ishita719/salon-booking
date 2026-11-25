-- Maple & Mane salon website — database tables for Supabase (PostgreSQL).
-- Matches src/db/schema.ts. Run with:  npm run db:setup   (or paste into Supabase → SQL Editor → Run).
-- Safe to run more than once (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'CUSTOMER',
  active boolean NOT NULL DEFAULT true,
  pin_hash text,
  phone_digits text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_phone_digits_idx ON users (phone_digits);

CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_min integer NOT NULL,
  price_cents integer NOT NULL,
  home_available boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  targets text NOT NULL DEFAULT '',
  steps text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stylists (
  id text PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  bio text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  work_days text NOT NULL DEFAULT '0,2,3,4,5,6',
  user_id text UNIQUE REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS time_off (
  id text PRIMARY KEY,
  stylist_id text NOT NULL REFERENCES stylists (id) ON DELETE CASCADE,
  date text NOT NULL,
  start_min integer NOT NULL,
  end_min integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS time_off_date_idx ON time_off (date);

CREATE TABLE IF NOT EXISTS appointments (
  id text PRIMARY KEY,
  user_id text REFERENCES users (id) ON DELETE CASCADE,
  guest_name text,
  guest_phone text,
  guest_email text,
  source text NOT NULL DEFAULT 'ONLINE',
  stylist_id text REFERENCES stylists (id) ON DELETE SET NULL,
  date text NOT NULL,
  start_min integer NOT NULL,
  end_min integer NOT NULL,
  status text NOT NULL DEFAULT 'BOOKED',
  location_type text NOT NULL DEFAULT 'SALON',
  address text,
  postal_code text,
  notes text,
  subtotal_cents integer NOT NULL DEFAULT 0,
  travel_fee_cents integer NOT NULL DEFAULT 0,
  has_custom boolean NOT NULL DEFAULT false,
  reschedule_count integer NOT NULL DEFAULT 0,
  cancelled_at timestamptz,
  discount_cents integer NOT NULL DEFAULT 0,
  offer_id text,
  offer_title text,
  payment_status text NOT NULL DEFAULT 'UNPAID',
  paid_cents integer NOT NULL DEFAULT 0,
  stripe_session_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointments_date_status_idx ON appointments (date, status);
CREATE INDEX IF NOT EXISTS appointments_user_idx ON appointments (user_id);
CREATE INDEX IF NOT EXISTS appointments_stylist_date_idx ON appointments (stylist_id, date);

CREATE TABLE IF NOT EXISTS appointment_items (
  id text PRIMARY KEY,
  appointment_id text NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  service_id text REFERENCES services (id) ON DELETE SET NULL,
  name text NOT NULL,
  duration_min integer NOT NULL,
  price_cents integer,
  is_custom boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS appointment_items_appt_idx ON appointment_items (appointment_id);

CREATE TABLE IF NOT EXISTS feedback (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  appointment_id text REFERENCES appointments (id) ON DELETE SET NULL,
  stylist_id text REFERENCES stylists (id) ON DELETE SET NULL,
  rating integer NOT NULL,
  comment text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT false,
  owner_reply text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS feedback_appointment_uq ON feedback (appointment_id);
CREATE INDEX IF NOT EXISTS feedback_stylist_idx ON feedback (stylist_id);

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  how_to_use text NOT NULL DEFAULT '',
  price_cents integer NOT NULL,
  targets text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offers (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL DEFAULT 'PERCENT',
  value integer NOT NULL,
  service_ids text NOT NULL DEFAULT '',
  categories text NOT NULL DEFAULT '',
  first_visit_only boolean NOT NULL DEFAULT false,
  starts_on text,
  ends_on text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skin_profiles (
  user_id text PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  answers text NOT NULL,
  skin_type text NOT NULL,
  sensitivity text NOT NULL,
  concerns text NOT NULL DEFAULT '',
  hair_type text NOT NULL DEFAULT '',
  hair_concerns text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gallery (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  image text,
  stylist_id text REFERENCES stylists (id) ON DELETE SET NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_views (
  id serial PRIMARY KEY,
  date text NOT NULL,
  path text NOT NULL,
  visitor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_views_date_idx ON page_views (date);

CREATE TABLE IF NOT EXISTS verification_codes (
  id text PRIMARY KEY,
  email text NOT NULL,
  purpose text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_codes_email_idx ON verification_codes (email, purpose);

CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SECURITY: Supabase also publishes every table in the "public" schema through its own web API (using the
-- public "anon" key). This website never uses that API — only the server talks to the database. So we switch
-- on Row Level Security with NO policies (= the public API can read/write nothing) and remove API access.
-- The website's server connects as the database owner, which isn't affected.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','services','stylists','time_off','appointments','appointment_items','feedback',
    'products','offers','skin_profiles','gallery','page_views','verification_codes','login_tokens','settings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
