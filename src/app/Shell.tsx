import type { ReactNode } from 'react';
import { LuFlame, LuLayoutDashboard, LuPlus, LuRepeat, LuUser, LuLogOut, LuMoon, LuSun, LuShieldCheck, LuZap } from 'react-icons/lu';
import { Link, Navigate, useNavigate, useRouter } from '../lib/router';
import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { useMe, useTheme } from '../ui/providers';
import { Logo, PageLoader, cx } from '../ui/kit';
import { levelFromXp } from '../../shared/engine/gamification';
import { LOCALES, type Locale } from '../../shared/types';

export function LangSelect({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const { me } = useMe();
  const settings = trpc.profile.settings.useMutation();
  return (
    <div className="seg" role="group" aria-label="language">
      {LOCALES.map((l) => (
        <button key={l} aria-pressed={lang === l} className={compact ? '!h-7 !px-2 !text-[11px] uppercase' : 'uppercase'}
          onClick={() => { setLang(l as Locale); if (me) settings.mutate({ locale: l as Locale }); }}>{l}</button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const { me } = useMe();
  const settings = trpc.profile.settings.useMutation();
  const next = theme === 'paper' ? 'ink' : 'paper';
  return (
    <button className="btn btn-ghost btn-icon" title={t('theme_toggle')} aria-label={t('theme_toggle')}
      onClick={() => { setTheme(next); if (me) settings.mutate({ theme: next }); }}>
      {theme === 'paper' ? <LuMoon /> : <LuSun />}
    </button>
  );
}

const NAV = [
  { to: '/panel', key: 'nav_dashboard', icon: <LuLayoutDashboard /> },
  { to: '/kurs-olustur', key: 'nav_new', icon: <LuPlus /> },
  { to: '/tekrar', key: 'nav_review', icon: <LuRepeat /> },
  { to: '/profil', key: 'nav_profile', icon: <LuUser /> },
] as const;

export function Shell({ children, wide, bare }: { children: ReactNode; wide?: boolean; bare?: boolean }) {
  const { t } = useI18n();
  const { me } = useMe();
  const { path } = useRouter();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({ onSuccess: async () => { await utils.invalidate(); navigate('/'); } });
  const lvl = levelFromXp(me?.xp ?? 0);
  return (
    <div className="min-h-dvh bg-bg">
      <header className="no-print sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur">
        <div className={cx('mx-auto flex h-14 items-center gap-3 px-4 md:px-6', wide ? 'max-w-[110rem]' : 'max-w-[76rem]')}>
          <Link to={me ? '/panel' : '/'} aria-label="Atahorse"><Logo className="h-6" /></Link>
          {me && (
            <nav className="ml-4 hidden items-center gap-1 md:flex">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} className={cx('btn btn-ghost btn-sm', path.startsWith(n.to) && '!bg-surface-2 !text-ink')}>{n.icon}{t(n.key)}</Link>
              ))}
              {me.role === 'admin' && <Link to="/yonetim" className={cx('btn btn-ghost btn-sm', path.startsWith('/yonetim') && '!bg-surface-2 !text-ink')}><LuShieldCheck />{t('nav_admin')}</Link>}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {me && (
              <>
                <span className="chip chip-gold hidden sm:inline-flex" title={t('level_n', { n: lvl.level })}><LuZap /> {me.xp} · L{lvl.level}</span>
                <span className="chip hidden sm:inline-flex" title={t('streak_n', { n: me.streak })}><LuFlame className={me.streak ? 'text-gold' : ''} /> {me.streak}</span>
              </>
            )}
            <div className="hidden sm:block"><LangSelect compact /></div>
            <ThemeToggle />
            {me ? (
              <button className="btn btn-ghost btn-icon" onClick={() => logout.mutate()} title={t('nav_logout')} aria-label={t('nav_logout')}><LuLogOut /></button>
            ) : (
              <>
                <Link to="/giris" className="btn btn-ghost btn-sm">{t('nav_login')}</Link>
                <Link to="/kayit" className="btn btn-primary btn-sm">{t('nav_start')}</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className={cx(!bare && 'mx-auto w-full px-4 pb-24 pt-6 md:px-6 md:pb-12 md:pt-8', !bare && (wide ? 'max-w-[110rem]' : 'max-w-[76rem]'))}>{children}</main>
      {me && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-line bg-surface md:hidden" aria-label="mobile">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', path.startsWith(n.to) ? 'text-brand' : 'text-ink-3')}>
              <span className="text-lg">{n.icon}</span>{t(n.key)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { me, loading } = useMe();
  const { path } = useRouter();
  if (loading) return <PageLoader />;
  if (!me) return <Navigate to={`/giris?next=${encodeURIComponent(path)}`} />;
  if (admin && me.role !== 'admin') return <Navigate to="/panel" />;
  return <>{children}</>;
}
