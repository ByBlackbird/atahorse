// Atıf kodu: ?ref=KOD ile gelen ziyaretçinin kaynağı 30 gün saklanır; kayıt ve bekleme listesine eklenir.
// Creator/elçi kampanyalarının kaç kayıt ve aktif öğrenen getirdiği bu kodla ölçülür.
const KEY = 'ah-ref';
const TTL = 30 * 86_400_000;
const VALID = /^[a-z0-9][a-z0-9_-]{1,31}$/;

export function captureRef() {
  try {
    const v = new URLSearchParams(window.location.search).get('ref')?.trim().toLowerCase();
    if (v && VALID.test(v)) localStorage.setItem(KEY, JSON.stringify({ v, at: Date.now() }));
  } catch { /* depolama kapalı */ }
}

export function getRef(): string | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const { v, at } = JSON.parse(raw) as { v: string; at: number };
    if (Date.now() - at > TTL || !VALID.test(v)) { localStorage.removeItem(KEY); return undefined; }
    return v;
  } catch { return undefined; }
}
