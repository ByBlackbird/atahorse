/**
 * Site trafiği — istemci ve sunucu ortak tanımlar (Kurucu Paneli · Trafik / Canlı / Kampanya / SEO).
 * Shopify Analytics karşılıkları: Oturum, tekil ziyaretçi, dönüşüm oranı, kaynak, açılış sayfası, cihaz, konum, canlı görünüm.
 * HAIZ'de "satış" = danışmanlık başvurusu (lead) ve imza.
 */

export const CHANNELS = ["organik", "reklam", "sosyal", "eposta", "yonlendirme", "dogrudan"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  organik: "Organik arama",
  reklam: "Reklam",
  sosyal: "Sosyal medya",
  eposta: "E-posta",
  yonlendirme: "Başka site",
  dogrudan: "Doğrudan",
};

export const DEVICES = ["mobil", "tablet", "masaustu"] as const;
export type Device = (typeof DEVICES)[number];
export const DEVICE_LABEL: Record<Device, string> = { mobil: "Mobil", tablet: "Tablet", masaustu: "Masaüstü" };

/** Sayılan halka açık sayfalar (uygulama içi ekranlar sayılmaz) */
export function isTrackedPath(path: string): boolean {
  return path === "/" || path === "/restorasyon" || path === "/danismanlik" || path.startsWith("/danismanlik/") || path === "/login" || path === "/katil";
}

const SEARCH = /(^|\.)(google|bing|yandex|duckduckgo|yahoo|ecosia|baidu|brave|qwant)\./i;
const SOCIAL = /(^|\.)(instagram|facebook|fb|linkedin|lnkd|t|twitter|x|youtube|youtu|whatsapp|wa|tiktok|pinterest|threads|telegram)\.(com|me|be|co|net|in)$/i;
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|ads|ad|display|banner|cpm)$/i;

/** Kanal: UTM ve tıklama kimliği (gclid / fbclid) önce, sonra yönlendiren site */
export function classifyChannel(refHost: string | null, utm: { source?: string | null; medium?: string | null }, clickId: boolean): Channel {
  const medium = (utm.medium ?? "").trim();
  const source = (utm.source ?? "").trim().toLowerCase();
  if (clickId || PAID_MEDIUM.test(medium)) return "reklam";
  if (/^e-?mail|^eposta|^newsletter/i.test(medium) || /^e-?mail|^eposta/.test(source)) return "eposta";
  if (/^(social|sosyal|organic_social)$/i.test(medium)) return "sosyal";
  if (/^organic$/i.test(medium)) return "organik";
  if (source && /(instagram|facebook|linkedin|youtube|tiktok|whatsapp|twitter)/.test(source)) return "sosyal";
  if (source && /(google|bing|yandex)/.test(source)) return "organik";
  if (!refHost) return source ? "yonlendirme" : "dogrudan";
  if (SEARCH.test(refHost)) return "organik";
  if (SOCIAL.test(refHost) || /instagram|facebook|linkedin/i.test(refHost)) return "sosyal";
  if (/mail\./i.test(refHost)) return "eposta";
  return "yonlendirme";
}

/** Cihaz: tarayıcı kimliği + ekran genişliği */
export function deviceOf(ua: string, width?: number | null): Device {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Opera Mini|IEMobile/i.test(ua)) return "mobil";
  if (width && width < 768) return "mobil";
  return "masaustu";
}

/** Bilinen botlar sayılmaz (arama motoru tarayıcıları, önizleme botları, izleme servisleri) */
export const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http|java\/|render/i;

/** Saat dilimi → okunur konum (tarayıcının saat dilimi; IP konumu kullanılmaz) */
export function tzLabel(tz: string | null): string {
  if (!tz) return "Bilinmiyor";
  if (tz === "Europe/Istanbul" || tz === "Asia/Istanbul") return "Türkiye";
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  const region = tz.split("/")[0];
  const R: Record<string, string> = { Europe: "Avrupa", America: "Amerika", Asia: "Asya", Africa: "Afrika", Australia: "Avustralya", Pacific: "Pasifik", Atlantic: "Atlantik", Indian: "Hint Okyanusu" };
  return `${city} (${R[region] ?? region})`;
}

export const RANGE_OPTIONS = [
  { days: 1, label: "Bugün" },
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
  { days: 90, label: "90 gün" },
] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number]["days"];

/** Kampanya bağlantısı (UTM) — reklam ve paylaşımlarda kullanılacak adres */
export function buildCampaignUrl(base: string, p: { source: string; medium: string; campaign: string; content?: string }): string {
  const slug = (v: string) =>
    v
      .trim()
      .toLocaleLowerCase("tr")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const u = new URL(base);
  if (p.source) u.searchParams.set("utm_source", slug(p.source));
  if (p.medium) u.searchParams.set("utm_medium", slug(p.medium));
  if (p.campaign) u.searchParams.set("utm_campaign", slug(p.campaign));
  if (p.content) u.searchParams.set("utm_content", slug(p.content));
  return u.toString();
}

/** Kampanya bağlantısı için hazır kaynak/ortam seçenekleri (Instagram + LinkedIn odaklı) */
export const UTM_PRESETS = [
  { id: "ig-bio", label: "Instagram profil bağlantısı", source: "instagram", medium: "social" },
  { id: "ig-reklam", label: "Instagram reklamı", source: "instagram", medium: "paid_social" },
  { id: "li-post", label: "LinkedIn gönderisi", source: "linkedin", medium: "social" },
  { id: "li-reklam", label: "LinkedIn reklamı", source: "linkedin", medium: "paid_social" },
  { id: "google-reklam", label: "Google Ads", source: "google", medium: "cpc" },
  { id: "eposta", label: "E-posta", source: "eposta", medium: "email" },
] as const;
