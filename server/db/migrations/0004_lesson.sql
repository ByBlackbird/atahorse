-- Atahorse migration 0004: anlatımlı görsel ders önbelleği (kurs × modül × dil)
CREATE TABLE IF NOT EXISTS "visual_lessons" (
  "course_id" integer NOT NULL,
  "module_idx" integer NOT NULL,
  "locale" text NOT NULL,
  "doc" text NOT NULL,
  "source" text NOT NULL,
  "created_at" integer NOT NULL,
  PRIMARY KEY ("course_id", "module_idx", "locale"),
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
);
