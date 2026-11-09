// Tasarım belirteçlerinin (src/styles.css) CSS dışı bağlamlar için aynası: <meta theme-color>,
// three.js / canvas yedek değerleri. Ham renk yalnız iki yerde yaşar: styles.css ve bu dosya.
// tests/design.test.ts bu değerlerin styles.css ile birebir aynı olduğunu doğrular (kayma = test hatası).
export const BRAND = {
  paper: { bg: '#f3f5fb', surface: '#fdfdff', ink: '#192639', ink3: '#6f7890', lineStrong: '#cdd3e6', brand: '#5b5fef', gold: '#ffc700', night: '#192639', onNightGold: '#ffd84d' },
  ink: { bg: '#0f1626', surface: '#161f33', ink: '#eef1f8', ink3: '#8b95b0', lineStrong: '#34426a', brand: '#8b8ef8', gold: '#ffd23f', night: '#0a1020', onNightGold: '#ffd84d' },
} as const;

export type BrandTheme = keyof typeof BRAND;

/** Çalışma anında belirteç oku (tema değişince güncel değer); yoksa ayna değeri. */
export function token(name: string, fallback: string, el: Element = document.documentElement) {
  try { return getComputedStyle(el).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
}

/** Kurs rengi (1–6): ardışık kurslar farklı renk alır; data-k ile kullanılır. */
export const courseTone = (id: number) => (((id * 5) % 6) + 6) % 6 + 1;
