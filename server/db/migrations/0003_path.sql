-- Atahorse migration 0003: kişisel yol (hedef/plan), ön test, içerik bildirimi, atıf kodları
ALTER TABLE "users" ADD COLUMN "ref_code" text;
ALTER TABLE "courses" ADD COLUMN "goal_why" text;
ALTER TABLE "courses" ADD COLUMN "target_date" text;
ALTER TABLE "courses" ADD COLUMN "minutes_per_day" integer NOT NULL DEFAULT 30;
CREATE INDEX IF NOT EXISTS "users_ref_idx" ON "users" ("ref_code");

CREATE TABLE IF NOT EXISTS "content_reports" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "item_id" text NOT NULL,
  "kind" text NOT NULL,
  "note" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'open',
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_reports_uq" ON "content_reports" ("user_id", "course_id", "item_id");

CREATE INDEX IF NOT EXISTS "content_reports_status_idx" ON "content_reports" ("status");

CREATE TABLE IF NOT EXISTS "pretests" (
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "item_ids" text NOT NULL,
  "answers" text NOT NULL,
  "score" integer NOT NULL,
  "total" integer NOT NULL,
  "skipped" integer NOT NULL DEFAULT 0,
  "created_at" integer NOT NULL,
  PRIMARY KEY ("user_id", "course_id"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ref_codes" (
  "code" text PRIMARY KEY,
  "label" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'creator',
  "market" text NOT NULL DEFAULT '',
  "created_at" integer NOT NULL
);
