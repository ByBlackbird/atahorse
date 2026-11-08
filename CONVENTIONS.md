# CONVENTIONS.md — Bağlayıcı kurallar

Bu dosya kural kitabıdır; nesir değil sözleşmedir. **[makine]** etiketli kurallar
`npm run lint:design` ve testlerle zorlanır; ihlal derlemeyi durdurur. Bilinçli istisna yalnız
satıra `design-ok: <gerekçe>` yorumu yazılarak yapılır.

## A. Görsel dil — Cognitive Heritage

1. **[makine]** Ham renk (`#hex`, `rgb()`, `hsl()`, `text-[#…]`) yalnız `src/styles.css` ve `src/lib/brand.ts` içinde yaşar. Bileşende belirteç kullanılır.
2. **[makine]** Gradient yok (`bg-gradient-*`, `linear/radial/conic-gradient`).
3. **[makine]** Renkli/ışıyan gölge yok. Derinlik yalnız `.elev-1/2/3` (nötr).
4. **[makine]** Kalın sol vurgu çizgisi (`border-l-3+`) yok — ajan üretimi kalıbıdır. Alıntı için en çok `border-l-2`.
5. **[makine]** Yazı ailesi yalnız sistemden: başlık `h-display` (Plus Jakarta Sans), metin `font-sans` (Inter), marka imzası `h-brand` (Cinzel — yalnız sertifika gibi tören yüzeyleri; logo görseldir, değiştirilmez).
6. **[insan]** Renk rolü: `brand` birincil eylem ve kurumsal yüzey · `accent` yalnız etkileşim (odak halkası, seçili/aktif, bağlantı, sıralama oku) · `gold` ilerleme/ödül/acil · `ok`/`bad` sonuç. Yüzeyler saf beyaz değil (`surface` #fcfbf8).
7. **[insan]** Etkileşimli yüzey `card-i`: hover'da 2px kalkar, gölge md→lg, basınca aksan halkası, çift tıkta nabız (`InteractionFeedback`). Statik bilgi kutusu `card`. Tüm geçişler `.2s var(--ease-ui)`; azaltılmış hareket tercihinde kapalı.
8. **[insan]** Tablo verisi `DataTable` ile (arama, sıralama, sayfalama, çift tık/Enter ile açma; dokunmatikte tek dokunuş). Düz `<table>` yazma.
9. **[insan]** Premium gerektiren eylem: `usePremium().guard(fn)` ya da sunucu `PAYMENT_REQUIRED` → modal kendiliğinden açılır. Sayfa bazında ayrı yükseltme akışı yazma.
10. **[makine]** Başlık biçimi: kullanıcı girdisi başlıklar (kurs konusu, ad soyad, zihin haritası, atıf etiketi) ve üretilen kurs/modül/bölüm başlıkları kaydedilirken `shared/engine/text.ts › titleCase` ile; içerik paragraflarına uygulanmaz.
6. Rastgele kesikli çizgi yok; kesikli kenar yalnız "henüz gelmemiş adım" durumunu anlatır.
7. Palet: derin teal `--c-brand` + amber `--c-gold`; zemin Kağıt / Mürekkep. Koyu bant üstünde `text-on-night`, amber dolgu üstünde `text-on-gold`.
8. Her zaman iki temada görünmeli; temadan bağımsız yüzey (sertifika, önizleme) `data-sheet="paper|ink"` ile belirteç kapsamı alır.
9. **[makine]** `lib/brand.ts` değerleri `styles.css` ile birebir aynı (`tests/design.test.ts`).

## B. Etkileşim — Apple HIG

1. Dokunmatik hedef ≥ 44 × 44 px; mobil sekme çubuğu en çok 4 öğe.
2. Her eylem geri bildirim verir (yükleniyor, başarı, hata); hata metni ne olduğunu ve ne yapılacağını söyler.
3. Yıkıcı işlem geri alınabilir ya da açık onay ister; "Sil" hiçbir zaman birincil düğme rengiyle durmaz.
4. Odak görünür (`:focus-visible`), diyaloglarda odak tuzağı, `aria-label` ikon düğmelerde zorunlu.

## C. Metin ve dil

1. **[makine]** Her sözlük anahtarı TR / EN / RU üçünde dolu; kodda kullanılan her sabit anahtar sözlükte var.
2. Ses: sakin özgüven, kısa cümle, somut örnek. "ŞOK", "KAÇIRMA" yok.
3. Rakam varsa kaynağı var; tahmin varsa aralığı var. Öğrenme stili eşleştirmesi vaat edilmez.

## D. Kod

1. Tam ve çalışır dosya; yarım parça yok. TypeScript katı, girdiler zod.
2. Paylaşılan hesap `shared/engine`'de saf fonksiyon; testsiz alan mantığı birleştirilmez.
3. Şema değişikliği yalnız yeni migration ile; uygulanmış migration düzenlenmez.
4. Sunucu otoriterdir: puan, XP, kilit, ödül sunucuda hesaplanır; doğru cevap istemciye gitmez.
5. AI çağrısı `server/ai/provider.ts` üzerinden: hafif/ağır yönlendirme + önbellek + zod onarım + şablon yedeği.
6. Güvenlik: CSP, CSRF köken denetimi, hız sınırı, scrypt, HttpOnly oturum çerezi — gevşetilmez.

## E. Ajan sınırları

Ajanlar yapılandırılmış işte güçlüdür (belirteç, erişilebilirlik ölçümü, bileşen kodu, belge). Soyutlama
yükseldikçe insan yargısı belirleyicidir: hareket zamanlaması, kompozisyon, marka tonu. Denetimsiz ajan
çıktısı "boş" hisseder; görsel değişiklik insan gözünden geçmeden yayınlanmaz.
