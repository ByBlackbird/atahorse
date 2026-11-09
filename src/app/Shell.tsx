// Uygulama iskeleti — Apple HIG düzeni:
//  · Oturum açık + geniş ekran: solda kenar çubuğu — kategori başlığı → ana öğe → girintili alt modül (kurslar doğrudan menüde).
//  · Stüdyo/yönetim (wide): kenar çubuğu ikon rayına daralır, içerik tam genişlik alır.
//  · Mobil: üstte yarı saydam araç çubuğu, altta en çok 4 sekmeli sekme çubuğu (44 px hedef, güvenli alan).
//  · Oturum kapalı: yalnız üst araç çubuğu.
import type { ReactNode } from 'react';
import { LuFlame, LuLayoutDashboard, LuPlus, LuRepeat, LuUser, LuLogOut, LuMoon, LuSun, LuShieldCheck, LuZap, LuGlobe, LuCrown, LuLibrary } from 'react-icons/lu';
import { openUpgrade } from '../lib/upgrade-bus';
import { courseTone } from '../lib/brand';
import { Link, Navigate, useNavigate, useRouter } from '../lib/router';
import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { useMe, useTheme } from '../ui/providers';
import { Bar, BrandLockup, Logo, Mark, PageLoader, cx } from '../ui/kit';
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

type Item = { to: string; key: string; icon: React.ReactNode; badge?: number; onClick?: () => void };

