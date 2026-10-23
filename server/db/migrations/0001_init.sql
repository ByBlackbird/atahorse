-- Atahorse migration 0001: init (drizzle şemasından üretildi)
CREATE TABLE IF NOT EXISTS "activity_days" (
  "user_id" integer NOT NULL,
  "day" text NOT NULL,
  "xp" integer NOT NULL DEFAULT 0,
  "seconds" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "day"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ai_cache" (
  "key" text PRIMARY KEY,
  "task" text NOT NULL,
  "model" text NOT NULL,
  "norm_input" text NOT NULL,
  "embedding" text,
  "output" text NOT NULL,
  "hits" integer NOT NULL DEFAULT 0,
  "created_at" integer NOT NULL,
  "expires_at" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_cache_task_idx" ON "ai_cache" ("task", "created_at");

CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer,
  "task" text NOT NULL,
  "tier" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "in_tokens" integer NOT NULL DEFAULT 0,
  "out_tokens" integer NOT NULL DEFAULT 0,
  "cached" integer NOT NULL DEFAULT 0,
  "ms" integer NOT NULL DEFAULT 0,
  "ok" integer NOT NULL DEFAULT 1,
  "created_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificates" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "code" text NOT NULL UNIQUE,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "score_pct" integer NOT NULL,
  "issued_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificates_course_uq" ON "certificates" ("user_id", "course_id");

CREATE TABLE IF NOT EXISTS "check_answers" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "item_id" text NOT NULL,
  "correct" integer NOT NULL,
  "confidence" integer NOT NULL DEFAULT 2,
  "method" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "check_answers_user_idx" ON "check_answers" ("user_id", "course_id");

CREATE TABLE IF NOT EXISTS "cognitive_profiles" (
  "user_id" integer PRIMARY KEY,
  "modality" text NOT NULL,
  "reasoning" text NOT NULL,
  "profile_key" text NOT NULL,
  "scores" text NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "course_translations" (
  "course_id" integer NOT NULL,
  "locale" text NOT NULL,
  "doc" text NOT NULL,
  "created_at" integer NOT NULL,
  PRIMARY KEY ("course_id", "locale"),
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "courses" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "title" text NOT NULL,
  "topic" text NOT NULL,
  "level" text NOT NULL,
  "locale" text NOT NULL,
  "profile_key" text NOT NULL,
  "method" text NOT NULL,
  "source" text NOT NULL DEFAULT 'free',
  "meb_grade" text,
  "meb_subject" text,
  "meb_unit" text,
  "status" text NOT NULL DEFAULT 'queued',
  "generator" text,
  "doc" text,
  "module_count" integer NOT NULL DEFAULT 0,
  "share_slug" text UNIQUE,
  "completed_at" integer,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "courses_user_idx" ON "courses" ("user_id");

CREATE TABLE IF NOT EXISTS "jobs" (
  "id" text PRIMARY KEY,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "kind" text NOT NULL DEFAULT 'generate',
  "locale" text,
  "stage" text NOT NULL DEFAULT 'queued',
  "percent" integer NOT NULL DEFAULT 0,
  "error" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "jobs_user_idx" ON "jobs" ("user_id");

CREATE TABLE IF NOT EXISTS "method_stats" (
  "user_id" integer NOT NULL,
  "method" text NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "correct" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "method"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "mindmaps" (
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "nodes" text NOT NULL,
  "updated_at" integer NOT NULL,
  PRIMARY KEY ("user_id", "course_id"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "mode_usage" (
  "user_id" integer NOT NULL,
  "mode" text NOT NULL,
  "seconds" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "mode"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "module_progress" (
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "module_idx" integer NOT NULL,
  "task_done_at" integer,
  "quiz_passed_at" integer,
  "quiz_best" integer NOT NULL DEFAULT 0,
  "completed_at" integer,
  "seconds" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "course_id", "module_idx"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "quiz_attempts" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "module_idx" integer NOT NULL,
  "answers" text NOT NULL,
  "score" integer NOT NULL,
  "total" integer NOT NULL,
  "passed" integer NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "quiz_attempts_user_idx" ON "quiz_attempts" ("user_id", "course_id");

CREATE TABLE IF NOT EXISTS "review_cards" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "item_id" text NOT NULL,
  "stability" real NOT NULL DEFAULT 0,
  "difficulty" real NOT NULL DEFAULT 0,
  "reps" integer NOT NULL DEFAULT 0,
  "lapses" integer NOT NULL DEFAULT 0,
  "last_review" integer,
  "due" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "review_cards_item_uq" ON "review_cards" ("user_id", "course_id", "item_id");

CREATE INDEX IF NOT EXISTS "review_cards_due_idx" ON "review_cards" ("user_id", "due");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY,
  "user_id" integer NOT NULL,
  "expires_at" integer NOT NULL,
  "user_agent" text NOT NULL DEFAULT '',
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");

CREATE TABLE IF NOT EXISTS "submissions" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "course_id" integer NOT NULL,
  "module_idx" integer NOT NULL,
  "kind" text NOT NULL,
  "filename" text NOT NULL,
  "stored" text NOT NULL,
  "mime" text NOT NULL,
  "size" integer NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_badges" (
  "user_id" integer NOT NULL,
  "badge_key" text NOT NULL,
  "awarded_at" integer NOT NULL,
  PRIMARY KEY ("user_id", "badge_key"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "username" text NOT NULL UNIQUE,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "full_name" text NOT NULL DEFAULT '',
  "role" text NOT NULL DEFAULT 'user',
  "plan" text NOT NULL DEFAULT 'free',
  "locale" text NOT NULL DEFAULT 'tr',
  "theme" text NOT NULL DEFAULT 'paper',
  "onboarded_at" integer,
  "xp" integer NOT NULL DEFAULT 0,
  "streak" integer NOT NULL DEFAULT 0,
  "longest_streak" integer NOT NULL DEFAULT 0,
  "last_active_day" text,
  "created_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "xp_events" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "user_id" integer NOT NULL,
  "kind" text NOT NULL,
  "amount" integer NOT NULL,
  "ref_key" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "xp_events_ref_uq" ON "xp_events" ("user_id", "ref_key");
