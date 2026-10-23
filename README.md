# Atahorse v3 — Kişisel Okul Sistemi

> Konuyu seç; motor öğrenme bilimine dayalı, sana göre açılan bir ders yazsın.
> React 19 · Hono · tRPC v11 · Drizzle ORM · SQLite (`node:sqlite`) · three.js · Tailwind CSS v4

---

## 1. Hızlı başlangıç

```bash
cp .env.example .env          # AI anahtarı opsiyonel; yoksa şablon motoru çalışır
npm install
npm run dev                   # web (izleme) + api → http://localhost:3000
```

Üretim:

```bash
npm run build                 # typecheck + dist/web + dist-server
npm start
# veya
docker build -t atahorse . && docker run -p 3000:3000 -v atahorse-data:/data --env-file .env atahorse
```

Testler: `npm test` (motor birim testleri) · `BASE=http://localhost:3000 npm run test:e2e` (Playwright, 17 adım).

---

## 2. Verilen kararlar (ve nedenleri)

| Karar | Neden |
|---|---|
| **Profil = başlangıç kapısı, kader değil.** 6 profil (3 kanal × 2 düşünme üslubu), kursun hangi moddan ve hangi metotla açılacağını seçer. Üç mod da her zaman açık. | "Öğrenme stilleri"ne göre içeriği tek kanala hapsetmenin öğrenmeyi artırdığına dair kanıt yok (Pashler ve ark., 2008). "Sol/sağ beyin" ayrımı da bir nöromit. Bu yüzden ürün arayüzünde **Analitik / Bütüncül** kutuları kullanılıyor ve ikisi de herkese gösteriliyor. Yatırımcı (EIC) incelemesinde savunulabilir olan da bu. |
| **Metot, gerçek sonuçlara göre uyarlanır.** | `chooseMethod()` önce profilin varsayılan metodunu kullanır. 8 cevaptan sonra metot başına doğruluk oranına bakar (Laplace düzeltmeli). %15 olasılıkla da az denenmiş bir metodu keşfeder. Master dosyadaki "öğrenme grafiği" savının çalışan ilk katmanı budur. |
| **Her kursa uygulanan değişmez çekirdek.** | Geri çağırma, aralıklı tekrar (FSRS-4.5), ikili kodlama, bölümleme/işaretleme, çözümlü örnek → azalan destek, detaylandırma, karışık tekrar. Kaynaklar `shared/engine/science.ts` ve ürün içindeki "Neden böyle?" panelinde. |
| **Hono + tRPC + Drizzle** | Uçtan uca tip güvenliği: istemci tipleri `AppRouter`'dan türetilir. Express ve ham SQL tamamen kaldırıldı. |
| **SQLite = `node:sqlite`** | Yerel derleme gerektiren bağımlılık yok. Docker çalışma imajı `node_modules` olmadan çalışır. Postgres'e geçişte yalnızca `server/db/schema.ts` ve `client.ts` değişir. |
| **Model-agnostik AI + şablon yedeği** | Anthropic, OpenAI uyumlu veya Ollama ile çalışır. Anahtar yoksa ya da çağrı başarısız olursa deterministik motor devreye girer. Site asla boş kurs üretmez. |
| **Marka: Cognitive Heritage** | Gradient ve vurgu gölgesi yok. Düz yüzey, ince çizgi, Cinzel + Inter. Temalar: **Kağıt** (varsayılan, aydınlık) ve **Mürekkep**. |
| **Açılış sayfası yeniden yazıldı** | Eski prototipteki doğrulanmamış rakamlar ("5 yıldır", öğrenci sayıları, yorumlar) kaldırıldı. Master dosyanın "rakam uydurma" kuralına uygun. |

---

## 3. Mimari

```
tarayıcı (React 19 SPA, kod bölmeli)
   │  tRPC (httpBatchLink, JSON)            /api/upload (multipart)
   ▼
Hono ─ secureHeaders(CSP) ─ csrf(origin) ─ bodyLimit ─ hız sınırı (bucket)
   │
   ├─ tRPC router ── auth · catalog · profile · course · learn · ai · pub · admin
   │      │
   │      ├─ services/  courses (iş kuyruğu) · learning · gamification · assistant · profile · admin
   │      ├─ ai/        provider (görev→katman yönlendirme) · cache (tam + semantik) · prompts (zod şemaları)
   │      └─ shared/engine  profiles · methods · science · generate · bank(TR/EN/RU) · fsrs · gamification · meb · assist
   │
   └─ Drizzle ORM → SQLite (WAL)  ·  data/uploads
```

