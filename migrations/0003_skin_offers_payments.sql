-- Skin check, products, offers, gallery, site visits and payments.

-- Services: what each one is good for (used by the skin check) + how it's done, step by step.
ALTER TABLE `services` ADD `targets` text DEFAULT '' NOT NULL;
ALTER TABLE `services` ADD `steps` text DEFAULT '' NOT NULL;

-- Appointments: offers + payment.
ALTER TABLE `appointments` ADD `discount_cents` integer DEFAULT 0 NOT NULL;
ALTER TABLE `appointments` ADD `offer_id` text;
ALTER TABLE `appointments` ADD `offer_title` text;
ALTER TABLE `appointments` ADD `payment_status` text DEFAULT 'UNPAID' NOT NULL; -- UNPAID | PENDING | PAID_ONLINE | PAID_IN_SALON | REFUNDED
ALTER TABLE `appointments` ADD `paid_cents` integer DEFAULT 0 NOT NULL;
ALTER TABLE `appointments` ADD `stripe_session_id` text;
ALTER TABLE `appointments` ADD `paid_at` integer;

CREATE TABLE `products` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `brand` text DEFAULT '' NOT NULL,
  `category` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `how_to_use` text DEFAULT '' NOT NULL,
  `price_cents` integer NOT NULL,
  `targets` text DEFAULT '' NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `offers` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `discount_type` text DEFAULT 'PERCENT' NOT NULL, -- PERCENT | AMOUNT
  `value` integer NOT NULL,                        -- percent (1-90) or cents
  `service_ids` text DEFAULT '' NOT NULL,          -- comma list; empty = not limited by service
  `categories` text DEFAULT '' NOT NULL,           -- comma list; empty = not limited by category
  `first_visit_only` integer DEFAULT 0 NOT NULL,
  `starts_on` text,
  `ends_on` text,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `skin_profiles` (
  `user_id` text PRIMARY KEY NOT NULL,
  `answers` text NOT NULL,
  `skin_type` text NOT NULL,
  `sensitivity` text NOT NULL,
  `concerns` text DEFAULT '' NOT NULL,
  `hair_type` text DEFAULT '' NOT NULL,
  `hair_concerns` text DEFAULT '' NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `gallery` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `category` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `image` text,              -- compressed JPEG as data URL (uploaded by the owner)
  `stylist_id` text,
  `sort` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`stylist_id`) REFERENCES `stylists`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE TABLE `page_views` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `date` text NOT NULL,
  `path` text NOT NULL,
  `visitor` text NOT NULL,   -- random anonymous id from a first-party cookie (no personal data)
  `created_at` integer NOT NULL
);
CREATE INDEX `page_views_date_idx` ON `page_views` (`date`);

-- ---------- Starter content ----------

-- New skin treatments.
INSERT INTO `services` (`id`, `category`, `name`, `duration_min`, `price_cents`, `home_available`, `description`, `created_at`) VALUES
  ('svc-clarify',   'Skin', 'Deep Cleanse & Clarify Facial', 75, 11000, 1, 'Purifying facial with gentle extractions for congested, breakout-prone skin.', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-hydraglow', 'Skin', 'Hydra-Glow Facial',             60, 10500, 1, 'Intense hydration with hyaluronic layers for dry, dull, tired-looking skin.', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-peel',      'Skin', 'Brightening Peel',              45, 12000, 0, 'Professional fruit-acid peel to fade dark spots and even out skin tone.', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-calm',      'Skin', 'Calm & Repair Facial',          60, 10000, 1, 'Soothing, fragrance-free facial for sensitive and redness-prone skin.', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-agedefy',   'Skin', 'Age-Defy Lift Facial',          75, 13500, 0, 'Peptide-rich facial with lifting massage to soften fine lines.', CAST(strftime('%s','now') AS INTEGER) * 1000);

