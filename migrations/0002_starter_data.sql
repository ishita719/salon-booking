-- Starter menu and team (no logins, no personal data). The owner can edit or hide all of these later.

INSERT INTO `services` (`id`, `category`, `name`, `duration_min`, `price_cents`, `home_available`, `description`, `created_at`) VALUES
  ('svc-womens-cut',   'Hair',            'Women''s Cut & Style',  60, 8500,  1, 'Consultation, wash, precision cut and blow-dry.',        CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-mens-cut',     'Hair',            'Men''s Cut',            30, 4500,  1, 'Classic or modern cut with a hot-towel finish.',         CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-kids-cut',     'Hair',            'Kids'' Cut (under 12)', 30, 3000,  1, 'Gentle, quick cuts for little ones.',                    CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-blowdry',      'Hair',            'Blow-dry & Style',      45, 5500,  1, 'Wash and a smooth or voluminous blow-out.',              CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-root',         'Colour',          'Root Touch-up',         90, 11000, 0, 'Single-process colour on regrowth.',                     CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-balayage',     'Colour',          'Full Balayage',        180, 26000, 0, 'Hand-painted, sun-kissed highlights incl. toner.',       CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-gloss',        'Colour',          'Gloss / Toner',         45, 6500,  0, 'Refresh tone and add shine.',                            CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-keratin',      'Treatments',      'Keratin Smoothing',    150, 29000, 0, 'Frizz-free, smoother hair for up to 3 months.',          CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-spa',          'Treatments',      'Scalp & Hair Spa',      45, 7000,  1, 'Deep-conditioning mask with scalp massage.',             CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-manicure',     'Nails',           'Classic Manicure',      45, 4000,  1, 'Shape, cuticle care and polish.',                        CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-pedicure',     'Nails',           'Gel Pedicure',          60, 6500,  1, 'Long-lasting gel polish with foot soak.',                CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-facial',       'Skin',            'Signature Facial',      60, 9500,  1, 'Cleanse, exfoliate, mask and hydrate.',                  CAST(strftime('%s','now') AS INTEGER) * 1000),
  ('svc-event',        'Bridal & Events', 'Event Hair & Makeup',  120, 22000, 1, 'Camera-ready look for weddings and events.',             CAST(strftime('%s','now') AS INTEGER) * 1000);

INSERT INTO `stylists` (`id`, `name`, `title`, `bio`, `work_days`) VALUES
  ('sty-aiko',  'Aiko Tanaka',  'Senior Colourist',      'Balayage and lived-in colour specialist, 12 years experience.', '2,3,4,5,6'),
  ('sty-marco', 'Marco Silva',  'Master Barber',         'Fades, beard sculpting and classic men''s grooming.',            '0,3,4,5,6'),
  ('sty-priya', 'Priya Sharma', 'Stylist & Esthetician', 'Bridal styling, facials and nail art.',                          '0,2,3,4,6');
