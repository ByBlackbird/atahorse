// Uygulama bağlamları: tema, oturum, bildirim (XP / rozet / seviye).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LuAward, LuCircleCheck, LuCircleAlert, LuZap } from 'react-icons/lu';
import { applyTheme, storedTheme, type Theme } from '../lib/theme';
import { trpc, type RouterOutputs } from '../lib/trpc';
import { useI18n } from '../i18n/index';

/* ---------------- tema ---------------- */
type SetTheme = (t: Theme, opts?: { remote?: boolean }) => void;
const ThemeCtx = createContext<{ theme: Theme; setTheme: SetTheme }>({ theme: 'paper', setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, set] = useState<Theme>(storedTheme);
  const touched = useRef(false);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const setTheme = useCallback<SetTheme>((t, opts) => {
    if (opts?.remote && touched.current) return;
    if (!opts?.remote) touched.current = true;
    set(t);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/* ---------------- oturum ---------------- */
export type Me = NonNullable<RouterOutputs['auth']['me']>;
export function useMe() {
  const q = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  return { me: q.data ?? null, loading: q.isLoading, refetch: q.refetch };
}

/** Oturum açıldığında sunucudaki dil/tema tercihini istemciye uygula (bir kez). */
export function SessionSync() {
  const { me } = useMe();
  const { setLang } = useI18n();
  const { setTheme } = useTheme();
  const done = useRef<number | null>(null);
  useEffect(() => {
    if (me && done.current !== me.id) {
      done.current = me.id;
      setLang(me.locale, { remote: true });
      setTheme(me.theme, { remote: true });
    }
  }, [me, setLang, setTheme]);
  return null;
}

/* ---------------- bildirim ---------------- */
type Kind = 'xp' | 'badge' | 'ok' | 'error' | 'level';
interface Toast { id: number; kind: Kind; text: string }
interface XpPayload { gained: number; total: number; level: { level: number }; badges: { key: string; name: string }[] }
const ToastCtx = createContext<{ push: (kind: Kind, text: string) => void; xp: (r: XpPayload | null | undefined, prevLevel?: number) => void }>({ push: () => {}, xp: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'badge' || kind === 'level' ? 4200 : 2800);
  }, []);
  const xp = useCallback((r: XpPayload | null | undefined, prevLevel?: number) => {
    if (!r) return;
    if (r.gained > 0) push('xp', t('toast_xp', { n: r.gained }));
    if (prevLevel && r.level.level > prevLevel) push('level', t('toast_level', { n: r.level.level }));
    for (const b of r.badges) push('badge', t('toast_badge', { name: b.name }));
    void utils.profile.dashboard.invalidate();
    void utils.auth.me.invalidate();
  }, [push, t, utils]);
  const value = useMemo(() => ({ push, xp }), [push, xp]);
  const icon = { xp: <LuZap />, badge: <LuAward />, level: <LuAward />, ok: <LuCircleCheck />, error: <LuCircleAlert /> };
  const tone = { xp: 'border-gold/50 text-gold-ink bg-gold-soft', badge: 'border-gold/50 text-gold-ink bg-gold-soft', level: 'border-brand/40 text-brand bg-brand-soft', ok: 'border-ok/40 text-ok bg-ok-soft', error: 'border-bad/40 text-bad bg-bad-soft' };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-[100] flex w-72 flex-col items-end gap-2" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className={`anim-pop pointer-events-auto inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold ${tone[x.kind]}`}>
            {icon[x.kind]} {x.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
