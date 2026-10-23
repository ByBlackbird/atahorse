import { LuArrowRight, LuBookOpen, LuFlame, LuPlus, LuRepeat, LuRotateCw, LuTrash2, LuGraduationCap, LuSparkles } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, Empty, PageLoader, Ring, Spinner, cx } from '../ui/kit';
import { useMe } from '../ui/providers';
import type { RouterOutputs } from '../lib/trpc';

type Course = RouterOutputs['profile']['dashboard']['courses'][number];

function Heatmap({ days }: { days: { day: string; xp: number; minutes: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.xp + d.minutes));
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-label="activity">
      {days.map((d) => {
        const v = (d.xp + d.minutes) / max;
        return <div key={d.day} title={`${d.day} · ${d.xp} XP · ${d.minutes} dk`} className="aspect-square rounded-[4px] border border-line"
          style={{ background: v === 0 ? 'var(--c-surface-2)' : `color-mix(in srgb, var(--c-gold) ${Math.round(25 + v * 75)}%, var(--c-surface))` }} />;
      })}
    </div>
  );
}

function CourseCard({ c }: { c: Course }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const retry = trpc.course.retry.useMutation({ onSuccess: () => utils.profile.dashboard.invalidate() });
  const remove = trpc.course.remove.useMutation({ onSuccess: () => utils.profile.dashboard.invalidate() });
  const status = c.completedAt ? 'completed' : c.status;
  const tone = { completed: 'chip-gold', ready: 'chip-brand', queued: '', generating: '', failed: 'text-bad' }[status] ?? '';
  return (
    <article className="card group flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={cx('chip', tone)}>{status === 'generating' || status === 'queued' ? <Spinner className="h-3 w-3" /> : null}{t(`st_${status}`)}</span>
        <button className="btn btn-ghost btn-icon -mr-2 -mt-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={t('delete')}
          onClick={() => { if (window.confirm(t('confirm_delete'))) remove.mutate({ courseId: c.id }); }}><LuTrash2 /></button>
      </div>
      <h3 className="mt-3 line-clamp-2 font-semibold leading-snug">{c.title}</h3>
      <p className="mt-1 text-xs text-ink-3">{t(`lv_${c.level}`)} · {c.locale.toUpperCase()}{c.source === 'meb' ? ' · MEB' : ''}</p>
      <div className="mt-auto pt-5">
        {c.status === 'ready' && (
          <>
            <div className="mb-2 flex justify-between text-xs text-ink-3"><span>{t('modules_n', { a: c.modulesDone, b: c.moduleCount })}</span><span>{c.percent}%</span></div>
            <Bar value={c.percent / 100} />
            <Link to={`/kurs/${c.id}`} className="btn btn-outline btn-sm mt-4 w-full">{c.completedAt ? t('s_view_cert') : t('continue')} <LuArrowRight /></Link>
          </>
        )}
        {c.status === 'failed' && <button className="btn btn-outline btn-sm w-full" onClick={() => retry.mutate({ courseId: c.id })}><LuRotateCw /> {t('retry')}</button>}
      </div>
    </article>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const { me } = useMe();
  const dash = trpc.profile.dashboard.useQuery(undefined, { refetchInterval: (q) => (q.state.data?.courses.some((c) => c.status === 'queued' || c.status === 'generating') ? 2000 : false) });
  const cog = trpc.profile.cognitive.useQuery();
  if (!dash.data) return <Shell><PageLoader /></Shell>;
  const d = dash.data;
  const cont = d.courses.find((c) => c.id === d.continueId);
  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl">{t('d_hello', { name: me?.fullName?.split(' ')[0] || me?.username || '' })}</h1>
          <p className="mt-1 text-ink-2">{t('d_sub')}</p>
        </div>
        <Link to="/kurs-olustur" className="btn btn-primary"><LuPlus /> {t('nav_new')}</Link>
      </div>

      {cog.data && !cog.data.profile && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand-soft p-4">
          <p className="text-sm"><LuSparkles className="mr-1.5 inline text-brand" />{t('d_profile_missing')}</p>
          <Link to="/profil-testi" className="btn btn-primary btn-sm">{t('d_take_test')}</Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
        <div className="card flex items-center gap-5 p-5">
          <Ring value={d.level.progress} size={84} stroke={6}>
            <div><div className="text-[10px] uppercase tracking-wider text-ink-3">Lv</div><div className="text-xl font-semibold">{d.level.level}</div></div>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-semibold tabular-nums">{d.xp} <span className="text-sm font-normal text-ink-3">XP</span></p>
            <p className="text-sm text-ink-3">{d.level.next - d.xp} XP → {t('level_n', { n: d.level.level + 1 })}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm"><LuFlame className={d.streak ? 'text-gold' : 'text-ink-3'} /> {t('streak_n', { n: d.streak })}</p>
          </div>
        </div>
        <div className="card flex flex-col p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><LuRepeat className="text-brand" /> {t('nav_review')}</div>
          <p className="mt-2 text-sm text-ink-2">{d.dueReviews ? t('d_review_n', { n: d.dueReviews }) : t('d_review_none')}</p>
          {d.dueReviews > 0 && <Link to="/tekrar" className="btn btn-primary btn-sm mt-auto self-start">{t('d_review_go')}</Link>}
        </div>
        <div className="card p-5">
          <p className="mb-3 text-sm font-semibold">{t('d_activity')}</p>
          <Heatmap days={d.heatmap} />
        </div>
      </div>

      {cont && cont.status === 'ready' && !cont.completedAt && (
        <Link to={`/kurs/${cont.id}`} className="card mt-4 flex items-center gap-4 p-5 transition-colors hover:border-line-strong">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-ink"><LuBookOpen /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-3">{t('d_continue')}</p>
            <p className="truncate font-semibold">{cont.title}</p>
          </div>
          <Ring value={cont.percent / 100} size={44} stroke={4}><span className="text-[11px] font-semibold">{cont.percent}%</span></Ring>
        </Link>
      )}

      <h2 className="mt-10 text-lg font-semibold">{t('d_courses')}</h2>
      <div className="mt-4">
        {d.courses.length === 0 ? (
          <Empty icon={<LuGraduationCap />} title={t('d_empty_t')} body={t('d_empty_s')} action={<Link to="/kurs-olustur" className="btn btn-primary"><LuPlus /> {t('nav_new')}</Link>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{d.courses.map((c) => <CourseCard key={c.id} c={c} />)}</div>
        )}
      </div>
    </Shell>
  );
}
