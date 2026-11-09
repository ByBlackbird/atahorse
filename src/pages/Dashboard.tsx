// Panel v5 — Luma/Nuton LMS düzeni: lacivert "Kaldığın yer" bandı → gerçek verili istatistik kutuları →
// Bugün listesi (müfredat satırları) → renk başlıklı kurs kartları. Sağ rayda seri, günlük hedef, seviye, tekrar.
// Yormayan oyunlaştırma: ceza yok, hedefi öğrenen seçer. Rakam uydurulmaz: her kutu sunucudaki veriden gelir.
import { useEffect, useMemo, useState } from 'react';
import {
  LuArrowRight, LuBookOpen, LuPlus, LuRepeat, LuRotateCw, LuTrash2, LuGraduationCap, LuSparkles, LuTarget, LuAward,
  LuPlay, LuLayoutGrid, LuTable2, LuChevronRight, LuBrain, LuZap, LuFlame, LuLibrary, LuCircleCheck,
} from 'react-icons/lu';
import { Link, useNavigate } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, Empty, PageHero, PageLoader, Ring, Spinner, cx } from '../ui/kit';
import DataTable, { type Column } from '../ui/DataTable';
import { StreakCard, DailyGoalCard } from '../ui/learn';
import { courseTone } from '../lib/brand';
import type { RouterOutputs } from '../lib/trpc';

type Dash = RouterOutputs['profile']['dashboard'];
type Course = Dash['courses'][number];
type Step = RouterOutputs['learn']['path']['steps'][number];