-- What each service helps with.
UPDATE `services` SET `targets` = 'normal,combination,dullness' WHERE `id` = 'svc-facial';
UPDATE `services` SET `targets` = 'oily,combination,acne,pores' WHERE `id` = 'svc-clarify';
UPDATE `services` SET `targets` = 'dry,normal,dehydration,dullness' WHERE `id` = 'svc-hydraglow';
UPDATE `services` SET `targets` = 'pigmentation,dullness,oily,normal,combination,strong' WHERE `id` = 'svc-peel';
UPDATE `services` SET `targets` = 'sensitive,redness,dry' WHERE `id` = 'svc-calm';
UPDATE `services` SET `targets` = 'aging,dry,normal,dullness' WHERE `id` = 'svc-agedefy';
UPDATE `services` SET `targets` = 'frizz,damage,curly' WHERE `id` = 'svc-keratin';
UPDATE `services` SET `targets` = 'scalp,thinning,damage' WHERE `id` = 'svc-spa';
UPDATE `services` SET `targets` = 'color,damage' WHERE `id` = 'svc-gloss';
UPDATE `services` SET `targets` = 'color' WHERE `id` IN ('svc-root', 'svc-balayage');
UPDATE `services` SET `targets` = 'event' WHERE `id` IN ('svc-event', 'svc-blowdry');
UPDATE `services` SET `targets` = 'curly,damage' WHERE `id` = 'svc-womens-cut';
UPDATE `services` SET `targets` = 'nails' WHERE `id` IN ('svc-manicure', 'svc-pedicure');

-- How each service is done (one step per line).
UPDATE `services` SET `steps` = 'Consultation about your face shape, routine and the look you want
Relaxing wash and conditioning treatment
Precision cut, refined section by section
Blow-dry and finish, plus tips to style it at home' WHERE `id` = 'svc-womens-cut';
UPDATE `services` SET `steps` = 'Quick chat about length, fade and parting
Clipper and scissor cut tailored to your head shape
Hot-towel finish and neck clean-up
Styling with matte or shine product' WHERE `id` = 'svc-mens-cut';
UPDATE `services` SET `steps` = 'Friendly hello and a cape in their favourite colour
Gentle wash or spray-wet
Quick, careful cut with lots of breaks if needed
Finish and a sticker for good behaviour' WHERE `id` = 'svc-kids-cut';
UPDATE `services` SET `steps` = 'Wash with a shampoo matched to your hair
Heat protection and volume or smoothing product
Round-brush blow-out section by section
Finishing spray for hold and shine' WHERE `id` = 'svc-blowdry';
UPDATE `services` SET `steps` = 'Colour match to your current shade
Colour applied to regrowth only
Processing time with a warm head massage
Rinse, gloss and blow-dry' WHERE `id` = 'svc-root';
UPDATE `services` SET `steps` = 'Consultation with inspiration photos and a strand test
Hand-painted lightener placed where the sun would naturally hit
Toner to get the exact shade you want
Bond-repair treatment, blow-dry and aftercare plan' WHERE `id` = 'svc-balayage';
UPDATE `services` SET `steps` = 'Check tone and porosity of your hair
Apply demi-permanent gloss
Process for 20 minutes
Rinse and finish for mirror-like shine' WHERE `id` = 'svc-gloss';
UPDATE `services` SET `steps` = 'Clarifying wash to open the cuticle
Keratin applied section by section
Blow-dry and flat-iron to seal it in
Aftercare: no washing or tying hair for 72 hours' WHERE `id` = 'svc-keratin';
UPDATE `services` SET `steps` = 'Scalp analysis under a magnifier
Exfoliating scalp scrub
Deep-conditioning mask with steam
Pressure-point scalp and neck massage' WHERE `id` = 'svc-spa';
UPDATE `services` SET `steps` = 'Remove old polish and soak hands
Shape nails and gently push back cuticles
Hand massage with nourishing cream
Base coat, two colour coats and top coat' WHERE `id` = 'svc-manicure';
UPDATE `services` SET `steps` = 'Warm foot soak with mineral salts
Exfoliation and callus smoothing
Nail shaping and cuticle care
Gel polish cured under LED light' WHERE `id` = 'svc-pedicure';
UPDATE `services` SET `steps` = 'Skin check to understand your skin type
Double cleanse and gentle exfoliation
Mask chosen for your skin, with facial massage
Serum, moisturiser and SPF' WHERE `id` = 'svc-facial';
UPDATE `services` SET `steps` = 'Skin check under a magnifying lamp
Steam and gentle extractions
Clay mask to absorb oil and tighten pores
Calming serum and oil-free moisturiser' WHERE `id` = 'svc-clarify';
UPDATE `services` SET `steps` = 'Gentle cleanse and enzyme exfoliation
Layered hyaluronic serums
Hydrating sheet mask with facial massage
Barrier cream and SPF' WHERE `id` = 'svc-hydraglow';
UPDATE `services` SET `steps` = 'Skin prep and protection of sensitive areas
Fruit-acid peel applied for a set time
Neutralise and soothe
Brightening serum and strict SPF aftercare plan' WHERE `id` = 'svc-peel';
UPDATE `services` SET `steps` = 'Fragrance-free cleanse
Cool compress to calm redness
Centella and oat soothing mask
Barrier-repair moisturiser' WHERE `id` = 'svc-calm';
UPDATE `services` SET `steps` = 'Cleanse and gentle exfoliation
Peptide and vitamin C serums
Sculpting lifting massage
Firming mask, eye cream and SPF' WHERE `id` = 'svc-agedefy';
UPDATE `services` SET `steps` = 'Trial look agreed in advance
Skin prep and long-wear makeup
Hair styled to match your outfit
Touch-up kit for the day' WHERE `id` = 'svc-event';

