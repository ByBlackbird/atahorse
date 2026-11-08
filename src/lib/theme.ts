// Tema: Kağıt (paper) / Mürekkep (ink). İlk açılışta sistem görünümü izlenir;
// kullanıcı seçim yaptığında tercih saklanır (oturum açıksa sunucuda da).
export type Theme = 'paper' | 'ink';
const KEY = 'ah-theme';
import { BRAND } from './brand';
const COLORS: Record<Theme, string> = { paper: BRAND.paper.bg, ink: BRAND.ink.bg };

function systemTheme(): Theme {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'ink' : 'paper'; } catch { return 'paper'; }
}

/** Kullanıcının açıkça seçtiği tema; yoksa null. */
export function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'paper' || v === 'ink') return v;
  } catch { /* gizli pencere vb. */ }
  return null;
}

export function storedTheme(): Theme {
  return savedTheme() ?? systemTheme();
}

/** Temayı uygular; persist=false ise yalnız görünüm değişir (sistem izleme). */
export function applyTheme(t: Theme, persist = true) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[t]);
  if (!persist) return;
  try { localStorage.setItem(KEY, t); } catch { /* yoksay */ }
}

/** Kullanıcı seçim yapmadıysa sistem görünümü değişimini izler. */
export function watchSystemTheme(on: (t: Theme) => void): () => void {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => { if (!savedTheme()) on(e.matches ? 'ink' : 'paper'); };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  } catch { return () => {}; }
}
