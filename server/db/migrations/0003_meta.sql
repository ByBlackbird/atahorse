-- Metalearning bağlamı (kurs başına) ve haftalık öğrenme planı (kullanıcı başına)
ALTER TABLE courses ADD COLUMN meta TEXT;
ALTER TABLE users ADD COLUMN plan_prefs TEXT;
