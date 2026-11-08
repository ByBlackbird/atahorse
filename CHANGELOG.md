# CHANGELOG

İnsanlar ve ajanlar için değişiklik özeti (git geçmişini kazmadan). En yeni üstte.
Biçim: ne değişti → kimi etkiler → gerekirse ne yapılmalı.

## 3.5.0 — 2026-11-09 · Tasarım v4: dokunsal ve sıcak, kurs yolu

- **Yeni görsel dil:** gölgeli SaaS kartları yerine düz yüzey + 2px kenar; basılabilir düğmeler (alt kenar, basınca iner); başlıklar 800 kalınlıkta. Her kurs kendi rengini alır (6 renk) — patika, kart, ilerleme halkası, menü noktası.
- **Kurs yolu (`/kurs/:id`):** kursun ana sayfası. Her modül bir ünite bandı, her bölüm patikada bir düğüm (zigzag), ünite sonunda test düğümü, en sonda final kupası. Durumlar: tamam (amber ✓), şimdi (nefes alan halka + "Başla"), açık, kilitli. Düğüm doğrudan ilgili bölüme/teste götürür (`/kurs/:id/m/:modül?b=bölüm`, `#quiz`).
- **Sonuç odaklı:** kurs yolunun sağ rayında "Bu kursla yapabileceklerin" — her ünitenin hedefi, ünite bitince işaretlenir.
- **Yormayan oyunlaştırma:** seri kartı (son 7 gün), seçilebilir günlük hedef 10/20/30/50 XP (`users.daily_goal`, migration 0005). Can/ceza yok; kaçırılan gün suçlamaz.
- **Panel:** büyük "Sıradaki" kartı kursun renginde ve doğrudan sıradaki modüle götürür; Bugün listesi; renkli kurs kutuları (ilerleme halkası). Sağ rayda seri, günlük hedef, seviye, tekrar.
- **Stüdyo odak modu:** asistan paneli kapalı başlar; geri ok kurs yoluna döner.
- Menü: büyük ikonlu öğeler, seçili öğe tintli kutu; kurslar renk noktasıyla.

## 3.4.0 — 2026-11-06 · Arayüz yenilemesi (SaaS tasarım dili)

