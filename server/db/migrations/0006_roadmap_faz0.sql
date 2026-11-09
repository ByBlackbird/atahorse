-- Atahorse migration 0006: Bilimsel Yol Haritası Faz 0 — ölçüm olayları, serbest yanıtlı hatırlama, 18+ beyanı.
ALTER TABLE "users" ADD COLUMN "adult_confirmed_at" integer;
CREATE TABLE IF NOT EXISTS "events" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "kind" text NOT NULL,
  "course_id" integer,
  "dedupe" text,
  "meta" text,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "events_kind_idx" ON "events" ("kind", "created_at");
CREATE INDEX IF NOT EXISTS "events_user_idx" ON "events" ("user_id", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "events_dedupe_uq" ON "events" ("user_id", "dedupe");
CREATE TABLE IF NOT EXISTS "recall_answers" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "item_id" text NOT NULL,
  "context" text NOT NULL,
  "text" text NOT NULL,
  "self_grade" integer,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "recall_answers_user_idx" ON "recall_answers" ("user_id", "course_id");
