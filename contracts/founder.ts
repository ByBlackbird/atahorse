/**
 * Kurucu paneli ortak tanımları: danışmanlık kapasitesi, geri bildirim türleri, hata kaynakları.
 * Kapasite kuralı danışmanlık fiyat politikasıyla aynıdır (00-Ortak/10 Fiyat ve indirim politikası).
 */

/** Haftalık danışmanlık kapasitesi (saat) */
export const WEEKLY_CAPACITY_HOURS = 25;

export interface CapacityRule {
  label: string;
  /** Liste fiyatına uygulanacak artış (%) */
  surcharge: number;
  tone: "mint" | "amber" | "red";
  advice: string;
}

/**
 * Doluluk → fiyat kuralı
 *  - %70'in altı: liste fiyatı
 *  - %70–99: yeni işe +%15
 *  - %100 ve üstü: bekleme listesi (acil istenirse +%25)
 */
export function capacityRule(pct: number): CapacityRule {
  if (pct >= 100) return { label: "Dolu", surcharge: 25, tone: "red", advice: "Yeni iş bekleme listesine; acil istenirse +%25." };
  if (pct >= 70) return { label: "Yoğun", surcharge: 15, tone: "amber", advice: "Yeni tekliflerde liste fiyatı +%15." };
  return { label: "Uygun", surcharge: 0, tone: "mint", advice: "Liste fiyatı geçerli." };
}

/** Pazartesi başlangıçlı hafta: "2026-11-02" */
export function weekStartOf(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} dk`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

export const FEEDBACK_KINDS = [
  { id: "soru", label: "Soru / yardım" },
  { id: "hata", label: "Hata bildirimi" },
  { id: "oneri", label: "Öneri" },
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]["id"];
export const FEEDBACK_KIND_IDS = FEEDBACK_KINDS.map((k) => k.id) as [FeedbackKind, ...FeedbackKind[]];

export const FEEDBACK_STATUS_LABEL: Record<string, string> = {
  open: "Açık",
  answered: "Cevaplandı",
  closed: "Kapandı",
};

export const ERROR_SOURCE_LABEL: Record<string, string> = {
  trpc: "Sunucu",
  ai: "Yapay zekâ",
  http: "Uç nokta",
};

/** Başvurudaki "ilgi" metninden paket (yoksa null) */
export function packageIdFromInterest(interest: string | null | undefined, packages: { id: string; name: string; code: string }[]): string | null {
  if (!interest) return null;
  const lower = interest.toLocaleLowerCase("tr");
  return packages.find((p) => lower.includes(p.name.toLocaleLowerCase("tr")))?.id ?? null;
}

/** Kurucu Paneli bölümleri — yan menü ve /kurucu/:bolum adresleri */
export const FOUNDER_SECTIONS = [
  { id: "", label: "Ana sayfa" },
  { id: "basvurular", label: "Başvurular" },
  { id: "urunler", label: "Ürünler" },
  { id: "musteriler", label: "Müşteriler" },
  { id: "analitik", label: "Analitik" },
  { id: "canli", label: "Canlı görünüm" },
  { id: "pazarlama", label: "Pazarlama" },
  { id: "seo", label: "SEO" },
  { id: "odemeler", label: "Ödemeler" },
  { id: "dosyalar", label: "Danışmanlık dosyaları" },
  { id: "yardim", label: "Yardım talepleri" },
  { id: "hatalar", label: "Hatalar" },
] as const;
export type FounderSection = (typeof FOUNDER_SECTIONS)[number]["id"];
