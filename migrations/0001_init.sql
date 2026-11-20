-- Initial database structure. Applied with:  npm run db:migrate:local  /  npm run db:migrate:remote
-- Must match src/db/schema.ts.

CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `password_hash` text NOT NULL,
  `role` text DEFAULT 'CUSTOMER' NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);

CREATE TABLE `services` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `duration_min` integer NOT NULL,
  `price_cents` integer NOT NULL,
  `home_available` integer DEFAULT 1 NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `stylists` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `title` text NOT NULL,
  `bio` text DEFAULT '' NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `work_days` text DEFAULT '0,2,3,4,5,6' NOT NULL,
  `user_id` text,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `stylists_user_id_unique` ON `stylists` (`user_id`);

CREATE TABLE `time_off` (
  `id` text PRIMARY KEY NOT NULL,
  `stylist_id` text NOT NULL,
  `date` text NOT NULL,
  `start_min` integer NOT NULL,
  `end_min` integer NOT NULL,
  `reason` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`stylist_id`) REFERENCES `stylists`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `time_off_date_idx` ON `time_off` (`date`);

CREATE TABLE `appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text,
  `guest_name` text,
  `guest_phone` text,
  `guest_email` text,
  `source` text DEFAULT 'ONLINE' NOT NULL,
  `stylist_id` text,
  `date` text NOT NULL,
  `start_min` integer NOT NULL,
  `end_min` integer NOT NULL,
  `status` text DEFAULT 'BOOKED' NOT NULL,
  `location_type` text DEFAULT 'SALON' NOT NULL,
  `address` text,
  `postal_code` text,
  `notes` text,
  `subtotal_cents` integer DEFAULT 0 NOT NULL,
  `travel_fee_cents` integer DEFAULT 0 NOT NULL,
  `has_custom` integer DEFAULT 0 NOT NULL,
  `reschedule_count` integer DEFAULT 0 NOT NULL,
  `cancelled_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`stylist_id`) REFERENCES `stylists`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `appointments_date_status_idx` ON `appointments` (`date`, `status`);
CREATE INDEX `appointments_user_idx` ON `appointments` (`user_id`);
CREATE INDEX `appointments_stylist_date_idx` ON `appointments` (`stylist_id`, `date`);

CREATE TABLE `appointment_items` (
  `id` text PRIMARY KEY NOT NULL,
  `appointment_id` text NOT NULL,
  `service_id` text,
  `name` text NOT NULL,
  `duration_min` integer NOT NULL,
  `price_cents` integer,
  `is_custom` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `appointment_items_appt_idx` ON `appointment_items` (`appointment_id`);

CREATE TABLE `feedback` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `appointment_id` text,
  `stylist_id` text,
  `rating` integer NOT NULL,
  `comment` text DEFAULT '' NOT NULL,
  `is_public` integer DEFAULT 0 NOT NULL,
  `owner_reply` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`stylist_id`) REFERENCES `stylists`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `feedback_appointment_uq` ON `feedback` (`appointment_id`);
CREATE INDEX `feedback_stylist_idx` ON `feedback` (`stylist_id`);

CREATE TABLE `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` integer NOT NULL
);
