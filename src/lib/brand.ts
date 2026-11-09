// Tasarım belirteçlerinin (src/styles.css) CSS dışı bağlamlar için aynası: <meta theme-color>,
// three.js / canvas yedek değerleri. Ham renk yalnız iki yerde yaşar: styles.css ve bu dosya.
// tests/design.test.ts bu değerlerin styles.css ile birebir aynı olduğunu doğrular (kayma = test hatası).
export const BRAND = {
  paper: { bg: '#fdfcf8', surface: '#ffffff', ink: '#1e1b4b', ink3: '#5e5b84', lineStrong: '#ccc8bc', brand: '#5b2de6', gold: '#f5b942', night: '#06060c', onNightGold: '#f5b942' },
  ink: { bg: '#06060c', surface: '#12112a', ink: '#fdfcf8', ink3: '#9c99bc', lineStrong: '#3b3870', brand: '#9468f7', gold: '#f5b942', night: '#000000', onNightGold: '#f5b942' },
} as const;

export type BrandTheme = keyof typeof BRAND;

/** Çalışma anında belirteç oku (tema değişince güncel değer); yoksa ayna değeri. */
export function token(name: string, fallback: string, el: Element = document.documentElement) {
  try { return getComputedStyle(el).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
}

/** Kurs rengi (1–6): ardışık kurslar farklı renk alır; data-k ile kullanılır. */
export const courseTone = (id: number) => (((id * 5) % 6) + 6) % 6 + 1;