/** Kurslarım: hazır kurslar doğrudan menüde (katman katman gezinme yok); ilerleme halkasıyla. */
function CourseLinks({ path }: { path: string }) {
  const { t } = useI18n();
  const dash = trpc.profile.dashboard.useQuery(undefined, { staleTime: 30_000 });
  const list = (dash.data?.courses ?? []).filter((c) => c.status === 'ready');
  const top = [...list].sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt)).slice(0, 6);
  if (!dash.data) return <div className="ml-2 mt-1 h-16 animate-pulse rounded-lg bg-surface-2" aria-hidden />;
  if (!list.length) return <p className="ml-2 px-3 py-2 text-[13px] text-ink-3">{t('nav_no_courses')}</p>;
  return (
    <div className="mt-0.5 flex flex-col">
      {top.map((c) => {
        const cur = path === `/kurs/${c.id}` || path.startsWith(`/kurs/${c.id}/`);
        return (
          <Link key={c.id} to={`/kurs/${c.id}`} aria-current={cur ? 'page' : undefined} className="side-sub" title={c.title} data-k={courseTone(c.id)}>
            <span className="bg-k h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{c.title}</span>
            <span className={cx('shrink-0 text-[11px] tabular-nums', c.completedAt ? 'text-gold-ink' : 'text-ink-3')}>{c.completedAt ? '✓' : `${c.percent}%`}</span>
          </Link>
        );
      })}
      {list.length > top.length && <Link to="/panel#kurslar" className="side-sub !text-accent-ink">{t('nav_all_courses', { n: list.length })}</Link>}
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
  const dash = trpc.profile.dashboard.useQuery(undefined, { staleTime: 30_000, enabled: !!me });
  if (!me) return null;
  const premium = me.plan === 'premium' || me.role === 'admin';
  // Kategori → öğe hiyerarşisi (rail modunda başlıklar gizlenir, ikonlar kalır)
  const groups: { key: string; items: Item[]; courses?: boolean }[] = [
    { key: 'nav_g_learn', items: [
      { to: '/panel', key: 'nav_dashboard', icon: <LuLayoutDashboard /> },
      { to: '/tekrar', key: 'nav_review', icon: <LuRepeat />, badge: dash.data?.dueReviews || undefined },
      ...(rail ? [{ to: '/kurs-olustur', key: 'nav_new', icon: <LuPlus /> }] : []),
    ] },
    { key: 'nav_g_courses', items: [], courses: true },
    { key: 'nav_g_account', items: [
      { to: '/profil', key: 'nav_profile', icon: <LuUser /> },
      ...(!premium ? [{ to: '/premium', key: 'nav_premium', icon: <LuCrown />, onClick: () => openUpgrade('manual') }] : []),
      ...(me.role === 'admin' ? [{ to: '/yonetim', key: 'nav_admin', icon: <LuShieldCheck /> }] : []),
    ] },
  ];
  const link = (n: Item) => {
    const cur = isCurrent(path, n.to);
    const body = <>{n.icon}{!rail && <span className="flex-1">{t(n.key)}</span>}{rail && <span className="sr-only">{t(n.key)}</span>}
      {n.badge ? <span className={cx('grid min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-bold tabular-nums text-on-gold', rail && 'absolute right-1.5 top-1.5 min-w-4 !px-1 text-[10px]')}>{n.badge}</span> : null}</>;
    if (n.onClick) return <button key={n.to} type="button" onClick={n.onClick} title={rail ? t(n.key) : undefined} className={cx('side-item w-full text-left', rail && 'justify-center !px-0')}>{body}</button>;
    return <Link key={n.to} to={n.to} aria-current={cur ? 'page' : undefined} title={rail ? t(n.key) : undefined} className={cx('side-item', rail && 'justify-center !px-0')}>{body}</Link>;
  };
  return (
    <aside className={cx('sidebar no-print fixed inset-y-0 left-0 z-40 hidden flex-col lg:flex', rail ? 'w-[76px] items-center px-2 py-4' : 'w-[272px] px-3 py-5')} aria-label={t('nav_menu')}>
      <Link to="/panel" aria-label="Atahorse" className={cx('flex min-h-11 items-center transition-opacity duration-200 hover:opacity-80', rail ? 'justify-center' : 'px-3')}>
        {rail ? <Mark className="h-9" variant="dark" /> : <BrandLockup variant="dark" />}
      </Link>
      {!rail && <Link to="/kurs-olustur" className="btn mt-6 w-full border border-on-night/25 bg-transparent text-on-night hover:bg-on-night/10"><LuPlus /> {t('nav_new')}</Link>}
      <nav className={cx('flex flex-col overflow-y-auto scrollbar-thin', rail ? 'mt-6 w-full gap-1' : 'mt-1 -mx-1 px-1 pb-4')}>
        {groups.map((g) => (
          <div key={g.key} className={cx('flex flex-col', !rail && 'gap-0.5')} role="group" aria-label={t(g.key)}>
            {!rail && <p className="side-group"><span>{t(g.key)}</span>{g.courses && dash.data ? <span className="side-group-n">{dash.data.courses.filter((c) => c.status === 'ready').length}</span> : null}</p>}
            {g.items.map(link)}
            {g.courses && !rail && <CourseLinks path={path} />}
            {g.courses && rail && <Link to="/panel#kurslar" title={t(g.key)} className="side-item justify-center !px-0"><LuLibrary /><span className="sr-only">{t(g.key)}</span></Link>}
          </div>
        ))}
      </nav>
      <div className={cx('mt-auto flex flex-col gap-2 pt-3', rail ? 'w-full items-center' : 'border-t border-line')}>
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

/** Masaüstü üst çubuk (v5): tarih + selamlama solda; seri, XP, tema ve profil sağda. Stüdyo (ray) modunda gizli. */
function TopBar() {
  const { t, lang } = useI18n();
  const { me } = useMe();
  if (!me) return null;
  const lvl = levelFromXp(me.xp);
  const name = me.fullName?.split(' ')[0] || me.username;
  const initials = (me.fullName || me.username).split(' ').map((w) => w[0]).slice(0, 2).join('').toLocaleUpperCase(lang);
  const today = new Date().toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="material no-print sticky top-0 z-30 hidden border-b border-line lg:block">
      <div className="mx-auto flex h-16 max-w-[76rem] items-center gap-3 px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold capitalize text-ink-3">{today}</p>
          <p className="truncate font-display text-lg font-bold leading-tight">{t('d_hello', { name })}</p>
        </div>
        <span className="chip" title={t('streak_n', { n: me.streak })}><LuFlame className={me.streak ? 'text-gold' : ''} /> {t('streak_n', { n: me.streak })}</span>
        <span className="chip chip-gold" title={t('level_n', { n: lvl.level })}><LuZap /> {me.xp} XP · L{lvl.level}</span>
        <ThemeToggle />
        <Link to="/profil" className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-surface-2" aria-label={t('nav_profile')}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{initials}</span>
          <span className="hidden text-sm font-semibold xl:inline">{me.fullName || me.username}</span>
        </Link>
      </div>
    </div>
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
      <div className={cx(appLayout && (rail ? 'lg:pl-[76px]' : 'lg:pl-[272px]'))}>
        <header className={cx('material no-print sticky top-0 z-30 border-b border-line', appLayout && 'lg:hidden')} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className={cx('mx-auto flex h-14 items-center gap-2 px-4 md:px-6', maxW)}>
            <Link to={me ? '/panel' : '/'} aria-label="Atahorse" className="flex min-h-11 items-center">{me ? <BrandLockup className="[&_span]:text-lg [&_img]:h-7" /> : <Logo className="h-7" />}</Link>
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
        {appLayout && !rail && <TopBar />}
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
