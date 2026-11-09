// Kurs yolu — kursun ana sayfası: her modül bir "ünite", her bölüm bir müfredat satırı (v5: dairesel düğüm yok).
// Neden: öğrenen nerede olduğunu, sıradakini ve sonunda neyi yapabileceğini tek bakışta görür (değerlendirme uçurumu kapanır).
// Satır durumları: tamam (amber tik) · şimdi (kurs rengi zemin + "Başla") · açık · kilitli.
// Sağ ray: seri, günlük hedef, "bu kursla yapabileceklerin" (sonuç odaklı hedefler, modül bitince işaretlenir).
import { useMemo } from 'react';
import {
  LuArrowLeft, LuBookOpen, LuLock, LuTrophy, LuPlay, LuRoute, LuShare2, LuSparkles, LuAward, LuCircleCheck, LuCircle,
} from 'react-icons/lu';
import { useState } from 'react';
import { Link, useNavigate } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { Shell } from '../app/Shell';
import { Bar, ErrorBox, PageLoader, Spinner, cx } from '../ui/kit';
import { useToast } from '../ui/providers';
import { StreakCard, DailyGoalCard, LessonRow } from '../ui/learn';
import { courseTone } from '../lib/brand';
import Pretest from '../studio/Pretest';
import PathPanel from '../studio/PathPanel';
import type { View } from '../studio/types';

type NodeState = 'done' | 'current' | 'open' | 'locked';
interface PNode { key: string; kind: 'section' | 'quiz'; moduleIdx: number; sectionIdx: number; label: string; state: NodeState }

/** Görünümden patika düğümlerini çıkarır; ilk tamamlanmamış açık düğüm "şimdi" olur. */
function buildNodes(v: View): PNode[] {
  const out: PNode[] = [];
  v.doc.modules.forEach((m, mi) => {
    const p = v.progress[mi];
    m.sections.forEach((s, si) => {
      const done = !!s.check && v.checks[s.check.id] !== undefined;
      out.push({ key: `${mi}-${si}`, kind: 'section', moduleIdx: mi, sectionIdx: si, label: s.heading, state: !p.unlocked ? 'locked' : done ? 'done' : 'open' });
    });
    out.push({ key: `${mi}-q`, kind: 'quiz', moduleIdx: mi, sectionIdx: -1, label: '', state: !p.unlocked ? 'locked' : p.quizPassed ? 'done' : 'open' });
  });
  const cur = out.find((n) => n.state === 'open');
  if (cur) cur.state = 'current';
  return out;
}

