# Atahorse — Proje Bağlam Dosyası (CONTEXT.md)

> Bu dosya, projeye yeni katılan herhangi bir geliştirici (veya AI aracı) için
> tek durak kaynaktır. Son güncelleme: Ekim 2026 (IEARN → Atahorse rebrand + deployment hazırlığı)

---

## 1. Proje Nedir

**Atahorse** (eski adı IEARN), kişiselleştirilmiş yapay zekâ destekli eğitim platformu.
Core vizyon: "Atahorse bir arama motoru değil, kişisel araştırmacıdır — bir konuyu
kullanıcının beynine/kendi öğrenme stiline göre araştırır, yapılandırır ve öğretir."

Marka hikâyesi: "At" = güç, hız ve öncülük. Atahorse = öğrenmenin gücü.

## 2. Teknoloji Yığını

- **Backend:** Flask 3, tek dosya `app.py` (blueprint yok — bilinçli tercih)
- **Veritabanı:** SQLite (`atahorse.db`, şema `init_db()` içinde)
- **Kimlik:** Flask-Login + Werkzeug password hashing
- **i18n:** Flask-Babel 4.x — `Babel(app, locale_selector=get_locale)`
  - Şablonlarda: `{{ _("...") }}` — **ASLA tek tırnak kullanma** (`{{ _('...') }}`)
    Türkçe kesme işaretleri (Atahorse'a) TemplateSyntaxError üretir. Çift tırnak ZORUNLU.
  - Python'da özel terimler: `tr('anahtar')` + `TRANSLATIONS` sözlüğü (tr/en/ru)
- **PDF:** ReportLab (yatay A4 sertifikalar, tr/en/ru metinler)
- **AI:** Ollama llama3 @ localhost:11434 (opsiyonel — yoksa `generate_fallback_course()` devreye girer)
- **Kaynak arama:** duckduckgo-search (hata olursa sessizce boş liste döner)
- **Tasarım:** `--primary:#4F46E5` (indigo), `--secondary:#8B5CF6` (mor), `--amber:#F59E0B`, Inter font

## 3. Kritik Kurallar

1. **Jinja2 çift tırnak:** `{{ _("...") }}` — tek tırnak yasak (projenin en sık hata kaynağı)
2. **.mo derleme:** .po → .mo derlerken boş msgid header'ında
   `Content-Type: text/plain; charset=UTF-8` + GERÇEK newline olmalı
   (literal `\n` stringi `LookupError: unknown encoding` verir)
3. **DB şeması JSON alanları:** `courses.modules`, `courses.sources` JSON string olarak saklanır
4. **Onboarding akışı:** ilk giriş (`onboarded=0`) → `/onboarding` → `learning_test?onboarding=1`
   → otomatik `/generate_course`. Test bitince `onboarded=1`
5. **Freemium:** `FREE_COURSE_LIMIT = 3`; `generate_course` GET+POST'ta kontrol, `users.courses_used` artar
6. **Admin:** `/admin` (is_admin=1 gerekli), varsayılan admin `admin` / `admin123`
7. **Render'da Ollama yok:** fallback generator çalışır — bu normal, hata değil

## 4. Dosya Yapısı

```
app.py                    # tüm backend (~700 satır)
templates/                # Jinja2 şablonları
  base.html               # navbar + logo + dil seçici + admin linki
  index.html              # interaktif demo kutusu + hero
  onboarding.html         # beyin analizi tanıtımı (3 adım)
  learning_test.html      # öğrenme stili testi
  dashboard.html          # ücretsiz/premium kota bannerları
  course_generator.html   # kurs üretim formu
  course_view.html        # okuma/sunum modu, mdToSlides() JS
  pricing.html / upgrade.html
  login.html / register.html
  admin/dashboard.html    # 7 istatistik kartı + grafik
static/
  css/style.css           # tüm tasarım sistemi
  img/logo.png            # at temalı logo (devre çizgili at başı, dairesel)
  img/favicon.png
translations/{tr,en,ru}/LC_MESSAGES/messages.{po,mo}   # 83 kayıt/dil
requirements.txt          # + gunicorn (deployment için)
render.yaml               # Render.com konfigürasyonu
Procfile                  # gunicorn başlatma komutu
```

## 5. Dağıtım (Deployment)

- **Hedef:** Render.com ücretsiz plan → `https://atahorse.com` (DNS: registrar'da
  A kaydı → Render IP'si, CNAME www → onrender.com)
- **Başlatma:** `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 120`
- **Python:** 3.11.9 (render.yaml'da sabit)
- **SQLite notu:** Render ücretsiz planda disk kalıcı değil — yeniden deploy'da veritabanı
  sıfırlanır. Üretimde PostgreSQL'e geçilecek (yol haritası).

## 6. Yol Haritası

1. ✅ MVP v3 (admin panel, freemium, ödeme simülasyonu, onboarding, kaynakça, slayt modu)
2. ✅ Rebrand: IEARN → Atahorse, yeni logo, deployment hazırlığı
3. ⬜ Canlı yayın: Render + atahorse.com DNS
4. ⬜ Gerçek ödeme: iyzico/Stripe (iyzico başvurusu yapıldıysa entegrasyon)
5. ⬜ Yatırım başvuruları: Startup Qatar (F6S) + EIC Accelerator paketleri hazır
6. ⬜ Arapça arayüz (MENA/Katar genişlemesi için kritik)
7. ⬜ E-posta bildirimleri (SMTP)
8. ⬜ Kurs içi quiz sistemi
9. ⬜ Uzman pazarı (çift imzalı sertifikalar)
