// "Yolum": hedef, plan, modül ustalığı (belirsizlik bandıyla), zayıf nokta girişi ve öğrenme kazancı.
// Kavramsal model görünür olsun: öğrenen nerede olduğunu, neden ve sıradakini her an görür.
import { useEffect, useState } from 'react';
import { LuTarget, LuCalendarDays, LuTrendingUp, LuPencilLine, LuArrowRight } from 'react-icons/lu';
import { Link } from '../lib/router';
import { trpc, errCode, type RouterOutputs } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { ErrorBox, Field, Modal, PageLoader, Spinner, cx } from '../ui/kit';
import type { Locale } from '../../shared/types';

type PathData = RouterOutputs['learn']['coursePath'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

const BAND_TONE: Record<string, string> = { unknown: '', weak: 'text-bad', growing: 'chip-gold', strong: 'chip-brand' };

function MasteryBar({ mean, lo, hi, known }: { mean: number; lo: number; hi: number; known: boolean }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
      {known && <div className="absolute inset-y-0 rounded-full bg-gold/30" style={{ left: pct(lo), width: pct(Math.max(0.01, hi - lo)) }} />}
      {known && <div className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-gold" style={{ left: pct(mean) }} />}
    </div>
  );
}

const fmtDay = (iso: string, l: Locale) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(l === 'tr' ? 'tr-TR' : l === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function GoalForm({ courseId, data, onDone }: { courseId: number; data: PathData; onDone: () => void }) {
  const { t } = useI18n();
  const err = useErr();
  const utils = trpc.useUtils();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [why, setWhy] = useState(data.goal.why);
  const [date, setDate] = useState(data.goal.targetDate ?? '');
  const [per, setPer] = useState(data.goal.minutesPerDay);
  const m = trpc.course.setGoal.useMutation({ onSuccess: () => { void utils.learn.coursePath.invalidate(); void utils.learn.path.invalidate(); onDone(); } });
  return (
    <div className="space-y-3 rounded-2xl border border-line p-4">
      <Field label={t('n_goal_why')}><input className="input" maxLength={240} placeholder={t('n_goal_why_ph')} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('n_goal_date')}><input className="input" type="date" min={todayIso} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t('n_goal_min')}>
          <div className="seg w-full">{[15, 30, 45, 60, 90].map((n) => <button key={n} type="button" className="flex-1 justify-center" aria-pressed={per === n} onClick={() => setPer(n)}>{n}</button>)}</div>
        </Field>
      </div>
      {m.error && <ErrorBox>{err(errCode(m.error))}</ErrorBox>}
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost btn-sm" onClick={onDone}>{t('cancel')}</button>
        <button className="btn btn-primary btn-sm" disabled={m.isPending} onClick={() => m.mutate({ courseId, why, targetDate: date || null, minutesPerDay: per })}>
          {m.isPending ? <Spinner className="h-3.5 w-3.5" /> : t('save')}
        </button>
      </div>
    </div>
  );
}