-- Starter products (house brand).
INSERT INTO `products` (`id`, `name`, `brand`, `category`, `description`, `how_to_use`, `price_cents`, `targets`, `created_at`) VALUES
  ('prd-gel-cleanser',  'Clarifying Gel Cleanser',     'Maple & Mane Botanics', 'Cleanser',    'Salicylic acid and green tea gel that clears pores without stripping.', 'Morning and night: massage onto damp skin for 30 seconds, rinse.', 2800, 'oily,combination,acne,pores', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-cream-cleanser','Milky Cream Cleanser',        'Maple & Mane Botanics', 'Cleanser',    'Soft, fragrance-free cream cleanser that keeps skin comfortable.', 'Morning and night: smooth on, remove with a warm cloth.', 2600, 'dry,sensitive,normal,redness', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-niacinamide',   'Niacinamide 10% Serum',       'Maple & Mane Botanics', 'Serum',       'Balances oil, refines pores and calms blemishes.', '2–3 drops after cleansing, morning and/or night.', 3400, 'oily,combination,acne,pores,redness', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-vitc',          'Vitamin C Glow Serum',        'Maple & Mane Botanics', 'Serum',       'Stable vitamin C to brighten dull skin and fade dark spots.', 'Mornings, before moisturiser and SPF.', 4600, 'pigmentation,dullness,aging,normal,combination', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-hyaluronic',    'Hyaluronic Hydration Serum',  'Maple & Mane Botanics', 'Serum',       'Multi-weight hyaluronic acid for plump, bouncy skin.', 'Apply to damp skin morning and night.', 3600, 'dry,dehydration,dullness,normal,sensitive', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-retinol',       'Gentle Retinal Night Cream',  'Maple & Mane Botanics', 'Moisturiser', 'Encapsulated retinal to smooth fine lines with less irritation.', 'Night only, 2–3 times a week to start. Always use SPF in the day.', 5200, 'aging,pigmentation,acne,normal,combination,strong', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-centella',      'Centella Calming Cream',      'Maple & Mane Botanics', 'Moisturiser', 'Barrier-repair cream with centella and ceramides.', 'Morning and night as your last step (before SPF in the morning).', 3800, 'sensitive,redness,dry,dehydration', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-gel-moist',     'Oil-Free Water Gel',          'Maple & Mane Botanics', 'Moisturiser', 'Weightless hydration that will not clog pores.', 'Morning and night after serum.', 3200, 'oily,combination,acne,pores', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-spf',           'Daily Mineral SPF 50',        'Maple & Mane Botanics', 'Sun care',    'Sheer zinc sunscreen for every skin type — the #1 anti-ageing step.', 'Every morning, two finger-lengths for face and neck. Reapply outdoors.', 3400, 'oily,dry,combination,normal,sensitive,pigmentation,aging,redness', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-argan',         'Argan Shine Hair Oil',        'Maple & Mane Botanics', 'Hair care',   'Lightweight oil that tames frizz and adds gloss.', '1–2 drops on mid-lengths and ends, damp or dry.', 3000, 'frizz,damage,curly,color', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-bond',          'Bond Repair Mask',            'Maple & Mane Botanics', 'Hair care',   'Rebuilds weak, coloured or heat-damaged hair.', 'Once a week: leave on for 10 minutes after shampoo.', 4200, 'damage,color,frizz', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-scalp',         'Rosemary Scalp Shampoo',      'Maple & Mane Botanics', 'Hair care',   'Clarifying shampoo for oily or flaky scalps and thinning hair.', 'Massage into scalp for 2 minutes, rinse.', 2900, 'scalp,thinning', CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('prd-curl',          'Curl Defining Cream',         'Maple & Mane Botanics', 'Hair care',   'Defines curls and coils with soft, frizz-free hold.', 'Rake through soaking-wet hair, scrunch and diffuse or air-dry.', 3100, 'curly,frizz', CAST(strftime('%s','now') AS INTEGER) * 1000);

-- Starter offers.
INSERT INTO `offers` (`id`, `title`, `description`, `discount_type`, `value`, `service_ids`, `categories`, `first_visit_only`, `starts_on`, `ends_on`, `created_at`) VALUES
  ('off-welcome', 'Welcome — 15% off your first visit', 'New to Maple & Mane? Enjoy 15% off any services on your first booking.', 'PERCENT', 15, '', '', 1, NULL, NULL, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('off-glow',    'Glow Season — 20% off facials',      '20% off every facial and peel. Perfect after your online skin check.', 'PERCENT', 20, '', 'Skin', 0, NULL, NULL, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('off-colour',  'Colour Refresh — $20 off colour',    'Save $20 on root touch-ups, balayage and gloss.', 'AMOUNT', 2000, '', 'Colour', 0, NULL, NULL, CAST(strftime('%s','now') AS INTEGER) * 1000);

-- Placeholder gallery entries (the owner can upload real photos from Owner → Gallery).
INSERT INTO `gallery` (`id`, `title`, `category`, `description`, `sort`, `created_at`) VALUES
  ('gal-1', 'Sun-kissed balayage',  'Colour',          'Hand-painted, low-maintenance blonde that grows out softly.', 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('gal-2', 'Hydra-Glow results',   'Skin',            'Plump, dewy skin straight after a Hydra-Glow Facial.',        2, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('gal-3', 'Classic skin fade',    'Hair',            'Sharp fade with a textured top and hot-towel finish.',        3, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('gal-4', 'Bridal updo',          'Bridal & Events', 'Soft romantic updo with long-wear bridal makeup.',             4, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('gal-5', 'Gel pedicure',         'Nails',           'Glossy gel colour that lasts up to three weeks.',              5, CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('gal-6', 'Keratin smoothing',    'Treatments',      'Frizz-free, glossy hair for up to three months.',              6, CAST(strftime('%s','now') AS INTEGER) * 1000);
