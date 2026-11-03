// Tema: Kağıt (paper) / Mürekkep (ink). İlk açılışta sistem görünümü izlenir;
// kullanıcı seçim yaptığında tercih saklanır (oturum açıksa sunucuda da).
export type Theme = 'paper' | 'ink';
const KEY = 'ah-theme';
const COLORS: Record<Theme, string> = { paper: '#F6F5F1', ink: '#061A1A' };

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
