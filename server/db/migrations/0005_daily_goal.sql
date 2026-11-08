-- Atahorse migration 0005: günlük hedef (XP). Varsayılan 30 XP ≈ 1 modül bölümü + birkaç tekrar.
ALTER TABLE "users" ADD COLUMN "daily_goal" integer NOT NULL DEFAULT 30;