export default function PathPanel({ courseId, open, onClose, onModule }: { courseId: number; open: boolean; onClose: () => void; onModule: (i: number) => void }) {
  const { t, lang } = useI18n();
  const q = trpc.learn.coursePath.useQuery({ courseId, locale: lang }, { enabled: open });
  const [edit, setEdit] = useState(false);
  useEffect(() => { if (!open) setEdit(false); }, [open]);
  const d = q.data;
  const p = d?.plan;
  const hasGoal = !!d && (!!d.goal.targetDate || !!d.goal.why);

  return (
    <Modal open={open} onClose={onClose} title={t('pp_title')} wide>
      {!d || !p ? <PageLoader /> : (
        <div className="space-y-6">
          {/* Hedef + plan durumu */}
          <section>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"><LuTarget /> {t('n_goal_t')}</p>
                <p className="mt-1 font-medium">{d.goal.why || (hasGoal ? '—' : t('pp_no_goal'))}</p>
                <p className="mt-1 text-sm text-ink-2">
                  {d.goal.targetDate ? `${t('n_goal_date')}: ${fmtDay(d.goal.targetDate, lang)} · ` : ''}{t('n_goal_min')}: {t('minutes_short', { n: d.goal.minutesPerDay })}
                </p>
              </div>
              {!edit && <button className="btn btn-outline btn-sm" onClick={() => setEdit(true)}><LuPencilLine /> {t('pp_edit')}</button>}
            </div>
            {edit && <div className="mt-3"><GoalForm courseId={courseId} data={d} onDone={() => setEdit(false)} /></div>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={cx('chip', p.status === 'behind' || p.status === 'overdue' ? 'text-bad' : p.status === 'on_track' || p.status === 'done' ? 'chip-brand' : 'chip-gold')}>{t(`pp_st_${p.status}`)}</span>
              {p.projectedFinish && p.status !== 'done' && <span className="chip">{t('pp_finish', { d: fmtDay(p.projectedFinish, lang) })}</span>}
              {p.remainingMinutes > 0 && <span className="chip">{t('pp_remaining', { n: p.remainingMinutes })}</span>}
              {p.requiredPerDay !== null && (p.status === 'behind' || p.status === 'tight') && <span className="chip text-bad">{t('pp_required', { n: p.requiredPerDay })}</span>}
            </div>
          </section>

          {/* Ustalık */}
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{t('pp_mastery')}</h3>
              {d.weak > 0 && <Link to={`/tekrar?kurs=${courseId}&mod=zayif`} className="btn btn-primary btn-sm">{t('pp_recap')} <LuArrowRight /></Link>}
            </div>
            <p className="mt-1 text-xs text-ink-3">{t('pp_mastery_s')}</p>
            <div className="mt-3 rounded-xl bg-surface-2 p-3">
              {d.overall ? (
                <>
                  <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{t('pp_overall')}</span><span className="tabular-nums">{pct(d.overall.mean)} <span className="text-xs text-ink-3">({pct(d.overall.lo)}–{pct(d.overall.hi)})</span></span></div>
                  <MasteryBar mean={d.overall.mean} lo={d.overall.lo} hi={d.overall.hi} known />
                </>
              ) : <p className="text-sm text-ink-2">{t('pp_overall_wait')}</p>}
            </div>
            <ul className="mt-3 space-y-2.5">
              {d.modules.map((m) => (
                <li key={m.idx}>
                  <button className="w-full rounded-xl px-2 py-1.5 text-left hover:bg-surface-2" onClick={() => { onModule(m.idx); onClose(); }}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{m.idx + 1}. {m.title}</span>
                      <span className={cx('chip shrink-0 !h-6 !text-[11px]', BAND_TONE[m.band])}>{t(`band_${m.band}`)}</span>
                    </div>
                    <MasteryBar mean={m.mean} lo={m.lo} hi={m.hi} known={m.band !== 'unknown'} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Önümüzdeki günler */}
          {p.days.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 font-semibold"><LuCalendarDays /> {t('pp_plan')}</h3>
              <ol className="mt-3 space-y-2">
                {p.days.slice(0, 7).map((day) => (
                  <li key={day.day} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-ink-3">{fmtDay(day.day, lang)}</span>
                    {day.items.map((it, k) => (
                      <span key={k} className={cx('chip !h-7', it.kind === 'module' ? 'chip-brand' : it.kind === 'final' ? 'chip-gold' : '')}>
                        {it.kind === 'module' ? `${t('pp_item_module', { n: it.moduleIdx + 1 })}${it.parts > 1 ? ` · ${t('pp_item_part', { a: it.part, b: it.parts })}` : ''}` : it.kind === 'review' ? t('pp_item_review') : t('pp_item_final')}
                        <span className="text-ink-3"> · {it.minutes}</span>
                      </span>
                    ))}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Öğrenme kazancı */}
          <section className="rounded-2xl border border-line p-4">
            <h3 className="flex items-center gap-1.5 font-semibold"><LuTrendingUp /> {t('pp_gain')}</h3>
            {!d.gain ? <p className="mt-1 text-sm text-ink-2">{t('pp_gain_none')}</p> : (
              <>
                <p className="mt-1 text-xs text-ink-3">{t('pp_gain_s')}</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs text-ink-3">{t('pp_pre')}</p><p className="text-xl font-semibold tabular-nums">{pct(d.gain.pre)}</p></div>
                  <div><p className="text-xs text-ink-3">{t('pp_post')}</p><p className="text-xl font-semibold tabular-nums">{d.gain.post === null ? '—' : pct(d.gain.post)}</p></div>
                  <div><p className="text-xs text-ink-3">{t('pp_g')}</p><p className="text-xl font-semibold tabular-nums text-brand">{d.gain.g === null ? '—' : pct(d.gain.g)}</p></div>
                </div>
                {d.gain.post === null && <p className="mt-2 text-xs text-ink-3">{t('pp_gain_wait')}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
