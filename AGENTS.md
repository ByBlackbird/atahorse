# AGENTS.md — Atahorse için ajan giriş noktası

Bu dosya, bu depoda çalışan her ajanın (Claude Code, Codex, Cursor…) ilk okuduğu bağlamdır.
Bağlayıcı tasarım ve kod kuralları **CONVENTIONS.md**'dedir; değişiklik geçmişi **CHANGELOG.md**'de.
Çelişkide sıra: kullanıcının talebi → CONVENTIONS.md → bu dosya → kodun mevcut hali.

## 1. Ürün (asla bozulmayacak çekirdek)

Atahorse kişisel bir okul sistemidir: **öğrenen her konuyu açabilir**, motor öğrenme bilimine
dayalı bir kurs yazar ve öğrenenin zihinsel profiline göre **giriş kapısını** seçer.

- Profil yalnız başlangıç modunu ve metodu seçer; okuma / podcast / 3B slayt / zihin haritası herkese açık kalır.
- "Öğrenme stilleri" eşleştirmesi vaat edilmez (Pashler vd. 2008). Arayüzde Analitik + Bütüncül kutuların ikisi de gösterilir.
- Değişmez çekirdek: geri çağırma, FSRS-4.5 aralıklı tekrar, ikili kodlama, bölümleme, karışık tekrar.
- Tahmin ve metrik yalnız gerçek veriyle, belirsizlik bandıyla. Rakam uydurulmaz.

## 2. Yığın ve komutlar

React 19 · Hono · tRPC v11 · Drizzle (SQLite, `node:sqlite`) · Tailwind CSS v4 · three.js · zod. Node ≥ 22.13.

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | web izleme + API (http://localhost:3000) |
| `npm run typecheck` | TypeScript |
| `npm run lint:design` | Tasarım sözleşmesi + sözlük denetimi (`scripts/check-design.ts`) |
| `npm test` | Birim + bellek içi API entegrasyon testleri (sunucu açmaz) |
| `npm run build` | `dist/` (web) + `dist-server/` (API + migrations) |
| `npm run ci` | Hepsi. **Bitti tanımı: `npm run ci` yeşil.** |

## 3. Harita

```
shared/            Saf alan mantığı (sunucu + istemci + test). Yan etki yok.
  types.ts         zod şemaları — tek doğruluk kaynağı
  engine/          profiles, methods, science, fsrs, generate, bank, meb, assist, gamification, path
server/
  db/schema.ts     Drizzle tabloları;  db/migrations/NNNN_ad.sql  sıralı, bir kez uygulanır
  ai/              provider.ts (görev → hafif/ağır model, önbellek, onarım), prompts.ts (istem + zod)
  services/        iş mantığı (courses, learning, path, growth, assistant, profile, admin, auth)
  trpc/router.ts   API yüzeyi — istemci tipleri buradan türer (AppRouter)
src/
  styles.css       Tasarım belirteçleri (Kağıt / Mürekkep) — ham rengin yaşadığı tek yer
  lib/brand.ts     Belirteçlerin CSS dışı aynası (testle senkron tutulur)
  i18n/dict.ts     TR / EN / RU sözlük — her anahtar üç dilde
  ui/ app/ pages/ studio/   bileşenler, iskelet, sayfalar, öğrenme stüdyosu
tests/             *.test.ts (node:test + tsx)
```

## 4. Oyun kitapları

**Yeni özellik**
1. Saf hesap → `shared/engine/<alan>.ts` + `tests/<alan>.test.ts`.
2. Veri → `server/db/schema.ts` + yeni `server/db/migrations/NNNN_ad.sql` (eski migration'a dokunma).
3. İş mantığı → `server/services/<alan>.ts`; hata `AppError('kod')`, kod sözlükte de olsun.
4. Uç nokta → `server/trpc/router.ts`, girdi zod ile; yetki `authed` / `adminProcedure`; gerekirse `limited()`.
5. Arayüz → yalnız belirteç sınıfları (`bg-surface`, `text-ink-2`, `border-line`, `bg-brand`…) ve `ui/kit.tsx` bileşenleri.
6. Metin → `src/i18n/dict.ts` üç dilde. Sabit metni bileşene gömme.
7. Entegrasyon testi → `tests/*.int.test.ts` (tRPC `createCaller`, bellek içi DB).
8. `npm run ci` yeşil → `CHANGELOG.md`'ye tüketici diliyle bir giriş.

**Yeni AI görevi:** `ROUTES`'a görev (katman, token, sıcaklık, önbellek günü, semantik) → `prompts.ts`'e istem + zod şeması → `completeJSON` → **şablon yedeği zorunlu** (AI yokken site boş kalmaz).

**Yeni renk / yüzey:** önce `styles.css`'e belirteç (iki temada) + `@theme inline` eşlemesi; CSS dışı kullanım gerekiyorsa `lib/brand.ts`'e ayna + `tests/design.test.ts` eşlemesi. Bileşende ham değer yazılmaz.

## 5. Ajanın yapmadıkları (insan kararı)

- Hareket/animasyon zamanlaması, görsel yargı, marka tonu ve pazarlama iddiaları: öneri sun, karar insanın.
- Kullanıcı verisini silen/geri dönüşsüz işlemler, ödeme, üretime dağıtım.
- Doğrulanmamış rakam, yorum, logo veya "güvenilen kurumlar" listesi eklemek.
