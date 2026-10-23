// Tema: Kağıt (paper, varsayılan) / Mürekkep (ink). Kullanıcı tercihi sunucuda da saklanır.
export type Theme = 'paper' | 'ink';
const KEY = 'ah-theme';

export function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'paper' || v === 'ink') return v;
  } catch { /* gizli pencere vb. */ }
  return 'paper';
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'ink' ? '#0D1A26' : '#F6F7F6');
  try { localStorage.setItem(KEY, t); } catch { /* yoksay */ }
}
