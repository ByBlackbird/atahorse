// Uygulama iskeleti — Apple HIG düzeni:
//  · Oturum açık + geniş ekran: solda kenar çubuğu (bölümler + hızlı eylem + ilerleme), içerik sağda.
//  · Stüdyo/yönetim (wide): kenar çubuğu ikon rayına daralır, içerik tam genişlik alır.
//  · Mobil: üstte yarı saydam araç çubuğu, altta en çok 4 sekmeli sekme çubuğu (44 px hedef, güvenli alan).
//  · Oturum kapalı: yalnız üst araç çubuğu.
import type { ReactNode } from 'react';
import { LuFlame, LuLayoutDashboard, LuPlus, LuRepeat, LuUser, LuLogOut, LuMoon, LuSun, LuShieldCheck, LuZap, LuGlobe } from 'react-icons/lu';
import { Link, Navigate, useNavigate, useRouter } from '../lib/router';
import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { useMe, useTheme } from '../ui/providers';
import { Bar, Logo, PageLoader, cx } from '../ui/kit';
import { levelFromXp } from '../../shared/engine/gamification';
import { LOCALES, type Locale } from '../../shared/types';

const LANG_NAMES: Record<Locale, string> = { tr: 'Türkçe', en: 'English', ru: 'Русский' };

