/**
 * Birinci taraf ziyaret kaydı (çerezsiz) → POST /api/e
 * Oturum kimliği sessionStorage'da (sekme kapanınca biter; 30 dk hareketsizlikte yenilenir).
 * Kişisel veri gönderilmez: yalnız sayfa yolu, yönlendiren adres, UTM etiketleri, saat dilimi, ekran genişliği.
 * Kurucu kendi tarayıcısını saymamak için localStorage "haiz_notrack" = 1 (Kurucu Paneli ilk açılışta koyar; panelden değiştirilir).
 */
import { isTrackedPath } from "@contracts/traffic";

const SID_KEY = "haiz_sid";
const IDLE_MS = 30 * 60_000;
let lastPath = "";

function store(kind: "session" | "local"): Storage | null {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function randomId(): string {
  const a = new Uint8Array(10);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-6);
}

/** Oturum kimliği; yeni oturumsa isNew = true */
function session(): { sid: string; isNew: boolean } {
  const ss = store("session");
  const now = Date.now();
  try {
    const raw = ss?.getItem(SID_KEY);
    if (raw) {
      const [sid, ts] = raw.split(":");
      if (sid && now - Number(ts) < IDLE_MS) {
        ss?.setItem(SID_KEY, `${sid}:${now}`);
        return { sid, isNew: false };
      }
    }
  } catch {
    // depolama kapalı
  }
  const sid = randomId();
  try {
    ss?.setItem(SID_KEY, `${sid}:${now}`);
  } catch {
    // depolama kapalı — her görüntüleme ayrı oturum sayılır
  }
  return { sid, isNew: true };
}

export function isTrackingOff(): boolean {
  try {
    return store("local")?.getItem("haiz_notrack") === "1";
  } catch {
    return false;
  }
}

export function setTrackingOff(off: boolean) {
  try {
    store("local")?.setItem("haiz_notrack", off ? "1" : "0");
  } catch {
    // yok say
  }
}

/** Kurucu Paneli ilk kez açıldığında bu tarayıcıyı sayım dışı bırak (sonradan panelden açılabilir) */
export function defaultFounderOptOut() {
  try {
    if (store("local")?.getItem("haiz_notrack") === null) setTrackingOff(true);
  } catch {
    // yok say
  }
}

/** Başvuru formu için: mevcut oturum kimliği (kayıt kapalıysa gönderilmez) */
export function currentSid(): string | undefined {
  if (isTrackingOff()) return undefined;
  return session().sid;
}

export function trackView(path: string, search: string) {
  if (typeof window === "undefined" || isTrackingOff() || !isTrackedPath(path) || path === lastPath) return;
  lastPath = path;
  const { sid, isNew } = session();
  const body: Record<string, unknown> = { t: "view", s: sid, p: path, w: window.innerWidth };
  try {
    body.z = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // saat dilimi okunamadı
  }
  // Kaynak bilgisi yalnız oturumun ilk görüntülemesinde
  if (isNew) {
    const q = new URLSearchParams(search);
    if (document.referrer) body.r = document.referrer;
    const u = { source: q.get("utm_source"), medium: q.get("utm_medium"), campaign: q.get("utm_campaign") };
    if (u.source || u.medium || u.campaign) body.u = u;
    if (q.get("gclid") || q.get("fbclid") || q.get("li_fat_id") || q.get("msclkid")) body.k = 1;
  }
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/e", new Blob([json], { type: "text/plain" }))) return;
  } catch {
    // beacon yok
  }
  void fetch("/api/e", { method: "POST", body: json, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => undefined);
}

