-- Passwordless client sign-in (QR + phone), email verification codes, one-time login QR codes, owner code.

-- Owner personal code (hashed). NULL = still using the temporary code from the app settings.
ALTER TABLE `users` ADD `pin_hash` text;
-- Phone number as digits only (e.g. 6045550123) so the same number is recognised however it's typed.
ALTER TABLE `users` ADD `phone_digits` text DEFAULT '' NOT NULL;
UPDATE `users` SET `phone_digits` =
  CASE
    WHEN length(replace(replace(replace(replace(replace(replace(`phone`, ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '+', '')) = 11
     AND substr(replace(replace(replace(replace(replace(replace(`phone`, ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '+', ''), 1, 1) = '1'
    THEN substr(replace(replace(replace(replace(replace(replace(`phone`, ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '+', ''), 2)
    ELSE replace(replace(replace(replace(replace(replace(`phone`, ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '+', '')
  END;
CREATE INDEX `users_phone_digits_idx` ON `users` (`phone_digits`);

-- 6-digit codes sent by email (owner sign-up, owner "forgot code", client login). Stored hashed.
CREATE TABLE `verification_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `purpose` text NOT NULL,          -- OWNER_SIGNUP | OWNER_RESET | CLIENT_LOGIN
  `code_hash` text NOT NULL,
  `expires_at` integer NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `used` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX `verification_codes_email_idx` ON `verification_codes` (`email`, `purpose`);

-- One-time "scan to log in" QR codes for clients (10 minutes, single use). Token stored hashed.
CREATE TABLE `login_tokens` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `expires_at` integer NOT NULL,
  `used_at` integer,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