/** Dil seçimi: yerel menü (HIG: kısa seçenek listesi için açılır menü). */
export function LangSelect({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const { me } = useMe();
  const settings = trpc.profile.settings.useMutation();
  return (
    <label className={cx('relative inline-flex items-center', compact ? 'w-auto' : 'w-full')}>
      <span className="sr-only">{t('nav_language')}</span>
      <LuGlobe aria-hidden className="pointer-events-none absolute left-3 text-ink-3" />
      <select
        className={cx('input input-sm cursor-pointer appearance-none !pl-9 font-semibold', compact ? '!w-auto !pr-3 uppercase' : '')}
        value={lang}
        onChange={(e) => { const l = e.target.value as Locale; setLang(l); if (me) settings.mutate({ locale: l }); }}
      >
        {LOCALES.map((l) => <option key={l} value={l}>{compact ? l.toUpperCase() : LANG_NAMES[l as Locale]}</option>)}
      </select>
    </label>
  );
}

export function ThemeToggle({ withLabel }: { withLabel?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const { me } = useMe();
  const settings = trpc.profile.settings.useMutation();
  const next = theme === 'paper' ? 'ink' : 'paper';
  const icon = theme === 'paper' ? <LuMoon /> : <LuSun />;
  const onClick = () => { setTheme(next); if (me) settings.mutate({ theme: next }); };
  if (withLabel) return <button className="side-item w-full" onClick={onClick}>{icon}{t(next === 'ink' ? 'theme_ink' : 'theme_paper')}</button>;
  return <button className="btn btn-ghost btn-icon" title={t('theme_toggle')} aria-label={t('theme_toggle')} onClick={onClick}>{icon}</button>;
}

const NAV = [
  { to: '/panel', key: 'nav_dashboard', icon: <LuLayoutDashboard /> },
  { to: '/kurs-olustur', key: 'nav_new', icon: <LuPlus /> },
  { to: '/tekrar', key: 'nav_review', icon: <LuRepeat /> },
  { to: '/profil', key: 'nav_profile', icon: <LuUser /> },
] as const;

const isCurrent = (path: string, to: string) => path === to || path.startsWith(`${to}/`) || (to === '/panel' && path.startsWith('/kurs/'));

function ProgressCard({ rail }: { rail?: boolean }) {
  const { t } = useI18n();
  const { me } = useMe();
  if (!me) return null;
  const lvl = levelFromXp(me.xp);
  if (rail) {
    return (
      <div className="flex flex-col items-center gap-2 text-xs font-semibold" title={`${t('level_n', { n: lvl.level })} · ${me.xp} XP · ${t('streak_n', { n: me.streak })}`}>
        <span className="chip chip-gold !px-2">L{lvl.level}</span>
        <span className="inline-flex items-center gap-1 text-ink-2"><LuFlame className={me.streak ? 'text-gold' : ''} />{me.streak}</span>
      </div>
    );
  }
  return (
    <div className="card-flat p-3.5">
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold"><LuZap className="text-gold" /> {t('level_n', { n: lvl.level })}</span>
        <span className="inline-flex items-center gap-1 text-ink-2" title={t('streak_n', { n: me.streak })}><LuFlame className={me.streak ? 'text-gold' : ''} /> {me.streak}</span>
      </div>
      <Bar value={lvl.progress} className="mt-2.5" />
      <p className="mt-2 text-xs text-ink-3">{t('nav_level_to', { n: Math.max(0, lvl.next - me.xp) })}</p>
    </div>
  );
}

function Sidebar({ rail }: { rail: boolean }) {
  const { t } = useI18n();
  const { me } = useMe();
  const { path } = useRouter();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({ onSuccess: async () => { await utils.invalidate(); navigate('/'); } });
  if (!me) return null;
  const items = [...NAV.filter((n) => rail || n.to !== '/kurs-olustur'), ...(me.role === 'admin' ? [{ to: '/yonetim', key: 'nav_admin', icon: <LuShieldCheck /> } as const] : [])];
  return (
    <aside className={cx('no-print fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface lg:flex', rail ? 'w-[76px] items-center px-2 py-4' : 'w-[264px] px-3 py-5')} aria-label={t('nav_menu')}>
      <Link to="/panel" aria-label="Atahorse" className={cx('flex min-h-11 items-center', rail ? 'justify-center' : 'px-3')}>
        {rail ? <img src="/assets/favicon.png" alt="" className="h-9 w-9 rounded-[10px]" /> : <Logo className="h-7" />}
      </Link>
      {!rail && (
        <Link to="/kurs-olustur" className="btn btn-primary mt-6 w-full"><LuPlus /> {t('nav_new')}</Link>
      )}
      <nav className={cx('flex flex-col gap-1', rail ? 'mt-6 w-full' : 'mt-6')}>
        {items.map((n) => {
          const cur = isCurrent(path, n.to);
          return (
            <Link key={n.to} to={n.to} aria-current={cur ? 'page' : undefined} title={rail ? t(n.key) : undefined}
              className={cx('side-item', rail && 'justify-center !px-0')}>
              {n.icon}{!rail && <span>{t(n.key)}</span>}{rail && <span className="sr-only">{t(n.key)}</span>}
            </Link>
          );
        })}
      </nav>
      <div className={cx('mt-auto flex flex-col gap-2', rail ? 'w-full items-center' : '')}>
        <ProgressCard rail={rail} />
        {rail ? (
          <>
            <ThemeToggle />
            <button className="btn btn-ghost btn-icon" onClick={() => logout.mutate()} title={t('nav_logout')} aria-label={t('nav_logout')}><LuLogOut /></button>
          </>
        ) : (
          <>
            <LangSelect />
            <ThemeToggle withLabel />
            <button className="side-item w-full" onClick={() => logout.mutate()}><LuLogOut /> {t('nav_logout')}</button>
          </>
        )}
      </div>
    </aside>
  );
}

function TabBar() {
  const { t } = useI18n();
  const { path } = useRouter();
  return (
    <nav className="material no-print fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-line lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label={t('nav_menu')}>
      {NAV.map((n) => {
        const cur = isCurrent(path, n.to);
        return (
          <Link key={n.to} to={n.to} aria-current={cur ? 'page' : undefined}
            className={cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors', cur ? 'text-brand' : 'text-ink-3')}>
            <span className="text-[22px]">{n.icon}</span>{t(n.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({ children, wide, bare, headerNav }: { children: ReactNode; wide?: boolean; bare?: boolean; headerNav?: ReactNode }) {
  const { t } = useI18n();
  const { me } = useMe();
  const appLayout = !!me && !bare;
  const rail = appLayout && !!wide;
  const lvl = levelFromXp(me?.xp ?? 0);
  const maxW = wide ? 'max-w-[110rem]' : 'max-w-[76rem]';
  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="skip-link">{t('nav_skip')}</a>
      {appLayout && <Sidebar rail={rail} />}
      <div className={cx(appLayout && (rail ? 'lg:pl-[76px]' : 'lg:pl-[264px]'))}>
        <header className={cx('material no-print sticky top-0 z-30 border-b border-line', appLayout && 'lg:hidden')} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className={cx('mx-auto flex h-14 items-center gap-2 px-4 md:px-6', maxW)}>
            <Link to={me ? '/panel' : '/'} aria-label="Atahorse" className="flex min-h-11 items-center"><Logo className="h-6" /></Link>
            {headerNav && <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label={t('nav_menu')}>{headerNav}</nav>}
            <div className="ml-auto flex items-center gap-1.5">
              {me && !bare && (
                <>
                  <span className="chip chip-gold" title={t('level_n', { n: lvl.level })}><LuZap /> {me.xp} · L{lvl.level}</span>
                  <span className="chip hidden sm:inline-flex" title={t('streak_n', { n: me.streak })}><LuFlame className={me.streak ? 'text-gold' : ''} /> {me.streak}</span>
                </>
              )}
              {!me && <div className="hidden sm:block"><LangSelect compact /></div>}
              <ThemeToggle />
              {me ? (
                bare ? <Link to="/panel" className="btn btn-primary btn-sm">{t('nav_dashboard')}</Link> : null
              ) : (
                <>
                  <Link to="/giris" className="btn btn-ghost btn-sm">{t('nav_login')}</Link>
                  <Link to="/kayit" className="btn btn-primary btn-sm">{t('nav_start')}</Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className={cx('outline-none', !bare && 'mx-auto w-full px-4 pt-6 md:px-6 md:pt-8 lg:pt-10', !bare && maxW, !bare && (appLayout ? 'pb-28 lg:pb-12' : 'pb-16'))}>{children}</main>
      </div>
      {appLayout && <TabBar />}
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