**Kurs üretimi (asenkron):** `course.create` çağrısı anında `jobId` döner. Kuyruk (eşzamanlılık 2) sırasıyla şu aşamaları yürütür: profil %8 → taslak %14 → modüller %38–85 → kayıt %95 → hazır %100. İstemci `course.job` uç noktasını 1,2 sn aralıkla sorgular. Kullanıcı başına tek aktif iş kuralı geçerlidir. Sunucu yeniden başlarsa yarım işler kuyruğa geri alınır.

### AI katmanı (`server/ai/provider.ts`)

| Görev | Katman | Önbellek |
|---|---|---|
| `course.outline`, `course.module`, `assist.reteach` | **ağır** | tam eşleşme (+ taslak için semantik) |
| `assist.explain/summarize/diagram/slides`, `mindmap.suggest`, `translate.*` | **hafif** | tam + semantik |

- **Tam eşleşme:** anahtar `sha256(görev, model, sistem, normalize(istem))`. Normalizasyon Türkçe karakterleri katlar ve noktalamayı temizler.
- **Semantik eşleşme:** `AI_EMBED_MODEL` varsa kosinüs ≥ 0,96, yoksa karakter-trigram Jaccard ≥ 0,90. Arama yalnızca aynı görev ve model içinde yapılır.
- **JSON güvenliği:** her çıktı zod ile doğrulanır. Geçersizse hata modele geri verilip bir kez onarım istenir. Yine geçersizse şablon motoru devreye girer.
- **Görünürlük:** `ai_usage` tablosu ve Yönetim paneli görev/katman bazında çağrı, önbellek isabeti, token ve süreyi gösterir.

### Veri modeli (Drizzle, `server/db/schema.ts`)

`users · sessions · cognitive_profiles · method_stats · courses · course_translations · jobs · module_progress · check_answers · quiz_attempts · review_cards · xp_events · activity_days · mode_usage · user_badges · mindmaps · certificates · submissions · ai_cache · ai_usage`

Kurs içeriği `CourseDoc` adlı zod şemasıdır (`shared/types.ts`). Tek doğruluk kaynağı odur ve AI çıktısı, şablon ve çeviri aynı şemaya oturur. **Öğrenciye giden belgede doğru cevaplar yer almaz**: tüm puanlama sunucuda yapılır.

---

## 4. Modüller → kod

