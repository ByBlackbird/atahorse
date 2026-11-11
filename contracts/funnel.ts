/**
 * Danışmanlık satış hunisi ve takip kuralı — HAIZ Kâr Planı, Adım 5 (Işıl Can onayı, 9 Kasım 2026).
 *
 * Huni: başvuru → yanıt → Ofis Röntgeni → teklif → imza / kayıp.
 * Takip kuralı: başvuruya 24 saat içinde yanıt; cevapsız teklif 3., 7. ve 14. günde takip;
 * 14. günden sonra "kapandı — neden" notuyla kapatılır. Kaybedilen her teklif için tek satır neden.
 */

export const LEAD_STAGES = ["basvuru", "yanit", "rontgen", "teklif", "imza", "kayip"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  basvuru: "Başvuru",
  yanit: "Yanıt verildi",
  rontgen: "Röntgen yapıldı",
  teklif: "Teklif gönderildi",
  imza: "İmzalandı",
  kayip: "Kaybedildi",
};

/** Huni sırası (kayıp dışarıda) */
export const FUNNEL_ORDER: LeadStage[] = ["basvuru", "yanit", "rontgen", "teklif", "imza"];

export const LOST_REASONS = [
  { id: "fiyat", label: "Fiyat" },
  { id: "zamanlama", label: "Zamanlama" },
  { id: "kapsam", label: "Kapsam uymadı" },
  { id: "guven", label: "Güven / tanımıyor" },
  { id: "cevapsiz", label: "Cevap vermedi" },
  { id: "diger", label: "Diğer" },
] as const;
export type LostReason = (typeof LOST_REASONS)[number]["id"];

/** Eski durum alanıyla uyum (leads.status: new | contacted | done) */
export function statusFromStage(stage: LeadStage): "new" | "contacted" | "done" {
  if (stage === "basvuru") return "new";
  if (stage === "imza" || stage === "kayip") return "done";
  return "contacted";
}

/** Teklif takip günleri */
export const FOLLOW_UP_DAYS = [3, 7, 14] as const;
export const REPLY_WITHIN_HOURS = 24;

const DAY = 86_400_000;

/**
 * Şu an yapılması gereken takip (yoksa null).
 * stageAt: aşamaya girildiği an (yoksa createdAt); followUps: teklif sonrası yapılan takip sayısı.
 */
export function dueFollowUp(
  l: { stage: string; stageAt: Date | string | null; createdAt: Date | string; followUps: number },
  now = Date.now(),
): { label: string; urgent: boolean } | null {
  const since = new Date(l.stageAt ?? l.createdAt).getTime();
  if (l.stage === "basvuru") {
    const h = (now - new Date(l.createdAt).getTime()) / 3_600_000;
    if (h < REPLY_WITHIN_HOURS) return null;
    return { label: h >= 48 ? `${Math.floor(h / 24)} gündür yanıt bekliyor` : `${Math.floor(h)} saattir yanıt bekliyor`, urgent: true };
  }
  if (l.stage !== "teklif") return null;
  const days = Math.floor((now - since) / DAY);
  const next = FOLLOW_UP_DAYS[l.followUps];
  if (next === undefined) {
    return days >= 14 ? { label: "14 gün doldu — kapat ve nedenini yaz", urgent: true } : null;
  }
  return days >= next ? { label: `${next}. gün takibi`, urgent: next === 14 } : null;
}
