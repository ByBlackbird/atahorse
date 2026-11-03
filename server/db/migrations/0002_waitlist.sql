CREATE TABLE IF NOT EXISTS "waitlist" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "email" text NOT NULL UNIQUE,
  "role" text NOT NULL DEFAULT 'learner',
  "locale" text NOT NULL DEFAULT 'tr',
  "source" text NOT NULL DEFAULT 'landing',
  "created_at" integer NOT NULL
);