| İstenen | Uygulama |
|---|---|
| Üçlü mod, tek tıkla geçiş | `src/studio/Studio.tsx`: Okuma / Podcast / Slayt + Harita, profile göre giriş modu |
| Okuma modu | `ReadingMode.tsx`: süre/bölüm/kelime çipleri, hedefler, kaydırma izlemeli içindekiler, analitik + bütüncül kutu (sırası profile göre), çözümlü örnek, 2D şema, bölüm sonunda **pop-up anlık pekiştirme** (güven derecesiyle) |
| Podcast modu | `PodcastMode.tsx` + `audio.ts`: cümle bazlı TTS, kelime sınırı olaylarıyla **karaoke** (desteklenmiyorsa süre tahmini), kelime akışı sahnesi, 0.75×/1×/1.5×, döngü (cümle/modül), **prosedürel** Odak / Lo-Fi / Doğa sesleri (Web Audio, harici dosya yok) |
| Slayt modu | `SlideMode.tsx` + `Scene3D.tsx`: ray–sahne–panel, ←/→/Space/Home/End, **F** tam ekran, **N** notlar. Her slaytta three.js ile canlı 3D: ağ, bar, yörünge, piramit, döngü, akış. Sürükleyerek döndürülür, WebGL yoksa 2D'ye düşer |
| Core Engine (6 profil × 5 metot) | `shared/engine/profiles.ts`, `methods.ts`, `science.ts`, `generate.ts`, `bank.ts` (TR/EN/RU) |
| Zihin haritası | `MindMap.tsx`: sürükle-bırak, kaydır/yakınlaştır, ekle (Tab), sil (Delete), yeniden adlandır, radyal otomatik yerleşim, AI dal önerisi, otomatik kayıt, SVG dışa aktarım |
| XP sistemi | Görev +20 · Quiz +25 · Modül +100 · Tamamlama +150. Kayıtlar `xp_events` defterine benzersiz `refKey` ile yazılır, böylece aynı ödül iki kez verilmez. Seri sayacı, seviye halkası, 8 dinamik rozet |
| Modül kilidi + sertifika hedefi | Bir önceki quiz %70 ile geçilmeden sonraki modül açılmaz (sunucu da zorlar). Hedef listesi: görevler · quizler · modüller · final. Final karışık sorulardan oluşur, sonunda QR doğrulamalı sertifika verilir |
| AI Asistan | `AiPanel.tsx`: Açıkla · Şemaya Dök (haritaya ekle) · Özetle · Farklı Metotla Öğret · Sunum Hazırla (slayt modunda açılır). **Proaktif:** yanlış cevaptan sonra metot değişikliği, uzun duraksamada özet önerir |
| Paylaşım + TR/EN/RU | `/p/:slug` herkese açık önizleme. Çeviri işi kuyrukta yürür; şablon kurslar anında yeniden derlenir |
| MEB modu | `shared/engine/meb.ts`: 5–12. sınıf × 6 ders × ünite; tek ünite (6 modül) ya da tüm ders (ünite başına bir modül) |
| /profil | İstatistikler, 8 rozet (ilerleme çubuklu), öğrenme grafiği (metot doğruluğu, mod kullanımı), sertifikalar, Kağıt/Mürekkep, dil, tüm cihazlardan çıkış, **tek tıkla hesap ve veri silme** (KVKK/GDPR) |
| Aralıklı tekrar | `/tekrar`: FSRS-4.5; kartlar karışık sırayla gelir, güven derecesi algoritmaya girdi olarak verilir |

---

## 5. Güvenlik

- Parolalar scrypt (N=2¹⁵) ile özetlenir. Sunucu tarafında oturum tutulur: çerezde rastgele belirteç, veritabanında SHA-256 özeti; `HttpOnly`, `SameSite=Lax`, üretimde `Secure`.
- CSP, HSTS (üretim), `frame-ancestors 'none'`; CSRF için köken denetimi; gövde boyutu sınırı; kimlik doğrulama, üretim, asistan ve yükleme işlemlerinde hız sınırı.
- Yüklemelerde uzantı ve MIME beyaz listesi uygulanır, dosya adları rastgeledir, indirme yetkisi denetlenir.
- Sabit yönetici parolası yok: yönetici yalnızca `ADMIN_EMAIL` ve `ADMIN_PASSWORD` verildiğinde oluşturulur.

---

## 6. Bilinen sınırlar / sonraki adımlar

1. **İçerik derinliği AI anahtarına bağlı.** Şablon motoru pedagojik iskeleti eksiksiz kurar, ama metinler geneldir. Gerçek ders için `.env` dosyasına bir sağlayıcı anahtarı girilmelidir.
2. **MEB kataloğu** 2018 programları ve Maarif Modeli geçişi esas alınarak derlendi. Yayından önce güncel programla doğrulanmalı (`shared/engine/meb.ts` tek dosyadır).
3. **Ödeme** şu an simüle ediliyor (`ALLOW_SIMULATED_UPGRADE`). Iyzico veya Stripe entegrasyonu gerekiyor.
4. **Ölçek:** bellek içi kuyruk ve hız sınırı tek örnek için yeterli. Çok örnekli dağıtımda Redis/BullMQ ve Postgres kullanılmalı (arayüz değişmez).
5. **Sesli okuma** tarayıcının TTS seslerini kullanıyor. Sunucu tarafı nöral TTS (ör. ElevenLabs/Azure) eklenebilir.
6. Fontlar Google Fonts'tan yükleniyor. KVKK açısından istenirse `public/fonts` altına taşınabilir.