- **Tipografi:** başlıklar Plus Jakarta Sans (sıkı harf aralığı, 700), gövde Inter. Cinzel yalnız marka imzası (sertifika); logo değişmedi.
- **Renk:** yüzeyler saf beyaz değil (#fcfbf8); koyu tema daha yumuşak teal-kömür. Yeni **etkileşim aksanı** (canlı teal `accent`): odak halkası, seçili menü, bağlantı, sıralama, aktif durum.
- **Mikro etkileşimler:** tüm düğme/kart/menü geçişleri 200 ms; `card-i` hover'da 2px kalkar, gölge md→lg; basınca aksan halkası; çift tıkta nabız. Azaltılmış hareket tercihine uyar.
- **Kenar çubuğu hiyerarşisi:** kategori başlıkları (Öğren / Kurslarım / Hesap) büyük ve yarı kalın; alt öğeler girintili, soft tonda. Kurslar ilerleme yüzdesiyle doğrudan menüde; tekrar sayısı rozetle.
- **Panel → Bento ızgarası:** karşılama + hızlı eylemler, seviye, acil görevler (Bugün yolu), tekrar metriği, kurs durumu, etkinlik. Kurslar kart ya da tablo görünümü (seçim hatırlanır).
- **DataTable:** arama ("/" kısayolu), dile duyarlı sıralama, sayfalama (10/25/50), çift tık/Enter ile açma. Panel kurs listesi ve yönetimdeki tüm tablolar.
- **Premium modalı:** karartma + bulanıklık; sunucu `PAYMENT_REQUIRED` döndürünce (ücretsiz kurs hakkı doldu) her yerde kendiliğinden açılır; menü ve profildeki Premium düğmeleri de açar. `/premium` sayfası aynı içeriği kullanır.
- **Düzeltme (ekran kontrolü sonrası):** görsel derste şema sahneden taşıp denetimlerin üstüne biniyordu → sahne içeriğe göre büyüyor, radyal şemalar dar alanda listeye geçiyor (kapsayıcı genişliği), uzun etiketler 2 satırda kesiliyor. "Görsel ders" sekmesi artık kırılmıyor. Panelde "Bugün" satırları kartın dışına taşıyordu; etkinlik ızgarası tüm genişliği dolduruyor.
- **Title Case (kaydederken):** kurs konusu, ad soyad, zihin haritası düğümleri, atıf etiketi ve üretilen kurs/modül/bölüm/görev başlıkları. Türkçe i/İ doğru; DNA, iPhone, COVID-19 gibi biçimler korunur; bağlaçlar küçük kalır. Mevcut kayıtlar değişmez (yalnız yeni kayıtlar).

## 3.3.0 — 2026-11-06 · Anlatımlı görsel ders

- **"Slayt" modu → "Görsel ders"** (`src/studio/LessonPlayer.tsx`): her modül kısa, anlatımlı bir video gibi akar. Sesli anlatım + kelime takipli altyazı; anlatılan cümleyle birlikte şemanın sıradaki parçası açılır ve vurgulanır. Oynat/duraklat, önceki/sonraki sahne, hız (0.85/1/1.25), altyazı, bölüm listesi, tam ekran, kaldığın yerden devam. Tarayıcıda ses yoksa okuma hızında sessiz akar.
- **Bölüm sonu sorusu kapısı:** her bölümün kontrol sorusu cevaplanmadan ileri geçilmez (geri çağırma, FSRS'ye bağlı mevcut `learn.check`).
- **Anlam taşıyan şemalar** (`shared/engine/lesson.ts`, `src/studio/LessonDiagram.tsx`): akış, döngü, neden→sonuç, karşılaştırma, hiyerarşi, kavram ağı, benzetme, zaman çizgisi, sayı (yalnız gerçek sayı varsa). Renk anlam taşır: marka = kavram, amber = kilit fikir, yeşil = doğru/çıktı, kırmızı = hata/risk. 47 anlamlı simge.
- **Uydurma sayılar kaldırıldı:** şablon görselleri rastgele değer üretiyordu (`30 + rastgele`); artık değer yoksa çubuk grafiği çizilmez. Görev/özet slaytlarında "1, 2, 3" yerine gerçek adım ve kilit fikir metinleri.
- Sunucu: `learn.lesson` (kilit denetimi, dil başına önbellek, eşzamanlı istek birleştirme), AI görevi `lesson.visual` (ağır model, 90 gün önbellek), şablon yedeği. Veri: `0004_lesson.sql` (açılışta kendiliğinden uygulanır).
- AI slayt destesi (asistandan) eski slayt görünümünde açılmaya devam eder.
- **Yapılmalı:** Render'da `ANTHROPIC_API_KEY` (veya seçili sağlayıcının anahtarı) tanımlı değilse tüm içerik şablon metnidir; şemalar konuya özel kurulmaz. Anahtar tanımlanınca şablon dersler ilk açılışta AI ile yeniden üretilir.

## 3.2.1 — 2026-11-06 · Ajan-hazır tasarım sistemi

- **AGENTS.md / CONVENTIONS.md / CLAUDE.md** eklendi: ajanın giriş noktası, bağlayıcı kural kitabı (Codrops, "Design Systems and Agents" yaklaşımı).
- **`npm run lint:design`** (`scripts/check-design.ts`): ham renk, gradient, renkli gölge, kalın sol vurgu çizgisi, sistem dışı yazı ailesi, eksik/yarım sözlük anahtarı → derleme durur. `npm run ci`'ye eklendi.
- **Belirteç kaymaları düzeltildi:** sertifika eski altın (#DCA037) ve gri tonlarını, 3B sahne eski indigo yedeklerini, tema önizlemesi eski mürekkep rengini kullanıyordu. Hepsi belirteçlere bağlandı.
- Yeni belirteçler: `on-night`, `on-night-2`, `on-night-gold`, `on-gold`; temadan bağımsız yüzey için `data-sheet="paper|ink"`.
- `src/lib/brand.ts`: CSS dışı bağlamlar için belirteç aynası; `tests/design.test.ts` senkronu doğrular.
- Etki: görsel olarak sertifika artık marka amberini kullanır; başka kullanıcı etkisi yok. Ajanlar bileşende ham renk yazamaz.

## 3.2.0 — 2026-11-06 · Kişisel yol

- Kurs hedefi (neden / hedef tarih / dk-gün) → plan, tahmini bitiş, "Yolum" paneli.
- Panelde **Bugün** yolu; modül ustalığı (belirsizlik bandı) ve zayıf nokta tekrarı (`/tekrar?kurs=ID&mod=zayif`).
- Ön test → finalde eşleştirilmiş **öğrenme kazancı**; yönetimde ortalama.
- İçerik bildirimi + yönetim kuyruğu; `?ref=` atıf kodları ve kullanıcı davetleri.
- Veri: `0003_path.sql` (sunucu açılışında kendiliğinden uygulanır).
