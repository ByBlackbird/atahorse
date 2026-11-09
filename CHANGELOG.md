# CHANGELOG

İnsanlar ve ajanlar için değişiklik özeti (git geçmişini kazmadan). En yeni üstte.
Biçim: ne değişti → kimi etkiler → gerekirse ne yapılmalı.

## 3.7.0 — Bilimsel Yol Haritası uygulandı (Faz 0 + Faz 1 hızlı işler)
- **Palet (§6.1):** fildişi #FDFCF8 zemin, gece laciverti #1E1B4B metin, mor #5B2DE6 yalnız birincil eylem, altın #F5B942 yalnız ilerleme/ödül, derin lacivert #06060C koyu bant. Pembe, aurora gradientleri, cam bulanıklığı ve ışıyan gölgeler kaldırıldı. Kurs renkleri mor-lacivert ailesine indirildi. WCAG AA denetlendi; koyu temada mor #9468F7'ye açıldı (yüzeyde 4,9:1).
- **Düğmeler (§6.3–6.4):** ekranda tek dolu mor; kenar çubuğundaki "Yeni kurs" ikincil oldu; odak halkası, devre dışı ve yükleniyor durumları; zıplama/gölge yok; `btn-gold` yalnız sertifika.
- **Marka dili (§2.1):** yeni konumlandırma cümlesi; "kanal/zihnine göre" vaatleri kaldırıldı; SSS "öğrenme stili" sorusu dürüst cevapla; profil sonucu "İlk kapın" + tüm kapılar görünür.
- **Ölçüm (Faz 0):** `events` tablosu ve olaylar (kayıt, kursa başlama, modül/kurs bitirme, quiz, tekrar oturumu, aralıklı cevap, final, ikinci kurs, ücretsiz limit, yükseltme). Yönetimde haftalık kohort tablosu: tamamlama, 7 günde tekrar, 7/30 gün hatırlama, ikinci kurs, ücretliye geçiş.
- **Serbest yanıt (Faz 0):** bölüm kontrolü ve tekrar kartlarında varsayılan "yaz → örnek cevapla karşılaştır → kendini puanla"; puan FSRS'ye bağlı; doğru cevap yazmadan gönderilmez. `recall_answers` tablosu. Çoktan seçmeli yedek yol olarak kaldı. Kontrol kutusu altından nötr yüzeye alındı.
- **18+ beyanı (Faz 0):** kayıtta zorunlu onay; `users.adult_confirmed_at`.
- **Hedefli drill (Faz 1):** kalınan quizden sonra birincil eylem; modülün en zayıf 3–5 sorusu serbest yanıtla, sonra "Quizi yeniden çöz".
- **Hedef çubuğu + "Farklı anlat" (Faz 1):** ders ekranının üstünde modül hedefi sabit; tek tıkla başka metotla yeniden anlatım.
- Migration: `0006_roadmap_faz0.sql`.
- **Yapılmadı:** gerçek ödeme (iyzico/Stripe anahtarı gerekli; simüle yükseltme bayrağı duruyor), hedef sorusuna "haftada kaç gün", Faz 2–3 maddeleri.

## 3.6.0 — v5 "Aurora" iç uygulama + yeni sertifika
- **Kenar çubuğu v5:** lacivert panel, altın logo, seçili öğe dolu indigo hap, pembe "Yeni kurs". İçindeki ortak bileşenler `.sidebar` yerel belirteçleriyle koyulaşır.
- **Masaüstü üst çubuk:** tarih + selamlama, seri, XP/seviye, tema, profil avatarı (stüdyo ray modunda gizli).
- **`PageHero`** (kit): iç sayfaların ortak lacivert giriş bandı → Panel, Yeni kurs, Tekrar, Profil, Yönetim.
- **Panel v5:** "Kaldığın yer" bandı + ilerleme halkası, gerçek verili 4 istatistik kutusu (kurs, biten modül, seri, XP), Bugün listesi müfredat satırı biçiminde, renk başlıklı kurs kartları. Panel ve kurs yolu artık tam kenar çubuğuyla açılır.
- **Sertifika v5:** iki tasarım — Klasik (krem, altın çerçeve, lacivert kurdele) ve Gece (altın kenarlı lacivert pano). Özgün SVG köşe süsleri, isim çizgisi, amblemli mühür; QR her iki tasarımda okunur. `?stil=klasik|gece` ile seçilir, tercih hatırlanır. A4 yatay baskı ölçüleri `cqw` ile sabit.
- **Logo kullanım kuralı:** yazılı logo (wordmark) yalnız tanıtım yüzeylerinde — ana sayfa üst çubuğu ve alt bilgisi. Uygulama kenar çubuğu ve mobil üst çubuk: amblem + arayüz yazı tipinde "Atahorse" (`BrandLockup`); ray, giriş/kayıt: yalnız amblem (`Mark`); sertifika: kurdelede dizgi ad, mühürde amblem. Yeni `emblem-ink.png` (lacivert #192639), `emblem-gold.png` kırpıldı.
- Lora (OFL) yazı tipi kendi sunucumuzdan: sertifika başlık ve isim için (Türkçe/Kiril glifleri dahil).

- Duolingo tarzı dairesel patika düğümleri kaldırıldı → kurs sayfası ve ana sayfa önizlemesi düz müfredat listesi (`LessonRow`, `.lesson-list`) kullanır. `.node`/`.node-ring` CSS'i silindi.
- Final sınavı düğümü yerine durum kartı (kilitli / açık / sertifika hazır).
- `src/lib/brand.ts` aynası v5 Aurora belirteçleriyle eşitlendi (tasarım testi yeniden yeşil).

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
