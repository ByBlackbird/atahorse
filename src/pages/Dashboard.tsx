// Panel v4 — "bugün ne yapacağım" tek bakışta: büyük Devam kartı (kurs renginde), Bugün listesi, renkli kurslar.
// Sağ rayda seri, günlük hedef, seviye ve tekrar. Yormayan oyunlaştırma: ceza yok, hedefi öğrenen seçer.
import { useEffect, useMemo, useState } from 'react';
import {
  LuArrowRight, LuBookOpen, LuPlus, LuRepeat, LuRotateCw, LuTrash2, LuGraduationCap, LuSparkles, LuTarget, LuAward,
  LuPlay, LuLayoutGrid, LuTable2, LuChevronRight, LuBrain, LuZap,
} from 'react-icons/lu';
import { Link, useNavigate } from '../lib/router';
import { trpc } from '../lib/trpc';
import { fmtDate, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, Empty, PageLoader, Ring, Spinner, cx } from '../ui/kit';
import DataTable, { type Column } from '../ui/DataTable';
import { useMe } from '../ui/providers';
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
    <ol className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {steps.map((s, i) => {
        const v = view(s);
        const gold = v.tone === 'gold';
        return (
          <li key={`${s.kind}-${i}`} className="anim-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <Link to={v.to} data-k={gold ? undefined : v.tone} className="card-i group flex min-h-16 items-center gap-4 p-3.5 pr-4">
              <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl', gold ? 'bg-gold-soft text-gold-ink' : 'bg-k-soft text-k')}>{v.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold tracking-tight">{v.title}</span>
                <span className={cx('block truncate text-xs font-semibold', s.kind === 'module' && s.reason === 'behind' ? 'text-bad' : 'text-ink-3')}>{v.sub}</span>
              </span>
              <span className="hidden shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold tabular-nums text-ink-2 sm:inline">{t('p_min', { n: s.minutes })}</span>
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
  const body = (
    <>
      <Ring value={c.percent / 100} size={64} stroke={7} color={c.completedAt ? 'var(--c-gold)' : 'var(--k)'}>
        {status === 'generating' || status === 'queued' ? <Spinner className="h-5 w-5" /> : c.completedAt ? <LuAward className="text-xl text-gold" /> : <span className="text-sm font-extrabold tabular-nums">{c.percent}%</span>}
      </Ring>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 font-extrabold leading-snug tracking-tight">{c.title}</span>
        <span className="mt-1 block text-xs font-semibold text-ink-3">
          {ready ? t('modules_n', { a: c.modulesDone, b: c.moduleCount }) : t(`st_${status}`)} · {t(`lv_${c.level}`)}
        </span>
      </span>
    </>
  );
  return (
    <div data-k={courseTone(c.id)} className="group relative">
      {ready ? (
        <Link to={`/kurs/${c.id}`} className="card-i flex items-center gap-4 p-4 pr-10">{body}</Link>
      ) : (
        <div className="card flex items-center gap-4 p-4 pr-10">
          {body}
          {c.status === 'failed' && <button className="btn btn-outline btn-sm" onClick={() => retry.mutate({ courseId: c.id })}><LuRotateCw /> {t('retry')}</button>}
        </div>
      )}
      <button className="btn btn-ghost btn-icon btn-sm reveal-on-hover absolute right-1.5 top-1.5 hover:!text-bad" aria-label={t('delete')}
        onClick={() => { if (window.confirm(t('confirm_delete'))) remove.mutate({ courseId: c.id }); }}><LuTrash2 /></button>
    </div>
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
  const { me } = useMe();
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
  const name = me?.fullName?.split(' ')[0] || me?.username || '';

  return (
    <Shell wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <div>
            <p className="text-sm font-bold text-ink-3">{t('d_hello', { name })}</p>
            {/* Devam kartı — kursun renginde */}
            {cont ? (
              <section data-k={courseTone(cont.id)} className="band-k mt-3 rounded-[24px] p-6 md:p-8" aria-label={t('d_continue')}>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] opacity-85">{t('v4_next_up')}</p>
                <h1 className="h-display mt-2 text-3xl md:text-4xl">{next?.moduleTitle ?? cont.title}</h1>
                <p className="mt-2 font-semibold opacity-90">{cont.title}</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-night/20"><div className="h-full rounded-full bg-surface" style={{ width: `${cont.percent}%` }} /></div>
                  <span className="text-sm font-extrabold tabular-nums">{cont.percent}%</span>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to={next ? `/kurs/${cont.id}/m/${next.moduleIdx}` : `/kurs/${cont.id}`} className="btn btn-xl bg-surface text-k" style={{ ['--edge' as string]: 'var(--k-edge)' }}><LuPlay /> {t('v4_continue')}</Link>
                  <Link to={`/kurs/${cont.id}`} className="btn btn-lg border-surface/40 bg-transparent text-inherit hover:bg-night/10" style={{ ['--edge' as string]: 'transparent' }}>{t('v4_see_path')}</Link>
                </div>
              </section>
            ) : (
              <section className="card mt-3 p-8 text-center">
                <LuSparkles className="mx-auto text-3xl text-accent" aria-hidden />
                <h1 className="h-display mt-3 text-3xl">{t('v4_first_title')}</h1>
                <p className="mx-auto mt-2 max-w-md text-ink-2">{t('v4_first_sub')}</p>
                <Link to="/kurs-olustur" className="btn btn-primary btn-xl mt-6"><LuPlus /> {t('nav_new')}</Link>
              </section>
            )}
          </div>

          {cog.data && !cog.data.profile && (
            <Link to="/profil-testi" className="card-i flex items-center gap-4 border-accent/50 bg-accent-soft p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-xl text-brand-ink"><LuBrain aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block font-extrabold">{t('d_take_test')}</span><span className="block text-sm text-ink-2">{t('d_profile_missing')}</span></span>
              <LuChevronRight className="shrink-0 text-xl text-accent-ink" aria-hidden />
            </Link>
          )}

          <section aria-labelledby="today-h">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="today-h" className="text-xl font-extrabold tracking-tight">{t('p_today')}</h2>
              {steps.length > 0 && <span className="text-sm font-bold text-ink-3">{t('p_min', { n: steps.reduce((a, s) => a + s.minutes, 0) })}</span>}
            </div>
            {path.data ? <Today steps={steps} /> : <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-[4.5rem] animate-pulse rounded-[20px] bg-surface-2" />)}</div>}
          </section>

          <section id="kurslar" className="scroll-mt-20" aria-labelledby="courses-h">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="courses-h" className="text-xl font-extrabold tracking-tight">{t('d_courses')} <span className="ml-1 text-base font-bold text-ink-3">{d.courses.length}</span></h2>
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
              <div className="grid gap-3 sm:grid-cols-2">{d.courses.map((c) => <CourseTile key={c.id} c={c} />)}</div>
            )}
          </section>
        </div>

        {/* Sağ ray */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
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