const VIEW_KEY = 'ah:dash:view';
const readView = (): 'cards' | 'table' => { try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'; } catch { return 'cards'; } };
const statusOf = (c: Course) => (c.completedAt ? 'completed' : c.status);

/** Bugün: tekrar → zayıf nokta → plana göre modül → final. Her satır doğrudan hedefe gider. */
function Today({ steps }: { steps: Step[] }) {
  const { t } = useI18n();
  const view = (s: Step) => {
    switch (s.kind) {
      case 'review': return { to: '/tekrar', icon: <LuRepeat />, title: t('p_step_review'), sub: t('p_step_review_d', { n: s.due }), tone: 'gold' };
      case 'recap': return { to: `/tekrar?kurs=${s.courseId}&mod=zayif`, icon: <LuTarget />, title: t('p_step_recap'), sub: t('p_step_recap_d', { title: s.title, n: s.weak }), tone: 'gold' };
      case 'module': return { to: `/kurs/${s.courseId}/m/${s.moduleIdx}`, icon: <LuBookOpen />, title: s.moduleTitle, sub: `${s.title} · ${t(`p_reason_${s.reason}`)}`, tone: String(courseTone(s.courseId)) };
      case 'final': return { to: `/kurs/${s.courseId}/final`, icon: <LuAward />, title: t('p_step_final'), sub: s.title, tone: 'gold' };
    }
  };
  if (!steps.length) return <p className="card p-5 text-sm text-ink-2">{t('p_today_empty')}</p>;
  return (
    <ol className="lesson-list">
      {steps.map((s, i) => {
        const v = view(s);
        const gold = v.tone === 'gold';
        return (
          <li key={`${s.kind}-${i}`}>
            <Link to={v.to} data-k={gold ? undefined : v.tone} className="lesson-row group" data-state={i === 0 ? 'current' : 'open'}>
              <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg', gold ? 'bg-gold-soft text-gold-ink' : 'bg-k text-k-on')}>{v.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{v.title}</span>
                <span className={cx('block truncate text-xs font-semibold', s.kind === 'module' && s.reason === 'behind' ? 'text-bad' : 'text-ink-3')}>{v.sub}</span>
              </span>
              <span className="hidden shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-ink-2 sm:inline">{t('p_min', { n: s.minutes })}</span>
              <LuChevronRight className="shrink-0 text-xl text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function CourseTile({ c }: { c: Course }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const retry = trpc.course.retry.useMutation({ onSuccess: () => utils.profile.dashboard.invalidate() });
  const remove = trpc.course.remove.useMutation({ onSuccess: () => utils.profile.dashboard.invalidate() });
  const status = statusOf(c);
  const ready = c.status === 'ready';
  const busy = status === 'generating' || status === 'queued';
  const inner = (
    <>
      <div className="bg-k flex h-24 items-start justify-between p-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface/20 text-xl" aria-hidden>
          {busy ? <Spinner className="h-5 w-5" /> : c.completedAt ? <LuAward /> : <LuBookOpen />}
        </span>
        <span className="rounded-full bg-surface/20 px-2.5 py-1 text-xs font-bold tabular-nums">{ready ? `${c.percent}%` : t(`st_${status}`)}</span>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 min-h-[2.75rem] font-semibold leading-snug">{c.title}</p>
        <p className="mt-1 text-xs text-ink-3">{ready ? t('modules_n', { a: c.modulesDone, b: c.moduleCount }) : t(`st_${status}`)} · {t(`lv_${c.level}`)}</p>
        <Bar value={c.percent / 100} className="mt-3" color={c.completedAt ? 'bg-gold' : 'bg-k'} />
        {c.status === 'failed' && <button className="btn btn-outline btn-sm mt-3" onClick={() => retry.mutate({ courseId: c.id })}><LuRotateCw /> {t('retry')}</button>}
      </div>
    </>
  );
  return (
    <li data-k={courseTone(c.id)} className="group relative">
      {ready ? <Link to={`/kurs/${c.id}`} className="card-i block h-full overflow-hidden">{inner}</Link> : <div className="card h-full overflow-hidden">{inner}</div>}
      <button className="btn btn-icon btn-sm reveal-on-hover absolute right-14 top-3 bg-surface/20 text-k-on hover:!bg-bad hover:!text-surface" aria-label={t('delete')}
        onClick={() => { if (window.confirm(t('confirm_delete'))) remove.mutate({ courseId: c.id }); }}><LuTrash2 /></button>
    </li>
  );
}

function CourseTable({ rows }: { rows: Course[] }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const cols: Column<Course>[] = useMemo(() => [
    { key: 'title', header: t('dt_course'), sort: (c) => c.title, cell: (c) => <span className="flex items-center gap-2.5 font-bold" data-k={courseTone(c.id)}><span className="bg-k h-3 w-3 shrink-0 rounded-full" />{c.title}</span> },
    { key: 'status', header: t('dt_status'), sort: (c) => statusOf(c), cell: (c) => <span className={cx('chip', !!c.completedAt && 'chip-gold')}>{t(`st_${statusOf(c)}`)}</span> },
    { key: 'progress', header: t('s_progress'), sort: (c) => c.percent, align: 'right', cell: (c) => (
      <span className="inline-flex w-36 items-center gap-2"><Bar value={c.percent / 100} /><span className="w-9 text-right text-xs font-bold tabular-nums text-ink-2">{c.percent}%</span></span>
    ) },
    { key: 'level', header: t('dt_level'), sort: (c) => c.level, hideSm: true, cell: (c) => <span className="text-ink-2">{t(`lv_${c.level}`)}</span> },
    { key: 'created', header: t('dt_created'), sort: (c) => c.createdAt, align: 'right', hideSm: true, cell: (c) => <span className="text-xs tabular-nums text-ink-3">{fmtDate(c.createdAt, lang)}</span> },
  ], [t, lang]);
  return <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} search={(c) => `${c.title} ${c.topic}`} initialSort={{ key: 'created', dir: 'desc' }} onOpen={(c) => c.status === 'ready' && navigate(`/kurs/${c.id}`)} />;
}

export default function Dashboard() {
  const { t } = useI18n();
  const dash = trpc.profile.dashboard.useQuery(undefined, { refetchInterval: (q) => (q.state.data?.courses.some((c) => c.status === 'queued' || c.status === 'generating') ? 2000 : false) });
  const path = trpc.learn.path.useQuery();
  const cog = trpc.profile.cognitive.useQuery();
  const [view, setView] = useState<'cards' | 'table'>(readView);
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch { /* gizli pencere */ } }, [view]);
  useEffect(() => { if (dash.data && window.location.hash === '#kurslar') document.getElementById('kurslar')?.scrollIntoView({ behavior: 'smooth' }); }, [dash.data]);
  if (!dash.data) return <Shell wide><PageLoader /></Shell>;
  const d: Dash = dash.data;

  const steps = path.data?.steps ?? [];
  const cont = d.continueId ? d.courses.find((c) => c.id === d.continueId) : undefined;
  const next = steps.find((s) => s.kind === 'module' && cont && s.courseId === cont.id) as Extract<Step, { kind: 'module' }> | undefined;

  const modulesDone = d.courses.reduce((a, c) => a + c.modulesDone, 0);
  const stats = [
    { label: t('v5_st_courses'), value: d.courses.length, icon: <LuLibrary />, cls: 'bg-brand-soft text-brand' },
    { label: t('v5_st_modules'), value: modulesDone, icon: <LuCircleCheck />, cls: 'bg-gold-soft text-gold-ink' },
    { label: t('v5_st_streak'), value: d.streak, icon: <LuFlame />, cls: 'bg-gold-soft text-gold-ink' },
    { label: t('v5_st_xp'), value: d.xp.toLocaleString(), icon: <LuZap />, cls: 'bg-gold-soft text-gold-ink' },
  ];

  return (
    <Shell>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          {/* Kaldığın yer — lacivert bant */}
          {cont ? (
            <PageHero
              eyebrow={t('v5_d_eyebrow')}
              title={next?.moduleTitle ?? cont.title}
              sub={cont.title}
              actions={<>
                <Link to={next ? `/kurs/${cont.id}/m/${next.moduleIdx}` : `/kurs/${cont.id}`} className="btn btn-primary btn-lg"><LuPlay /> {t('v4_continue')}</Link>
                <Link to={`/kurs/${cont.id}`} className="btn btn-lg border border-on-night/25 bg-transparent text-on-night hover:bg-on-night/10">{t('v4_see_path')}</Link>
              </>}
              aside={<div className="hidden sm:block"><Ring value={cont.percent / 100} size={120} stroke={10} color="var(--c-on-night-gold)"><span className="font-display text-3xl font-bold text-on-night">{cont.percent}%</span></Ring></div>}
            />
          ) : (
            <PageHero eyebrow={t('v4_next_up')} title={t('v4_first_title')} sub={t('v4_first_sub')} icon={<LuSparkles />}
              actions={<Link to="/kurs-olustur" className="btn btn-primary btn-lg"><LuPlus /> {t('nav_new')}</Link>} />
          )}

          {/* Gerçek verili istatistik kutuları */}
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <li key={s.label} className="stat-tile">
                <span className={cx('stat-ic', s.cls)} aria-hidden>{s.icon}</span>
                <span className="min-w-0"><span className="block font-display text-2xl font-bold tabular-nums leading-none">{s.value}</span><span className="mt-1 block truncate text-xs font-semibold text-ink-3">{s.label}</span></span>
              </li>
            ))}
          </ul>

          {cog.data && !cog.data.profile && (
            <Link to="/profil-testi" className="card-i flex items-center gap-4 border-accent/50 bg-accent-soft p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-xl text-brand-ink"><LuBrain aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block font-extrabold">{t('d_take_test')}</span><span className="block text-sm text-ink-2">{t('d_profile_missing')}</span></span>
              <LuChevronRight className="shrink-0 text-xl text-accent-ink" aria-hidden />
            </Link>
          )}

          <section aria-labelledby="today-h">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><h2 id="today-h" className="h-display text-2xl">{t('p_today')}</h2><p className="text-sm text-ink-3">{t('v5_today_sub')}</p></div>
              {steps.length > 0 && <span className="text-sm font-bold text-ink-3">{t('p_min', { n: steps.reduce((a, s) => a + s.minutes, 0) })}</span>}
            </div>
            {path.data ? <Today steps={steps} /> : <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-[4.5rem] animate-pulse rounded-[20px] bg-surface-2" />)}</div>}
          </section>

          <section id="kurslar" className="scroll-mt-20" aria-labelledby="courses-h">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="courses-h" className="h-display text-2xl">{t('d_courses')} <span className="ml-1 text-base font-bold text-ink-3">{d.courses.length}</span></h2>
              <div className="flex items-center gap-2">
                {d.courses.length > 0 && (
                  <div className="seg" role="tablist" aria-label={t('d_view')}>
                    <button role="tab" aria-pressed={view === 'cards'} onClick={() => setView('cards')} aria-label={t('d_view_cards')}><LuLayoutGrid /></button>
                    <button role="tab" aria-pressed={view === 'table'} onClick={() => setView('table')} aria-label={t('d_view_table')}><LuTable2 /></button>
                  </div>
                )}
                <Link to="/kurs-olustur" className="btn btn-outline btn-sm"><LuPlus /> {t('nav_new')}</Link>
              </div>
            </div>
            {d.courses.length === 0 ? (
              <Empty icon={<LuGraduationCap />} title={t('d_empty_t')} body={t('d_empty_s')} />
            ) : view === 'table' ? (
              <CourseTable rows={d.courses} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{d.courses.map((c) => <CourseTile key={c.id} c={c} />)}</ul>
            )}
          </section>
        </div>

        {/* Sağ ray */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <StreakCard streak={d.streak} longest={d.longestStreak} days={d.heatmap} />
          <DailyGoalCard goal={d.dailyGoal} days={d.heatmap} />
          <Link to="/profil" className="card-i flex items-center gap-4 p-5">
            <Ring value={d.level.progress} size={60} stroke={7}><span className="text-lg font-extrabold">{d.level.level}</span></Ring>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{t('level_n', { n: d.level.level })}</span>
              <span className="block text-sm font-semibold text-ink-3"><LuZap className="mr-1 inline text-gold" aria-hidden />{d.xp.toLocaleString()} XP · {t('v4_to_next', { n: Math.max(0, d.level.next - d.xp) })}</span>
            </span>
          </Link>
          <Link to="/tekrar" className="card-i flex items-center gap-4 p-5">
            <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl', d.dueReviews ? 'bg-gold-soft text-gold-ink' : 'bg-surface-2 text-ink-3')}><LuRepeat aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{t('nav_review')}</span>
              <span className="block text-sm text-ink-3">{d.dueReviews ? t('d_review_n', { n: d.dueReviews }) : t('d_review_none')}</span>
            </span>
            {d.dueReviews > 0 && <span className="rounded-full bg-gold px-2.5 py-0.5 text-sm font-extrabold tabular-nums text-on-gold">{d.dueReviews}</span>}
          </Link>
          <Link to="/kurs-olustur" className="card-i flex items-center justify-between p-5 font-extrabold">{t('nav_new')} <LuArrowRight className="text-accent" aria-hidden /></Link>
        </aside>
      </div>
    </Shell>
  );
}
