// Tasarım belirteçlerinin (src/styles.css) CSS dışı bağlamlar için aynası: <meta theme-color>,
// three.js / canvas yedek değerleri. Ham renk yalnız iki yerde yaşar: styles.css ve bu dosya.
// tests/design.test.ts bu değerlerin styles.css ile birebir aynı olduğunu doğrular (kayma = test hatası).
export const BRAND = {
  paper: { bg: '#f6f5f1', surface: '#fcfbf8', ink: '#0f1f1f', ink3: '#637070', lineStrong: '#cbc7bb', brand: '#003333', gold: '#dc9300', night: '#002626', onNightGold: '#f5d9a0' },
  ink: { bg: '#0a1f1f', surface: '#0f2828', ink: '#eef1ec', ink3: '#869c99', lineStrong: '#2a5151', brand: '#7cc4b9', gold: '#e8ab3c', night: '#031313', onNightGold: '#f5d9a0' },
} as const;

export type BrandTheme = keyof typeof BRAND;

/** Çalışma anında belirteç oku (tema değişince güncel değer); yoksa ayna değeri. */
export function token(name: string, fallback: string, el: Element = document.documentElement) {
  try { return getComputedStyle(el).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
}

/** Kurs rengi (1–6): ardışık kurslar farklı renk alır; data-k ile kullanılır. */
export const courseTone = (id: number) => (((id * 5) % 6) + 6) % 6 + 1;
