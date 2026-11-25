-- Starter menu, team, products, offers and gallery (no logins, no personal data).
-- Generated from the original starter data. Safe to run more than once (existing rows are kept).

INSERT INTO services (id, name, category, description, duration_min, price_cents, home_available, active, created_at, targets, steps) VALUES
  ('svc-womens-cut', 'Women''s Cut & Style', 'Hair', 'Consultation, wash, precision cut and blow-dry.', 60, 8500, true, true, now(), 'curly,damage', 'Consultation about your face shape, routine and the look you want
Relaxing wash and conditioning treatment
Precision cut, refined section by section
Blow-dry and finish, plus tips to style it at home'),
  ('svc-mens-cut', 'Men''s Cut', 'Hair', 'Classic or modern cut with a hot-towel finish.', 30, 4500, true, true, now(), '', 'Quick chat about length, fade and parting
Clipper and scissor cut tailored to your head shape
Hot-towel finish and neck clean-up
Styling with matte or shine product'),
  ('svc-kids-cut', 'Kids'' Cut (under 12)', 'Hair', 'Gentle, quick cuts for little ones.', 30, 3000, true, true, now(), '', 'Friendly hello and a cape in their favourite colour
Gentle wash or spray-wet
Quick, careful cut with lots of breaks if needed
Finish and a sticker for good behaviour'),
  ('svc-blowdry', 'Blow-dry & Style', 'Hair', 'Wash and a smooth or voluminous blow-out.', 45, 5500, true, true, now(), 'event', 'Wash with a shampoo matched to your hair
Heat protection and volume or smoothing product
Round-brush blow-out section by section
Finishing spray for hold and shine'),
  ('svc-root', 'Root Touch-up', 'Colour', 'Single-process colour on regrowth.', 90, 11000, false, true, now(), 'color', 'Colour match to your current shade
Colour applied to regrowth only
Processing time with a warm head massage
Rinse, gloss and blow-dry'),
  ('svc-balayage', 'Full Balayage', 'Colour', 'Hand-painted, sun-kissed highlights incl. toner.', 180, 26000, false, true, now(), 'color', 'Consultation with inspiration photos and a strand test
Hand-painted lightener placed where the sun would naturally hit
Toner to get the exact shade you want
Bond-repair treatment, blow-dry and aftercare plan'),
  ('svc-gloss', 'Gloss / Toner', 'Colour', 'Refresh tone and add shine.', 45, 6500, false, true, now(), 'color,damage', 'Check tone and porosity of your hair
Apply demi-permanent gloss
Process for 20 minutes
Rinse and finish for mirror-like shine'),
  ('svc-keratin', 'Keratin Smoothing', 'Treatments', 'Frizz-free, smoother hair for up to 3 months.', 150, 29000, false, true, now(), 'frizz,damage,curly', 'Clarifying wash to open the cuticle
Keratin applied section by section
Blow-dry and flat-iron to seal it in
Aftercare: no washing or tying hair for 72 hours'),
  ('svc-spa', 'Scalp & Hair Spa', 'Treatments', 'Deep-conditioning mask with scalp massage.', 45, 7000, true, true, now(), 'scalp,thinning,damage', 'Scalp analysis under a magnifier
Exfoliating scalp scrub
Deep-conditioning mask with steam
Pressure-point scalp and neck massage'),
  ('svc-manicure', 'Classic Manicure', 'Nails', 'Shape, cuticle care and polish.', 45, 4000, true, true, now(), 'nails', 'Remove old polish and soak hands
Shape nails and gently push back cuticles
Hand massage with nourishing cream
Base coat, two colour coats and top coat'),
  ('svc-pedicure', 'Gel Pedicure', 'Nails', 'Long-lasting gel polish with foot soak.', 60, 6500, true, true, now(), 'nails', 'Warm foot soak with mineral salts
Exfoliation and callus smoothing
Nail shaping and cuticle care
Gel polish cured under LED light'),
  ('svc-facial', 'Signature Facial', 'Skin', 'Cleanse, exfoliate, mask and hydrate.', 60, 9500, true, true, now(), 'normal,combination,dullness', 'Skin check to understand your skin type
Double cleanse and gentle exfoliation
Mask chosen for your skin, with facial massage
Serum, moisturiser and SPF'),
  ('svc-event', 'Event Hair & Makeup', 'Bridal & Events', 'Camera-ready look for weddings and events.', 120, 22000, true, true, now(), 'event', 'Trial look agreed in advance
Skin prep and long-wear makeup
Hair styled to match your outfit
Touch-up kit for the day'),
  ('svc-clarify', 'Deep Cleanse & Clarify Facial', 'Skin', 'Purifying facial with gentle extractions for congested, breakout-prone skin.', 75, 11000, true, true, now(), 'oily,combination,acne,pores', 'Skin check under a magnifying lamp
Steam and gentle extractions
Clay mask to absorb oil and tighten pores
Calming serum and oil-free moisturiser'),
  ('svc-hydraglow', 'Hydra-Glow Facial', 'Skin', 'Intense hydration with hyaluronic layers for dry, dull, tired-looking skin.', 60, 10500, true, true, now(), 'dry,normal,dehydration,dullness', 'Gentle cleanse and enzyme exfoliation
Layered hyaluronic serums
Hydrating sheet mask with facial massage
Barrier cream and SPF'),
  ('svc-peel', 'Brightening Peel', 'Skin', 'Professional fruit-acid peel to fade dark spots and even out skin tone.', 45, 12000, false, true, now(), 'pigmentation,dullness,oily,normal,combination,strong', 'Skin prep and protection of sensitive areas
Fruit-acid peel applied for a set time
Neutralise and soothe
Brightening serum and strict SPF aftercare plan'),
  ('svc-calm', 'Calm & Repair Facial', 'Skin', 'Soothing, fragrance-free facial for sensitive and redness-prone skin.', 60, 10000, true, true, now(), 'sensitive,redness,dry', 'Fragrance-free cleanse
Cool compress to calm redness
Centella and oat soothing mask
Barrier-repair moisturiser'),
  ('svc-agedefy', 'Age-Defy Lift Facial', 'Skin', 'Peptide-rich facial with lifting massage to soften fine lines.', 75, 13500, false, true, now(), 'aging,dry,normal,dullness', 'Cleanse and gentle exfoliation
Peptide and vitamin C serums
Sculpting lifting massage
Firming mask, eye cream and SPF')
ON CONFLICT (id) DO NOTHING;

INSERT INTO stylists (id, name, title, bio, active, work_days, user_id) VALUES
  ('sty-aiko', 'Aiko Tanaka', 'Senior Colourist', 'Balayage and lived-in colour specialist, 12 years experience.', true, '2,3,4,5,6', NULL),
  ('sty-marco', 'Marco Silva', 'Master Barber', 'Fades, beard sculpting and classic men''s grooming.', true, '0,3,4,5,6', NULL),
  ('sty-priya', 'Priya Sharma', 'Stylist & Esthetician', 'Bridal styling, facials and nail art.', true, '0,2,3,4,6', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, brand, category, description, how_to_use, price_cents, targets, active, created_at) VALUES
  ('prd-gel-cleanser', 'Clarifying Gel Cleanser', 'Maple & Mane Botanics', 'Cleanser', 'Salicylic acid and green tea gel that clears pores without stripping.', 'Morning and night: massage onto damp skin for 30 seconds, rinse.', 2800, 'oily,combination,acne,pores', true, now()),
  ('prd-cream-cleanser', 'Milky Cream Cleanser', 'Maple & Mane Botanics', 'Cleanser', 'Soft, fragrance-free cream cleanser that keeps skin comfortable.', 'Morning and night: smooth on, remove with a warm cloth.', 2600, 'dry,sensitive,normal,redness', true, now()),
  ('prd-niacinamide', 'Niacinamide 10% Serum', 'Maple & Mane Botanics', 'Serum', 'Balances oil, refines pores and calms blemishes.', '2–3 drops after cleansing, morning and/or night.', 3400, 'oily,combination,acne,pores,redness', true, now()),
  ('prd-vitc', 'Vitamin C Glow Serum', 'Maple & Mane Botanics', 'Serum', 'Stable vitamin C to brighten dull skin and fade dark spots.', 'Mornings, before moisturiser and SPF.', 4600, 'pigmentation,dullness,aging,normal,combination', true, now()),
  ('prd-hyaluronic', 'Hyaluronic Hydration Serum', 'Maple & Mane Botanics', 'Serum', 'Multi-weight hyaluronic acid for plump, bouncy skin.', 'Apply to damp skin morning and night.', 3600, 'dry,dehydration,dullness,normal,sensitive', true, now()),
  ('prd-retinol', 'Gentle Retinal Night Cream', 'Maple & Mane Botanics', 'Moisturiser', 'Encapsulated retinal to smooth fine lines with less irritation.', 'Night only, 2–3 times a week to start. Always use SPF in the day.', 5200, 'aging,pigmentation,acne,normal,combination,strong', true, now()),
  ('prd-centella', 'Centella Calming Cream', 'Maple & Mane Botanics', 'Moisturiser', 'Barrier-repair cream with centella and ceramides.', 'Morning and night as your last step (before SPF in the morning).', 3800, 'sensitive,redness,dry,dehydration', true, now()),
  ('prd-gel-moist', 'Oil-Free Water Gel', 'Maple & Mane Botanics', 'Moisturiser', 'Weightless hydration that will not clog pores.', 'Morning and night after serum.', 3200, 'oily,combination,acne,pores', true, now()),
  ('prd-spf', 'Daily Mineral SPF 50', 'Maple & Mane Botanics', 'Sun care', 'Sheer zinc sunscreen for every skin type — the #1 anti-ageing step.', 'Every morning, two finger-lengths for face and neck. Reapply outdoors.', 3400, 'oily,dry,combination,normal,sensitive,pigmentation,aging,redness', true, now()),
  ('prd-argan', 'Argan Shine Hair Oil', 'Maple & Mane Botanics', 'Hair care', 'Lightweight oil that tames frizz and adds gloss.', '1–2 drops on mid-lengths and ends, damp or dry.', 3000, 'frizz,damage,curly,color', true, now()),
  ('prd-bond', 'Bond Repair Mask', 'Maple & Mane Botanics', 'Hair care', 'Rebuilds weak, coloured or heat-damaged hair.', 'Once a week: leave on for 10 minutes after shampoo.', 4200, 'damage,color,frizz', true, now()),
  ('prd-scalp', 'Rosemary Scalp Shampoo', 'Maple & Mane Botanics', 'Hair care', 'Clarifying shampoo for oily or flaky scalps and thinning hair.', 'Massage into scalp for 2 minutes, rinse.', 2900, 'scalp,thinning', true, now()),
  ('prd-curl', 'Curl Defining Cream', 'Maple & Mane Botanics', 'Hair care', 'Defines curls and coils with soft, frizz-free hold.', 'Rake through soaking-wet hair, scrunch and diffuse or air-dry.', 3100, 'curly,frizz', true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO offers (id, title, description, discount_type, value, service_ids, categories, first_visit_only, starts_on, ends_on, active, created_at) VALUES
  ('off-welcome', 'Welcome — 15% off your first visit', 'New to Maple & Mane? Enjoy 15% off any services on your first booking.', 'PERCENT', 15, '', '', true, NULL, NULL, true, now()),
  ('off-glow', 'Glow Season — 20% off facials', '20% off every facial and peel. Perfect after your online skin check.', 'PERCENT', 20, '', 'Skin', false, NULL, NULL, true, now()),
  ('off-colour', 'Colour Refresh — $20 off colour', 'Save $20 on root touch-ups, balayage and gloss.', 'AMOUNT', 2000, '', 'Colour', false, NULL, NULL, true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO gallery (id, title, category, description, image, stylist_id, sort, created_at) VALUES
  ('gal-1', 'Sun-kissed balayage', 'Colour', 'Hand-painted, low-maintenance blonde that grows out softly.', NULL, NULL, 1, now()),
  ('gal-2', 'Hydra-Glow results', 'Skin', 'Plump, dewy skin straight after a Hydra-Glow Facial.', NULL, NULL, 2, now()),
  ('gal-3', 'Classic skin fade', 'Hair', 'Sharp fade with a textured top and hot-towel finish.', NULL, NULL, 3, now()),
  ('gal-4', 'Bridal updo', 'Bridal & Events', 'Soft romantic updo with long-wear bridal makeup.', NULL, NULL, 4, now()),
  ('gal-5', 'Gel pedicure', 'Nails', 'Glossy gel colour that lasts up to three weeks.', NULL, NULL, 5, now()),
  ('gal-6', 'Keratin smoothing', 'Treatments', 'Frizz-free, glossy hair for up to three months.', NULL, NULL, 6, now())
ON CONFLICT (id) DO NOTHING;