function Outcomes({ v }: { v: View }) {
  const { t } = useI18n();
  return (
    <section className="card p-5" aria-label={t('v4_outcomes')}>
      <h2 className="flex items-center gap-2 font-extrabold tracking-tight"><LuSparkles className="text-k" aria-hidden /> {t('v4_outcomes')}</h2>
      <p className="mt-1 text-xs text-ink-3">{t('v4_outcomes_sub')}</p>
      <ul className="mt-4 space-y-3">
        {v.doc.modules.map((m, i) => {
          const ok = v.progress[i].completed;
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              {ok ? <LuCircleCheck className="mt-0.5 shrink-0 text-gold" aria-hidden /> : <LuCircle className="mt-0.5 shrink-0 text-ink-3" aria-hidden />}
              <span className={ok ? 'font-semibold' : 'text-ink-2'}>{m.objectives[0] ?? m.title}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function CoursePath({ courseId }: { courseId: number }) {
  const { t, lang } = useI18n();
  const err = useErr();
  const navigate = useNavigate();
  const { push } = useToast();
  const [pathOpen, setPathOpen] = useState(false);
  const q = trpc.course.view.useQuery({ courseId, locale: lang }, {
    refetchInterval: (s) => (s.state.data && s.state.data.status !== 'ready' && s.state.data.status !== 'failed' ? 1500 : false),
  });
  const dash = trpc.profile.dashboard.useQuery(undefined, { staleTime: 30_000 });
  const share = trpc.course.share.useMutation({
    onSuccess: async ({ slug }) => {
      const url = `${window.location.origin}/p/${slug}`;
      try { await navigator.clipboard.writeText(url); push('ok', t('s_share_done')); } catch { window.prompt(t('s_share'), url); }
    },
  });
  const v = q.data?.status === 'ready' ? q.data : null;
  const nodes = useMemo(() => (v ? buildNodes(v) : []), [v]);

  if (q.error) return <Shell><ErrorBox>{err(errCode(q.error))}</ErrorBox></Shell>;
  if (!q.data) return <Shell><PageLoader /></Shell>;
  if (!v) {
    return (
      <Shell>
        <div className="card mx-auto mt-10 max-w-md p-8 text-center">
          {q.data.status === 'failed' ? <ErrorBox>{t('g_failed')}</ErrorBox> : <><Spinner className="mx-auto h-7 w-7" /><p className="mt-4 text-ink-2">{t('g_title')}</p></>}
          <Link to="/panel" className="btn btn-ghost mt-6">{t('back')}</Link>
        </div>
      </Shell>
    );
  }

  const k = courseTone(courseId);
  const cur = nodes.find((n) => n.state === 'current');
  const allDone = v.progress.every((p) => p.completed);
  const doneNodes = nodes.filter((n) => n.state === 'done').length;
  const open = (n: PNode) => {
    if (n.state === 'locked') { push('ok', t('v4_locked_hint')); return; }
    navigate(n.kind === 'quiz' ? `/kurs/${courseId}/m/${n.moduleIdx}#quiz` : `/kurs/${courseId}/m/${n.moduleIdx}?b=${n.sectionIdx}`);
  };
  const go = () => (cur ? open(cur) : allDone ? navigate(`/kurs/${courseId}/final`) : navigate(`/kurs/${courseId}/m/0`));

  return (
    <Shell>
      <Pretest courseId={courseId} />
      <PathPanel courseId={courseId} open={pathOpen} onClose={() => setPathOpen(false)} onModule={(i) => { if (v.progress[i]?.unlocked) navigate(`/kurs/${courseId}/m/${i}`); }} />
      <div data-k={k} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="w-full min-w-0">
          {/* Kurs başlığı — kurs renginde bant */}
          <header className="band-k rounded-[24px] p-6 md:p-7">
            <div className="flex items-center justify-between gap-2">
              <Link to="/panel" className="inline-flex items-center gap-1.5 text-sm font-bold opacity-90 hover:opacity-100"><LuArrowLeft aria-hidden /> {t('nav_dashboard')}</Link>
              <div className="flex gap-1">
                <button className="grid h-10 w-10 place-items-center rounded-xl opacity-90 transition hover:bg-night/15 hover:opacity-100" onClick={() => setPathOpen(true)} title={t('s_path')} aria-label={t('s_path')}><LuRoute /></button>
                <button className="grid h-10 w-10 place-items-center rounded-xl opacity-90 transition hover:bg-night/15 hover:opacity-100" onClick={() => share.mutate({ courseId })} title={t('s_share')} aria-label={t('s_share')}><LuShare2 /></button>
              </div>
            </div>
            <h1 className="h-display mt-4 text-3xl md:text-4xl">{v.doc.title}</h1>
            <p className="mt-2 text-sm font-semibold opacity-90">{t('v4_course_meta', { a: doneNodes, b: nodes.length, m: v.doc.modules.length })}</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-night/20"><div className="h-full rounded-full bg-surface transition-[width] duration-700" style={{ width: `${Math.round((doneNodes / Math.max(1, nodes.length)) * 100)}%` }} /></div>
            <button className="btn btn-lg mt-5 w-full bg-surface text-k sm:w-auto" style={{ ['--edge' as string]: 'var(--k-edge)' }} onClick={go}>
              {allDone ? <><LuTrophy /> {t('v4_final')}</> : <><LuPlay /> {doneNodes ? t('v4_continue') : t('v4_start_course')}</>}
            </button>
          </header>

          {/* Üniteler + patika */}
          {v.doc.modules.map((m, mi) => {
            const p = v.progress[mi];
            const mNodes = nodes.filter((n) => n.moduleIdx === mi);
            return (
              <section key={mi} className="mt-8" aria-labelledby={`unit-${mi}`}>
                <div className={cx('flex items-center gap-4 rounded-2xl border p-4 md:p-5', p.unlocked ? 'border-k/40 bg-k-soft' : 'border-line bg-surface-2')}>
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-xs font-extrabold uppercase tracking-[0.12em]', p.unlocked ? 'text-k' : 'text-ink-3')}>{t('v4_unit', { n: mi + 1 })} · {t('v4_min', { n: m.minutes })}</p>
                    <h2 id={`unit-${mi}`} className={cx('mt-1 text-xl font-extrabold tracking-tight', !p.unlocked && 'text-ink-3')}>{m.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-2">{m.summary}</p>
                  </div>
                  {p.completed ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-on-gold"><LuAward aria-hidden /></span>
                    : p.unlocked ? <Link to={`/kurs/${courseId}/m/${mi}`} className="btn btn-outline btn-sm shrink-0"><LuBookOpen /> <span className="hidden sm:inline">{t('v4_guide')}</span></Link>
                    : <LuLock className="shrink-0 text-xl text-ink-3" aria-hidden />}
                </div>
                <ol className="lesson-list mt-3">
                  {mNodes.map((n) => (
                    <LessonRow key={n.key} n={n.sectionIdx + 1} quiz={n.kind === 'quiz'} state={n.state} onOpen={() => open(n)}
                      title={n.kind === 'quiz' ? t('v4_unit_quiz') : n.label}
                      meta={n.kind === 'quiz' ? undefined : t('v5_lesson_n', { n: n.sectionIdx + 1 })} />
                  ))}
                </ol>
              </section>
            );
          })}

          {/* Final */}
          <section className="card mt-8 mb-10 flex flex-wrap items-center gap-4 p-5" aria-label={t('v4_final')}>
            <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl', v.final?.passed ? 'bg-gold-soft text-gold-ink' : allDone ? 'bg-k' : 'bg-surface-2 text-ink-3')}>
              {allDone ? <LuTrophy aria-hidden /> : <LuLock aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{v.final?.passed ? t('v4_cert_ready') : t('v4_final')}</p>
              {!allDone && <p className="text-sm text-ink-3">{t('v4_final_locked')}</p>}
            </div>
            {v.certificate
              ? <Link to={`/sertifika/${v.certificate.code}`} className="btn btn-gold btn-sm"><LuAward /> {t('s_view_cert')}</Link>
              : allDone && <Link to={`/kurs/${courseId}/final`} className="btn btn-primary btn-sm"><LuTrophy /> {t('v4_final')}</Link>}
          </section>
        </div>

        {/* Sağ ray */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {dash.data && <StreakCard streak={dash.data.streak} longest={dash.data.longestStreak} days={dash.data.heatmap} />}
          {dash.data && <DailyGoalCard goal={dash.data.dailyGoal} days={dash.data.heatmap} />}
          <Outcomes v={v} />
          <div className="card p-5">
            <p className="text-sm font-extrabold">{t('s_progress')}</p>
            <Bar value={v.percent / 100} className="mt-3" color="bg-k" />
            <p className="mt-2 text-xs text-ink-3">{t('modules_n', { a: v.progress.filter((p) => p.completed).length, b: v.doc.modules.length })}</p>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

