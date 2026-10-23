import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Locale } from '../../shared/types';
import { DICT, type DictKey } from './dict';

const IDX: Record<Locale, 0 | 1 | 2> = { tr: 0, en: 1, ru: 2 };
const KEY = 'ah-lang';

function initial(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'tr' || v === 'en' || v === 'ru') return v;
  } catch { /* yoksay */ }
  const n = navigator.language.slice(0, 2);
  return n === 'en' ? 'en' : n === 'ru' ? 'ru' : 'tr';
}

type T = (k: DictKey | string, vars?: Record<string, string | number>) => string;
/** remote: sunucudan gelen tercih — kullanıcı bu oturumda yerel seçim yaptıysa yok sayılır. */
interface Ctx { lang: Locale; setLang: (l: Locale, opts?: { remote?: boolean }) => void; t: T }
const I18n = createContext<Ctx>({ lang: 'tr', setLang: () => {}, t: (k) => String(k) });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>(initial);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const touched = useRef(false);
  const setLang = useCallback((l: Locale, opts?: { remote?: boolean }) => {
    if (opts?.remote && touched.current) return;
    if (!opts?.remote) touched.current = true;
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* yoksay */ }
  }, []);
  const t = useCallback<T>((k, vars) => {
    const row = (DICT as Record<string, readonly string[]>)[k];
    let s = row ? row[IDX[lang]] : (DICT.e_generic[IDX[lang]] as string);
    if (vars) for (const [vk, vv] of Object.entries(vars)) s = s.replaceAll(`{${vk}}`, String(vv));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);

/** Hata kodunu kullanıcı mesajına çevirir; bilinmeyen kodlar genel mesaja düşer. */
export function useErr() {
  const { t } = useI18n();
  return (code: string) => ((DICT as Record<string, unknown>)[code] ? t(code) : /fetch|network/i.test(code) ? t('e_offline') : t('e_generic'));
}

export const fmtDate = (ms: number, l: Locale) => new Date(ms).toLocaleDateString(l === 'tr' ? 'tr-TR' : l === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
